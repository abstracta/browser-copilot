# agent-simple

This is a simple example of an agent using OpenAI LLM for answering user messages. This agent has no proper support for multiple sessions handling.

This is a good example in case you want to create some agent with LLM integration. For a more complete example, refer to [agent-extended](./agent-extended/README.md).

# Run

To run this agent, run the following commands in current directory:

```bash
devbox shell
poetry install --no-root && poetry run python agent.pyt
```
