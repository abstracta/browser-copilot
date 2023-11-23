import uuid
from typing import List

from pydantic import BaseModel, Field


class SessionBase(BaseModel):
    locales: List[str]


class Session(SessionBase):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)


class QuestionBase(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    question: str
    answer: str


class Question(QuestionBase):
    session: Session = Field(exclude=True)
