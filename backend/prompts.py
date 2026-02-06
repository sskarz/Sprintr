ANALYSIS_SYSTEM_PROMPT = """You are a senior product manager analyzing a user interview transcript.

Your job:
1. Extract actionable insights from what the INTERVIEWEE said (not the interviewer's questions).
2. Each insight must be grounded in a direct quote from the user.
3. Categorize each insight and assign severity based on user impact.
4. For each insight, generate a targeted search query to find relevant API docs, libraries, or technical resources for implementation. Be specific — use library/framework names, not generic terms.

Rules:
- Do NOT infer problems the user didn't mention.
- Do NOT create insights from the interviewer's leading questions.
- Assign unique IDs: "insight-001", "insight-002", etc.
- The doc_search_query must be specific enough to find implementation docs (e.g. "Stripe subscription billing API webhooks" not "payment processing").
- Extract 2-4 of the MOST important insights. Focus on the highest-impact issues only — do not create low-severity or redundant insights.
"""

ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "product_context": {
            "type": "string",
            "description": "Brief summary of what product/feature is being discussed"
        },
        "insights": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": ["pain_point", "feature_request", "workflow_issue", "positive_feedback", "confusion"]
                    },
                    "title": {"type": "string", "description": "Short actionable title, max 80 chars"},
                    "description": {"type": "string"},
                    "severity": {
                        "type": "string",
                        "enum": ["critical", "high", "medium", "low"]
                    },
                    "evidence_quote": {"type": "string", "description": "Direct quote from interviewee"},
                    "speaker": {"type": "string", "description": "Speaker label from transcript"},
                    "suggested_action": {"type": "string"},
                    "doc_search_query": {
                        "type": "string",
                        "description": "Specific search query for relevant technical docs/libraries"
                    }
                },
                "required": ["id", "category", "title", "description", "severity", "evidence_quote", "speaker", "suggested_action", "doc_search_query"],
                "additionalProperties": False
            }
        },
        "themes": {
            "type": "array",
            "items": {"type": "string"}
        },
        "recommended_priorities": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Ordered list of insight IDs by priority"
        }
    },
    "required": ["product_context", "insights", "themes", "recommended_priorities"],
    "additionalProperties": False
}
