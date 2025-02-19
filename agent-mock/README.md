# agent-mock

This is just a simple example of an agent that has no integration with an LLM and only implements the basic contract of an agent.

This is a good example in case you want to create some agent mock that answers with fixed answer, or an agent that just doesn't use LLMs. For a more complete example, refer to [agent-extended](./agent-extended/README.md).

# Run

To run this agent, run the following commands in current directory:

```bash
devbox shell
poetry install --no-root && poetry run python agent.py
```
