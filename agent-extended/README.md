# agent-extended

This is an agent example that integrates with OpenAI (or Azure OpenAI) and provides a similar basic experience to ChatGPT, including authentication, proper session handling, response streaming and transcripts support.

This agent also provides an example on how to automate basic flows with the copilot, providing an example automation to navigate to abstracta.us contact site and filling the full name field. 

It is developed using the following:

* [FastAPI](https://fastapi.tiangolo.com/)
* [LangChain](https://www.langchain.com/)
* [Poetry](https://python-poetry.org/)

## Agent Requirements

To develop an agent compatible with the browser extension, you just have to define 4 endpoints:

1. An `manifest.json` endpoint: This endpoint provides metadata about the agent. You can find an example in the [included manifest file](./gpt_agent/assets/manifest.json).
2. A `logo.png` endpoint: This provides the logo that is displayed in the browser extension.
3. Session creation endpoint: Each browser tab creates a separate session, containing messages and relevant context for the agent active in that tab.
4. Question answering endpoint: This endpoint is queried by the browser extension to obtain the appropriate answer from the agent for each user message in the chat.

### Advanced Use case

You may also add additional endpoints to your agent that the extension can use for other purposes. For instance, if you have implemented a copilot that automatically activates when requests to a specific URL are sent by a web application and also provides an endpoint for obtaining observability information, you would:

1. define a `manifest.json` like the following one:
   ```json
    {
        "id": "my-app",
        "name": "MyApp",
        "welcomeMessage": "Hi! I am MyApp copilot and can show you observability information about MyApp while you use it. You can ask me for example about slow methods or queries.",
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

The previous manifest includes the following sections:

* `id`: this identifier should be unique for each copilot. This allows the browser extension to identify if the copilot is already registered or not when adding it to a list of copilots.
* `name`: this is the name displayed for the copilot in the extension.
* `welcomeMessage`: this is the first message given by the copilot when it is activated in the browser extension. This is a good place to provide information to users about the capabilities of the copilot and what type of questions the copilot may answer.
* `prompts`: here you can include a set of predefined prompts that users might use to ask questions to the copilot. You can include ${input} in a prompt text for the user to complete/parameterize in the browser extension.
* `onSessionClose`: action to execute after a copilot session (tab with active chat) has been closed.
  * `httpRequest`: makes an HTTP Request. In the provided example this is used to teardown any observability resources being held while the session was active.
    * `url`: URL to send the HTTP request to. This URL can contain:
      * `${origin}`: This is replaced by the protocol + host + port (eg: `https://myapp:8008`) of the request that activated the copilot or the URL of the tab when the copilot was manually activated. In other cases, detailed in the following sections, the origin is extracted from the request triggering the action.
      * `${basePath}`: This is replaced by the path part of the URL described in the previous point, but removing the last part of the path. Eg: if the original URL is `https://myapp:8008/api/users`, then the base path would solve to `/api/`. 
      * `${sessionId}`: This is replaced by the copilot-generated session ID.
    * `method`: the HTTP method to be used for the request.
* `onHttpRequest`: this contains a list of rules (condition + actions) to be applied to each request intercepted by the browser extension.
  * `condition`: specifies a set of conditions that all need to be matched for the rule actions to be triggered. In general, try to be as much specific as possible to avoid unnecessary load and potential security leaks.
    * `urlRegex`: Regular Expression to match the request URL to. When not specified all request URLs will match.
    * `requestMethods`: The request must use one of the provided methods. E.g.: `["GET", "POST"]`. When not specified then any request method will match.
    * `resourceTypes`: The types of resources that may be retrieved by the request. E.g.: `["main_frame", "sub_frame"]`. Check [here](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest/ResourceType) for a list of resource types.
    * `event`: Species either `onBeforeRequest` or `onCompleted` to identify if the actions should be triggered before the http request is made or after it completed. To be albe to use the request body in an action (for example in `recordInteraction`) it is required to use the `onBeforeRequest` event. When not specified `onCompleted` is used.
    * More to come :)
  * `actions`: specifies the actions to be taken when the rule conditions are met.
    * `activate`:
      * `httpRequest`: when included, the extension makes an additional request when the copilot is activated. In the provided example here the observability endpoint for trace setup is invoked. The format of this `httpRequest` is the same as described in `onSessionClose`.
    * `recordInteraction`: allows to provide information to the copilot that it may use to provide proactive (not requested) information to the user or to be able to answer future questions. The copilot must provide a `interactions` endpoint that accepts the request provided by the extension and provides a JSON with a `summary` field that may be empty (if no proactive information is to be sent to the user) or some summary that provides proactive information to the user about the web application being used or request that triggered this action. 
      * `httpRequest`: specifies an HTTP request to be made to obtain information to be sent to the copilot session `interactions` endpoint. In this example, it is used to retrieve trace information about the generated request. The format of this `httpRequest` is the same as described in `onSessionClose`.
    * `addHeader`: allows to add HTTP headers to requests matched by the condition before they are sent to the web app backend. 
      * `header`: the name of the header to add.
      * `value`: the value to send in the header. This value can contain `${sessionId}` to identify the session used by the copilot.
    * More to come :)
* `pollInteractionPeriodSeconds`: specifies the number of seconds to poll for new interactions detected by the agent. 
* `contactEmail`: specifies an email provided to copilot users so they can contact support in case they face any issues with the copilot.

### Authentication

The browser extension provides support for [OpenID Connect](https://en.wikipedia.org/wiki/OpenID#OpenID_Connect_(OIDC)) authentication.

Including in `manifest.json` an `auth` section with the following properties will enable this functionality:

* `url`: the OpenID base url. Check [sample.env](./sample.env) for some examples.
* `clientId`: the client ID registered in your OAuth Provider for the copilot.
* `scopes`: the scopes required for your copilot. Check [sample.env](./sample.env) for some examples.

Provided [sample.env](./sample.env) includes configurations for using Keycloak or Microsoft Entra ID.

### Transcripts

If you want your agent users to be able to ask questions by recording audios you can just add `"capabilities": ["transcript"]` to your `manifest.json` and implement a `sessions/${SESSION_ID}/transcripts` endpoint that recieves a request like the following:

```json
{
    "file": "as545asd" // This is the base64 encoding of the audio file
}
```

and answers with an answer like this one:

```json
{
    "text": "Hello my friend" // This is the transcribed message
}
```

#### Microsoft Entra ID

1. Register the Chrome extension in Azure as described [here](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).
   E.g.: use `browser-copilot` as the name and `https://nnllgflhcpaigpehhmbdhpjpakmofemh.chromiumapp.org/` as the redirect URI (check the proper ID for the Chrome extension by accessing manage extension in Chrome.)
   Remember to enable user assignment and assign users that should be able to access the copilot.
2. Register the backend agent (API) for the copilot in Azure as described [here](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-expose-web-apis) and [here](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-access-web-apis).
   E.g.: using `gpt-copilot` as the name
   Remember to expose the API and add a scope (E.g.: `Chat`).
   Also, remember to add the API to the extension (`browser-copilot`) app registration.
3. Use the extension (`browser-copilot`) client ID and proper API scope (Eg: `api://2e990215-c550-468b-950e-3008832f3fbb/Ask openid profile`) in your `.env` file.

#### Google OAuth

To add Google auth, you can use Keycloak and configure Google as an ID Provider.

To do so with the provided Keycloak, **which should not be used for production scenarios**, you can go to [identity providers section in Keycloak admin console](http://localhost:8080/admin/master/console/#/browser-copilot/identity-providers), with `admin` `admin` credentials, select the `browser-copilot` realm, and then add the Google as provider configuring proper client ID and client secret obtained from Google. 
In Google, you will need to create OAuth credentials as described [here](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred) using the redirect URI you get from Keycloak Google provider registration page (eg: `http://localhost:8080/realms/browser-copilot/broker/google/endpoint`). 

For the time being, we haven't found a generic solution that allows direct integration with Google Auth. 
[Here](https://stackoverflow.com/questions/60724690/using-google-oidc-with-code-flow-and-pkce) is an issue we have faced when trying it. 
Another issue we have faced is that using [Google's proposed solution for Chrome extensions](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth) requires knowing the client ID before building and publishing the extension, which is not good to allow any user to be able to use their own Google OAuth config without having to rebuild the extension.
If you have any ideas please let us know by creating an issue or discussion in this repository.

## Basic Agent API

Here are some examples of the main requests generated from the extension:

### Get manifest

```bash
curl http://localhost:8000/manifest.json
```

### Get logo

```bash
curl http://localhost:8000/logo.png
```

### Create session

```bash
SESSION_ID=$(curl -X POST -H "Content-Type: application/json" --data '{ "locales": ["en-US"] }' http://localhost:8000/sessions | jq -r .id) 
```

### Ask question

```bash
curl -X POST -H "Content-Type: application/json" --data '{"question": "what time is it?"}' http://localhost:8000/sessions/${SESSION_ID}/questions
```
