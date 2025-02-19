from typing import List, Optional
import uuid

from fastapi import FastAPI, status
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

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


class AgentStep(BaseModel):
    action: str = "message"
    value: str


class QuestionResponse(BaseModel):
    steps: List[AgentStep]


@app.post('/sessions/{session_id}/questions', status_code=status.HTTP_200_OK)
async def answer_question(session_id: str, req: QuestionRequest) -> QuestionResponse:
    return QuestionResponse(steps=[AgentStep(value=req.question)])


if __name__ == "__main__":
    uvicorn.run("agent:app", host="0.0.0.0", port=8000, log_level="info", reload=True)
