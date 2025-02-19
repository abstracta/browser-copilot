import asyncio
import datetime
import enum
import logging
import os
from typing import List, AsyncIterator, Optional
from pydantic import BaseModel

from langchain.agents import Tool, OpenAIFunctionsAgent, AgentExecutor
from langchain.callbacks import AsyncIteratorCallbackHandler
from langchain.memory import ConversationBufferMemory, FileChatMessageHistory
from langchain.prompts import MessagesPlaceholder
from langchain.schema import SystemMessage
from langchain.tools import tool
from langchain_community.chat_models import AzureChatOpenAI, ChatOpenAI
from openai import OpenAI, AzureOpenAI

from gpt_agent.domain import Session
from gpt_agent.file_system_repos import get_session_path

logging.getLogger("openai").level = logging.DEBUG


# just a sample tool to showcase how you can create your own set of tools
@tool
def clock() -> str:
    """gets the current time"""
    return str(datetime.datetime.now())


class AgentAction(enum.Enum):
    MESSAGE = "message"
    CLICK = "click"
    FILL = "fill"
    GOTO = "goto"


class AgentStep(BaseModel):
    action: AgentAction
    selector: Optional[str] = None
    value: Optional[str] = None


class AgentFlow(BaseModel):
    steps: List[AgentStep]

    @staticmethod
    def message(text: str) -> 'AgentFlow':
        return AgentFlow(steps=[AgentStep(action=AgentAction.MESSAGE, value=text)])


# a sample tool to showcase how you can automate navigation in the browser
@tool(return_direct=True)
def contact_abstracta(full_name: str) -> str:
    """navigates to abstracta.us and fills the contact form with the given full name"""
    return AgentFlow(steps=[
        AgentStep(action=AgentAction.GOTO, value='https://abstracta.us'),
        AgentStep(action=AgentAction.CLICK, selector='xpath://a[@href="./contact-us"]'),
        AgentStep(action=AgentAction.FILL, selector='#fullname', value=full_name),
        AgentStep(action=AgentAction.MESSAGE, value="I have filled the contact form with your name.")
    ]).model_dump_json()


class Agent:

    def __init__(self, session: Session):
        self._session = session
        message_history = FileChatMessageHistory(get_session_path(session.id) + "/chat_history.json")
        self._memory = ConversationBufferMemory(memory_key="chat_history", chat_memory=message_history,
                                                return_messages=True)
        self._agent = self._build_agent(self._memory, [clock, contact_abstracta])

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

    def _build_llm(self):
        temperature = float(os.getenv("TEMPERATURE"))
        base_url = os.getenv("OPENAI_API_BASE")
        if self._is_azure(base_url):
            return AzureChatOpenAI(deployment_name=os.getenv("AZURE_DEPLOYMENT_NAME"), temperature=temperature,
                                   verbose=True, streaming=True)
        else:
            return ChatOpenAI(model_name=os.getenv("MODEL_NAME"), temperature=temperature, verbose=True, streaming=True)

    @staticmethod
    def _is_azure(base_url: str) -> bool:
        return base_url and ".openai.azure.com" in base_url

    def start_session(self):
        self._memory.chat_memory.add_user_message("this is my locale: " + self._session.locales[0])

    def transcript(self, audio_file_path: str) -> str:
        base_url = os.getenv("OPENAI_WHISPER_API_BASE", os.getenv("OPENAI_API_BASE"))
        api_key = os.getenv("OPENAI_WHISPER_API_KEY", os.getenv("OPENAI_API_KEY"))
        api_version = os.getenv("OPENAI_WHISPER_API_VERSION", os.getenv("OPENAI_API_VERSION"))
        deployment_name = os.getenv("AZURE_WHISPER_DEPLOYMENT_NAME", os.getenv("AZURE_DEPLOYMENT_NAME"))
        client = AzureOpenAI(azure_endpoint=base_url, api_version=api_version, api_key=api_key,
                             azure_deployment=deployment_name) \
            if self._is_azure(base_url) else OpenAI(base_url=base_url, api_key=api_key)
        locale = self._session.locales[0]
        lang_separator_pos = locale.find("-")
        language = locale[0:lang_separator_pos] if lang_separator_pos >= 0 else locale
        ret = client.audio.transcriptions.create(model="whisper-1", file=open(audio_file_path, 'rb'),
                                                 language=language)
        return ret.text

    async def ask(self, question: str) -> AsyncIterator[AgentFlow | str]:
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
            if ret.startswith("{\"steps\":"):
                try:
                    yield AgentFlow.model_validate_json(ret)
                except Exception as e:
                    logging.exception("Error parsing agent response", e)
                    yield ret
            yield ret
