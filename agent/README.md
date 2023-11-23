# GPT Agent Example

This is a simple agent example that integrates with OpenAI (or Azure OpenAI) and provides a similar basic experience to ChatGPT.

It is developed using the following:

* [FastAPI](https://fastapi.tiangolo.com/)
* [LangChain](https://www.langchain.com/)
* [Poetry](https://python-poetry.org/)

## Agent Requirements

To develop an agent compatible with the browser extension, you just have to define 3 endpoints:

1. An `manifest.json` endpoint: This endpoint provides metadata about the agent. You can find an example in the [included manifest file](./gpt_agent/assets/manifest.json).
2. Session creation endpoint: Each browser tab creates a separate session, containing messages and relevant context for the agent active in that tab.
3. Question answering endpoint: This endpoint is queried by the browser extension to obtain the appropriate answer from the agent for each user message in the chat.

You may also add additional endpoints to your agent that the extension can use for other purposes. For instance, if you have implemented a copilot that automatically activates when requests to a specific URL are sent by a web application and also provides an endpoint for obtaining observability information, you would:

1. define a `manifest.json` like the following one:
   ```json
    {
        "id": "my-app",
        "name": "MyApp",
        "welcomeMessage": "Hi! I am MyApp copilot and can show you observability information about MyApp while you use it.",
        "prompts": [
            { "name" : "slow methods", "text" : "show slow methods for last trace" },
            { "name" : "slow queries", "text" : "show slow queries for last trace" }
        ],
        "onSessionClose": {
            "httpRequest": {
                "url": "${origin}/admin/sessions/${sessionId}",
                "method": "DELETE"
            }
        },
        "onHttpRequest": [
            {
                "condition": {
                    "urlRegex": "https://myapp.com/.*"
                },
                "actions": [
                    {
                        "activate": {
                            "httpRequest": {
                                "url":"${origin}/admin/sessions/${sessionId}",
                                "method": "PUT"
                            }
                        }
                    }
                ]
            },
            {
                "condition": {
                    "resourceTypes": [
                        "main_frame",
                        "sub_frame",
                        "xmlhttprequest"
                    ]
                },
                "actions": [
                    {
                        "recordInteraction": {
                            "url": "${origin}/admin/sessions/${sessionId}/traces"
                        }
                    }
                ]
            }
        ]
    }
   ```
2. define an endpoint to record the interactions and incorporate such information in your agent's context:
   ```bash
   curl -X POST -H "Content-Type: application/json" --data '{"traces": []}' http://localhost:8000/sessions/${SESSION_ID}/interactions
   ```

## Basic Agent API

Here are some examples of the main requests generated from the extension:

### Get manifest:

```bash
curl http://localhost:8000/manifest.json
```

### Create session

```bash
SESSION_ID=$(curl -X POST -H "Content-Type: application/json" --data '{ "locales": ["en-US"] }' http://localhost:8000/sessions | jq -r .id) 
```

### Ask question

```bash
curl -X POST -H "Content-Type: application/json" --data '{"question": "what time is it?"}' http://localhost:8000/sessions/${SESSION_ID}/questions
```
