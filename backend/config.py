import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
YDC_API_KEY = os.environ["YDC_API_KEY"]
GITHUB_OWNER = os.environ["GITHUB_OWNER"]
GITHUB_REPO = os.environ["GITHUB_REPO"]

GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]

# Optional — Composio may not be configured
COMPOSIO_API_KEY = os.environ.get("COMPOSIO_API_KEY", "")
GITHUB_PAT = os.environ.get("GITHUB_PAT", "")
