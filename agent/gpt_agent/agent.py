import asyncio
import datetime
import os
from typing import List, AsyncIterator

import openai
from langchain.agents import Tool, OpenAIFunctionsAgent, AgentExecutor
from langchain.callbacks import AsyncIteratorCallbackHandler
from langchain.chat_models import AzureChatOpenAI, ChatOpenAI
from langchain.memory import ConversationBufferMemory, FileChatMessageHistory
from langchain.prompts import MessagesPlaceholder
from langchain.schema import SystemMessage
from langchain.tools import tool

from gpt_agent.domain import Session
from gpt_agent.file_system_repos import get_session_path

openai.log = 'debug'


# just a sample tool to showcase how you can create your own set of tools
@tool
def clock():
    """gets the current time"""
    return str(datetime.datetime.now())


class Agent:

    def __init__(self, session: Session):
        self._session = session
        message_history = FileChatMessageHistory(get_session_path(session.id) + "/chat_history.json")
        self._memory = ConversationBufferMemory(memory_key="chat_history", chat_memory=message_history,
                                                return_messages=True)
        self._agent = self._build_agent(self._memory, [clock])

    def _build_agent(self, memory: ConversationBufferMemory, tools: List[Tool]) -> AgentExecutor:
        llm = self._build_llm()
        prompt = OpenAIFunctionsAgent.create_prompt(
            system_message=SystemMessage(content=os.getenv("SYSTEM_PROMPT")),
            extra_prompt_messages=[MessagesPlaceholder(variable_name=memory.memory_key)],
        )
        agent = OpenAIFunctionsAgent(llm=llm, tools=tools, prompt=prompt)
        return AgentExecutor(
            agent=agent,
            tools=tools,
            memory=memory,
            verbose=True,
            return_intermediate_steps=False,
            max_iterations=int(os.getenv("AGENT_MAX_ITERATIONS", "3"))
        )

    @staticmethod
    def _build_llm():
        temperature = float(os.getenv("TEMPERATURE"))
        base_url = os.getenv("OPENAI_API_BASE")
        if base_url and ".openai.azure.com" in base_url:
            return AzureChatOpenAI(deployment_name=os.getenv("AZURE_DEPLOYMENT_NAME"), temperature=temperature,
                                   verbose=True, streaming=True)
        else:
            return ChatOpenAI(model_name=os.getenv("MODEL_NAME"), temperature=temperature, verbose=True, streaming=True)

    def start_session(self):
        self._memory.chat_memory.add_user_message("this is my locale: " + self._session.locales[0])

    async def ask(self, question: str) -> AsyncIterator[str]:
        callback = AsyncIteratorCallbackHandler()
        task = asyncio.create_task(self._agent.arun(input=question, callbacks=[callback]))
        resp = ""
        async for token in callback.aiter():
            resp += token
            yield token
        ret = await task
        # when using tools tokens are not passed to the callback handler, so we need to get the response directly from
        # agent run call
        if ret != resp:
            yield ret
