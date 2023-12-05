import uuid
from typing import List

from pydantic import BaseModel, Field


class SessionBase(BaseModel):
    locales: List[str]


class Session(SessionBase):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)


class Question(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    session: Session = Field(exclude=True)
    question: str
    answer: str
