import sys

import dotenv
import uvicorn

if __name__ == "__main__":
    dotenv.load_dotenv()
    uvicorn.run("gpt_agent.api:app", host="0.0.0.0", port=8000, log_level="info", reload=len(sys.argv) > 1)
