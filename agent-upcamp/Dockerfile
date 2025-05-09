FROM python:3.12

RUN pip install poetry

WORKDIR /usr/src/app

COPY pyproject.toml poetry.lock ./

RUN poetry install

COPY gpt_agent ./gpt_agent
COPY entrypoint.sh entrypoint.sh

COPY .env .env

ADD https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh wait-for-it.sh
RUN chmod +x wait-for-it.sh

ENTRYPOINT [ "./entrypoint.sh" ]

CMD ["poetry", "run", "python", "-m", "gpt_agent"]
