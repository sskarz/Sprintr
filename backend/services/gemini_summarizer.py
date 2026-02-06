from google import genai
from google.genai import types
from config import GEMINI_API_KEY

client = genai.Client(api_key=GEMINI_API_KEY)

SUMMARIZER_INSTRUCTION = """You are a senior software engineer. Given a product insight from a user interview and related documentation snippets, write a concise implementation guide.

Your output should be a short paragraph (3-5 sentences) that:
1. Identifies the specific technical approach to address the insight
2. References relevant APIs, libraries, or patterns from the provided docs
3. Suggests concrete first steps for a developer picking up this task

Be direct and actionable. No fluff. Write in second person ("You should...")."""


async def summarize_docs_for_insight(insight: dict, docs: list[dict]) -> str:
    """Use Gemini to synthesize doc snippets into actionable implementation guidance."""
    if not docs:
        return ""

    doc_context = "\n\n".join(
        f"**{d['title']}** ({d['url']})\n{d['snippet']}"
        for d in docs[:3]
    )

    prompt = f"""## Insight
**{insight['title']}** ({insight['category']}, {insight['severity']})
{insight['description']}

Suggested action: {insight['suggested_action']}

## Documentation Snippets
{doc_context}

## Task
Write a concise implementation guide based on the above."""

    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SUMMARIZER_INSTRUCTION,
                temperature=0.3,
                max_output_tokens=300,
            ),
        )
        return response.text.strip()
    except Exception as e:
        print(f"Gemini summarization failed for '{insight['title']}': {e}")
        return ""
