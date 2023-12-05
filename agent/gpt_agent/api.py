import os
import traceback
from typing import AsyncIterator

import dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sse_starlette.sse import ServerSentEvent

from gpt_agent.agent import Agent
from gpt_agent.domain import Session, Question, SessionBase
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


async def _find_session(session_id: str) -> Session:
    ret = await sessions_repo.find_session(session_id)
    if not ret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f'session {session_id} not found')
    return ret


@app.post('/sessions/{session_id}/questions')
async def answer_question(session_id: str, req: QuestionRequest) -> StreamingResponse:
    session = await _find_session(session_id)
    return StreamingResponse(agent_response_stream(req, session), media_type="text/event-stream")


async def agent_response_stream(req: QuestionRequest, session: Session) -> AsyncIterator[str]:
    try:
        answer_stream = Agent(session).ask(req.question)
        complete_answer = ""
        async for token in answer_stream:
            complete_answer = complete_answer + token
            yield ServerSentEvent(data=token).encode()
        ret = Question(question=req.question, answer=complete_answer, session=session)
        await questions_repo.save_question(ret)
    except Exception as e:
        traceback.print_exception(e)
        yield ServerSentEvent(event="error", data=e).encode()
