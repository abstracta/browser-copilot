import datetime
import os
import uuid
from typing import List, Optional

import dotenv
import uvicorn
from fastapi import FastAPI, status
from fastapi.responses import FileResponse, Response
from langchain.agents import AgentExecutor
from langchain.agents.agent_toolkits import create_conversational_retrieval_agent
from langchain.tools import tool
from langchain_community.chat_models import ChatOpenAI, AzureChatOpenAI
from pydantic import BaseModel, Field

app = FastAPI()


@app.get('/manifest.json')
async def get_manifest() -> Response:
    return FileResponse('manifest.json')


@app.get('/logo.png')
async def get_logo() -> Response:
    return FileResponse('logo.png')


class SessionBase(BaseModel):
    locales: List[str]


class Session(SessionBase):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)


@app.post('/sessions', status_code=status.HTTP_201_CREATED)
async def create_session(req: SessionBase) -> Session:
    ret = Session(**req.model_dump())
    return ret


class QuestionRequest(BaseModel):
    question: Optional[str] = ""


class AgentStep(BaseModel):
    action: str = "message"
    value: str


class QuestionResponse(BaseModel):
    steps: List[AgentStep]


@tool
def clock():
    """gets the current time"""
    return str(datetime.datetime.now())


@app.post('/sessions/{session_id}/questions', status_code=status.HTTP_200_OK)
async def answer_question(session_id: str, req: QuestionRequest) -> QuestionResponse:
    resp = build_agent().invoke(req.question)
    return QuestionResponse(steps=[AgentStep(value=resp['output'])])


def build_agent() -> AgentExecutor:
    llm = ChatOpenAI(model_name=os.getenv("MODEL_NAME"), temperature=0.7, verbose=True, streaming=True)
    return create_conversational_retrieval_agent(llm, [clock], max_iterations=3)


if __name__ == "__main__":
    dotenv.load_dotenv()
    uvicorn.run("agent:app", host="0.0.0.0", port=8000, log_level="info", reload=True)
