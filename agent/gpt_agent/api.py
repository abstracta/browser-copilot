import os

import dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from gpt_agent.agent import Agent
from gpt_agent.domain import Session, Question, SessionBase, QuestionBase
from gpt_agent.file_system_repos import SessionsRepository, QuestionsRepository

dotenv.load_dotenv()
app = FastAPI()
assets_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'assets')
sessions_repo = SessionsRepository()
questions_repo = QuestionsRepository()


@app.get('/manifest.json')
async def get_manifest():
    return FileResponse(os.path.join(assets_path, 'manifest.json'))


@app.get('/logo.png')
async def get_logo():
    return FileResponse(os.path.join(assets_path, 'logo.png'))


@app.post('/sessions', status_code=status.HTTP_201_CREATED)
async def create_session(req: SessionBase) -> Session:
    ret = Session(**req.model_dump())
    await sessions_repo.save_session(ret)
    Agent(ret).start_session()
    return ret


class QuestionRequest(BaseModel):
    question: str


class QuestionResponse(QuestionBase):
    pass


async def _find_session(session_id: str) -> Session:
    ret = await sessions_repo.find_session(session_id)
    if not ret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f'session {session_id} not found')
    return ret


@app.post('/sessions/{session_id}/questions')
async def answer_question(session_id: str, req: QuestionRequest) -> QuestionResponse:
    session = await _find_session(session_id)
    answer = await Agent(session).ask(req.question)
    ret = Question(question=req.question, answer=answer, session=session)
    await questions_repo.save_question(ret)
    return QuestionResponse(**ret.model_dump())
