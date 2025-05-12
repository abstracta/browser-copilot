import logging
import os
import traceback
from typing import AsyncIterator, Annotated, Optional

from fastapi import Depends, FastAPI, HTTPException, status, Request
from fastapi.responses import FileResponse, StreamingResponse, Response
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from sse_starlette.sse import ServerSentEvent

from gpt_agent.agent import Agent, AgentAction
from gpt_agent.auth import get_current_user
from gpt_agent.domain import Session, Question, TranscriptionQuestion, SessionBase
from gpt_agent.file_system_repos import SessionsRepository, QuestionsRepository, TranscriptionsRepository

logging.basicConfig()
logger = logging.getLogger("gpt_agent")
logger.level = logging.DEBUG
logging.getLogger().level = logging.DEBUG

app = FastAPI()
assets_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'assets')
templates = Jinja2Templates(directory=assets_path)
sessions_repo = SessionsRepository()
questions_repo = QuestionsRepository()
transcriptions_repo = TranscriptionsRepository()


@app.get('/manifest.json')
async def get_manifest(request: Request) -> Response:
    return templates.TemplateResponse("manifest.json", {
        "request": request,
        "openid_url": os.getenv("MANIFEST_OPENID_URL", os.getenv("OPENID_URL")),
        "openid_client_id": os.getenv("OPENID_CLIENT_ID"),
        "openid_scope": os.getenv("OPENID_SCOPE"),
        "contact_email": os.getenv("CONTACT_EMAIL")
    }, media_type='application/json')


@app.get('/logo.png')
async def get_logo() -> FileResponse:
    return FileResponse(os.path.join(assets_path, 'logo.png'))


@app.post('/sessions', status_code=status.HTTP_201_CREATED)
async def create_session(req: SessionBase, user: Annotated[str, Depends(get_current_user)]) -> Session:
    ret = Session(**req.model_dump(), user=user)
    await sessions_repo.save_session(ret)
    Agent(ret).start_session()
    return ret


class QuestionRequest(BaseModel):
    question: Optional[str] = ""


@app.post('/sessions/{session_id}/questions')
async def answer_question(
        session_id: str, req: QuestionRequest, user: Annotated[str, Depends(get_current_user)]) -> StreamingResponse:
    session = await _find_session(session_id, user)
    # This copilot uses response streaming which allows users to start get a response as soon as
    # possible, which is particularly important when interacting with LLMs that support response
    # streaming and may take some time to end answering a given response.
    # If you don't want to use response streaming you can just return a pydantic object like in
    # create session endpoint.
    return StreamingResponse(agent_response_stream(req, session), media_type="text/event-stream")


async def _find_session(session_id: str, user: str) -> Session:
    ret = await sessions_repo.find_session(session_id)
    if not ret or ret.user != user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f'session {session_id} not found')
    return ret


async def agent_response_stream(req: QuestionRequest, session: Session) -> AsyncIterator[bytes]:
    try:
        answer_stream = Agent(session).ask(req.question)
        complete_answer = ""
        async for token in answer_stream:
            if isinstance(token, str):
                complete_answer = complete_answer + token
                yield ServerSentEvent(data=token).encode()
            else:
                complete_answer = complete_answer + token.model_dump_json()
                yield ServerSentEvent(event="flow", data=token.model_dump_json()).encode()
        ret = Question(question=req.question, answer=complete_answer, session=session)
        await questions_repo.save_question(ret)
    except Exception as e:
        traceback.print_exception(e)
        yield ServerSentEvent(event="error").encode()


class TranscriptionRequest(BaseModel):
    file: Optional[str] = ""


class TranscriptionResponse(BaseModel):
    text: str


@app.post('/sessions/{session_id}/transcriptions')
async def answer_transcription(session_id: str, req: TranscriptionRequest, user: Annotated[str, Depends(get_current_user)]) -> TranscriptionResponse:
    session = await _find_session(session_id, user)
    ret = TranscriptionQuestion(base64=req.file, session=session)
    audio_file_path = await transcriptions_repo.save_audio(ret)
    text = Agent(session).transcript(audio_file_path)
    return TranscriptionResponse(text=text)
