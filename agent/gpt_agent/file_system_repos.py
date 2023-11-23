import json
import os
import uuid

import aiofiles
import aiofiles.os

from gpt_agent.domain import Session, Question


def get_session_path(session_id: uuid.UUID) -> str:
    return os.path.join("sessions", str(session_id))


async def _write_session_file(file_name: str, body: str, session: Session):
    file_path = os.path.join(get_session_path(session.id), file_name)
    async with aiofiles.open(file_path, 'w') as outfile:
        await outfile.write(body)


class SessionsRepository:

    @staticmethod
    async def save_session(session: Session) -> None:
        session_path = get_session_path(session.id)
        await aiofiles.os.makedirs(session_path, exist_ok=True)
        await _write_session_file('session.json', session.model_dump_json(), session)

    @staticmethod
    async def find_session(session_id: str) -> Session | None:
        session_path = get_session_path(uuid.UUID(session_id))
        if not await aiofiles.os.path.exists(session_path):
            return None
        async with aiofiles.open(os.path.join(session_path, 'session.json')) as f:
            session_dict = json.loads(await f.read())
            return Session(**session_dict)


class QuestionsRepository:

    @staticmethod
    async def save_question(question: Question) -> None:
        await _write_session_file(f'question-{question.id}.json', question.model_dump_json(), question.session)
