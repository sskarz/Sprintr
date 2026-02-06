import json
import anthropic
from config import ANTHROPIC_API_KEY
from prompts import ANALYSIS_SYSTEM_PROMPT, ANALYSIS_SCHEMA

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


async def analyze_transcript(transcript_text: str) -> dict:
    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=4096,
        system=ANALYSIS_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Analyze this user interview transcript and extract actionable product insights:\n\n{transcript_text}",
            }
        ],
        extra_headers={
            "anthropic-beta": "structured-outputs-2025-11-13",
        },
        extra_body={
            "output_format": {
                "type": "json_schema",
                "schema": ANALYSIS_SCHEMA,
            }
        },
    )

    return json.loads(response.content[0].text)
