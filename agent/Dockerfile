FROM python:3.12

RUN pip install poetry

WORKDIR /usr/src/app

COPY pyproject.toml poetry.lock ./

RUN poetry install

COPY gpt_agent ./gpt_agent

CMD ["poetry", "run", "python", "-m", "gpt_agent"]
