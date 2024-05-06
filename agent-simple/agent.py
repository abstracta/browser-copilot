import datetime
import os
from typing import List, Optional
import uuid

from fastapi import FastAPI, status
from fastapi.responses import FileResponse, Response
from langchain.agents.agent_toolkits import create_conversational_retrieval_agent
from langchain.tools import tool
from langchain_community.chat_models import ChatOpenAI
from pydantic import BaseModel, Field

import dotenv
import uvicorn


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


class QuestionResponse(BaseModel):
    answer: str


@tool
def clock():
    """gets the current time"""
    return str(datetime.datetime.now())


llm = ChatOpenAI(model_name=os.getenv("MODEL_NAME"), temperature=0.7, verbose=True, streaming=True)
agent = create_conversational_retrieval_agent(llm, [clock], max_iterations=3)


@app.post('/sessions/{session_id}/questions', status_code=status.HTTP_200_OK)
async def answer_question(session_id: str, req: QuestionRequest) -> QuestionResponse:
    resp = agent.invoke(req.question)
    return QuestionResponse(answer=resp['output'])


if __name__ == "__main__":
    dotenv.load_dotenv()
    uvicorn.run("agent:app", host="0.0.0.0", port=8000, log_level="info", reload=True)
