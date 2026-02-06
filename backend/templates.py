def build_issue_title(insight: dict) -> str:
    severity_emoji = {"critical": "\U0001f534", "high": "\U0001f7e0", "medium": "\U0001f7e1", "low": "\U0001f7e2"}
    emoji = severity_emoji.get(insight["severity"], "\u26aa")
    category_label = insight["category"].replace("_", " ").title()
    return f"{emoji} [{category_label}] {insight['title']}"


def build_issue_body(insight: dict, docs: list[dict], implementation_guide: str = "") -> str:
    if docs:
        doc_lines = "\n".join(
            f"- [{d['title']}]({d['url']}) — \"{d['snippet'][:150]}...\""
            for d in docs[:3]
        )
        docs_section = f"## \U0001f4da Relevant Documentation\n{doc_lines}"
    else:
        docs_section = "## \U0001f4da Relevant Documentation\n_No relevant documentation found._"

    return f"""## User Story
As a user, I want to {insight['suggested_action'].lower()} so that {insight['description'].lower()}.

## Evidence from Interview
> "{insight['evidence_quote']}"
— Speaker {insight['speaker']}

## Acceptance Criteria
- [ ] {insight['suggested_action']}
- [ ] Verify fix addresses the reported issue
- [ ] Add tests for the new behavior

{docs_section}

## Implementation Guide
{implementation_guide if implementation_guide else "_No implementation guidance generated._"}

## Metadata
| Field | Value |
|-------|-------|
| Category | `{insight['category']}` |
| Severity | `{insight['severity']}` |
| Insight ID | `{insight['id']}` |

---
_Auto-generated from user interview analysis_
"""
