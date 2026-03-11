"""Resume tailoring service using LLM to generate per-bullet suggestions"""
import os
import json
import logging
from typing import Dict, List, Optional
from dotenv import load_dotenv

from services.openai_client import get_openai_client, get_model

logger = logging.getLogger(__name__)

load_dotenv()


async def tailor_resume(resume_text: str, job_description: str, api_key: Optional[str] = None) -> Dict[str, any]:
    """
    Generate tailored resume suggestions based on job description.

    Args:
        resume_text: Original resume text
        job_description: Target job description
        api_key: Optional API key (overrides environment variable)

    Returns:
        Dictionary with TailoredData shape (summary, skills, jobs, sections)
    """
    client = get_openai_client(api_key)
    effective_key = api_key or os.getenv('OPENAI_API_KEY')

    if not client or not effective_key:
        raise RuntimeError("No API key configured. Add your key in Settings or set OPENAI_API_KEY in .env")

    try:
        from services.job_analyzer import analyze_job_description
        job_analysis = analyze_job_description(job_description)

        prompt = create_tailoring_prompt(resume_text, job_analysis)

        response = await client.chat.completions.create(
            model=get_model(),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert resume writer specializing in human-readable, impact-focused content. "
                        "Your job is to transform resumes to emphasize business outcomes and ownership WITHOUT inventing experience. "
                        "Focus on: 1) Human readability (clear, scannable), 2) Business impact over tasks, "
                        "3) Strong ownership verbs (built, led, shipped, improved), 4) Eliminating passive phrases, "
                        "5) Quantifying with metrics, 6) Bridging title gaps with context, "
                        "7) Prioritizing JD keywords and relevant experience. "
                        "You MUST return valid JSON matching the schema provided in the user prompt. "
                        "Do not include any text outside the JSON object."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=16000,
        )

        suggestions = response.choices[0].message.content
        finish_reason = response.choices[0].finish_reason
        logger.info(f"Tailor LLM response: {len(suggestions) if suggestions else 0} chars, finish_reason={finish_reason}")
        if finish_reason == 'length':
            logger.warning("Tailor LLM response was truncated (hit max_tokens)")
        tailored_data = parse_llm_response(suggestions, resume_text)
        return tailored_data

    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"LLM tailoring failed: {e}")
    finally:
        await client.close()


def create_tailoring_prompt(resume_text: str, job_analysis: Dict) -> str:
    """Create prompt for LLM to generate per-bullet tailoring suggestions"""
    schema = """{
  "summary": {
    "original": "Current summary text verbatim",
    "tailored": "Improved summary text",
    "explanation": "Brief reason for changes"
  },
  "skills": {
    "original": "Python, Java, SQL",
    "tailored": "Python, Java, SQL, React",
    "explanation": "Added React which appears in the job description"
  },
  "jobs": [
    {
      "id": "job-0",
      "company": "Acme Corp",
      "title": "Software Engineer",
      "location": "New York, NY",
      "dates": "Jan 2020 – Present",
      "bullets": [
        {
          "index": 0,
          "original": "Built microservices using Java",
          "tailored": "Engineered scalable microservices using Java and Spring Boot, reducing latency by 30%",
          "explanation": "Added metric, stronger verb, added Spring Boot keyword from JD"
        },
        {
          "index": 1,
          "original": "Led team of 5 engineers",
          "tailored": "Led cross-functional team of 5 engineers to deliver features on schedule",
          "explanation": "Added delivery context to show ownership"
        }
      ]
    }
  ],
  "sections": [
    {
      "section_type": "projects",
      "entries": [
        {
          "id": "proj-0",
          "bullets": [
            {
              "index": 0,
              "original": "Built a REST API",
              "tailored": "Designed and deployed a RESTful API serving 10K daily requests",
              "explanation": "Added scale metric and active verb"
            }
          ]
        }
      ]
    },
    {
      "section_type": "education",
      "entries": [
        {
          "id": "edu-0",
          "bullets": []
        }
      ]
    }
  ]
}"""

    return f"""Given the following resume and job analysis, produce tailored improvements to make the resume more impactful for human readers and aligned with the job requirements.

IMPORTANT TAILORING RULES:
1. DO NOT invent any experience, skills, or accomplishments
2. Rewrite bullets for HUMAN READABILITY — make them clear, scannable, and easy to understand
3. EMPHASIZE BUSINESS IMPACT over tasks — show results, outcomes, and value delivered
4. USE STRONG OWNERSHIP VERBS: built, led, shipped, improved, architected, delivered, achieved, drove, transformed
5. ELIMINATE PASSIVE PHRASES: remove "assisted with", "helped with", "worked on", "was responsible for"
6. QUANTIFY RESULTS with specific metrics, percentages, dollar amounts, or user counts wherever possible
7. BRIDGE TITLE GAPS by adding context about scope, team size, or technical complexity
8. PRIORITIZE JD KEYWORDS, tools, and responsibilities — surface the most relevant experience first
9. Reorder bullets within each job to put the most impressive and relevant achievements at the top
10. Keep the candidate's authentic voice while making the content more powerful

FULL RESUME:
{resume_text[:6000]}

JOB REQUIREMENTS:
Keywords: {', '.join(job_analysis.get('keywords', [])[:15])}
Required Skills: {', '.join(job_analysis.get('required_skills', []))}
Experience Level: {job_analysis.get('experience_level', 'N/A')}
Key Responsibilities: {', '.join(job_analysis.get('key_responsibilities', [])[:5])}

OUTPUT FORMAT RULES:
- Return ONLY a single JSON object — no prose, no markdown fences, no extra keys
- Use the EXACT job IDs from the parsed resume (job-0, job-1, proj-0, edu-0, etc.)
- Bullets must be in 0-based index order matching their position in the original resume
- "skills.original" and "skills.tailored" MUST be comma-separated strings, NOT arrays
- Every bullet must have all four fields: index, original, tailored, explanation
- If a section (e.g. education) has no bullets to improve, include its entry with an empty bullets array
- The "sections" array covers all non-experience, non-summary, non-skills sections (projects, education, certifications, etc.)

Return a JSON object that exactly matches this schema:
{schema}
"""


def _ensure_string(value) -> str:
    """Ensure a value is a string. Joins lists with ', '."""
    if isinstance(value, list):
        return ', '.join(str(v) for v in value)
    if isinstance(value, str):
        return value
    return str(value) if value else ''


def _repair_truncated_json(fragment: str) -> Optional[Dict]:
    """Try to repair truncated JSON by closing open brackets and braces."""
    in_string = False
    escape_next = False
    stack = []

    for ch in fragment:
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
            continue
        if ch == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in ('{', '['):
            stack.append(ch)
        elif ch == '}':
            if stack and stack[-1] == '{':
                stack.pop()
        elif ch == ']':
            if stack and stack[-1] == '[':
                stack.pop()

    if not stack:
        try:
            return json.loads(fragment)
        except json.JSONDecodeError:
            return None

    suffix = ""
    if in_string:
        suffix += '"'
    for opener in reversed(stack):
        suffix += '}' if opener == '{' else ']'

    for attempt_suffix in [suffix, '""' + suffix, 'null' + suffix]:
        try:
            return json.loads(fragment + attempt_suffix)
        except json.JSONDecodeError:
            continue
    return None


def _minimal_tailored_data() -> Dict[str, any]:
    """Return a minimal valid TailoredData dict when parsing completely fails."""
    return {
        "summary": {
            "original": "",
            "tailored": "",
            "explanation": ""
        },
        "skills": {
            "original": "",
            "tailored": "",
            "explanation": ""
        },
        "jobs": [],
        "sections": []
    }


def parse_llm_response(response: str, resume_text: str) -> Dict[str, any]:
    """Parse LLM response and map it to the TailoredData shape."""
    parsed = None

    try:
        # Strip markdown fences
        cleaned = response.strip()
        if cleaned.startswith("```"):
            first_nl = cleaned.find('\n')
            if first_nl != -1:
                cleaned = cleaned[first_nl + 1:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        start = cleaned.find('{')
        end = cleaned.rfind('}') + 1
        if start != -1 and end > start:
            try:
                parsed = json.loads(cleaned[start:end])
            except json.JSONDecodeError:
                pass

        # If direct parse failed, try repairing truncated JSON
        if parsed is None and start != -1:
            fragment = cleaned[start:]
            parsed = _repair_truncated_json(fragment)
            if parsed:
                logger.warning("Recovered truncated JSON from tailor LLM response")

        if parsed is None:
            logger.error(f"Failed to parse tailor LLM response: {cleaned[:300]}")
            return _minimal_tailored_data()

    except Exception as e:
        logger.error(f"Exception parsing tailor response: {e}")
        return _minimal_tailored_data()

    # ── summary ──────────────────────────────────────────────────────────────
    raw_summary = parsed.get('summary', {})
    if not isinstance(raw_summary, dict):
        raw_summary = {}

    summary = {
        "original": _ensure_string(raw_summary.get('original', '')),
        "tailored": _ensure_string(raw_summary.get('tailored', '')),
        "explanation": _ensure_string(raw_summary.get('explanation', ''))
    }

    # ── skills ───────────────────────────────────────────────────────────────
    raw_skills = parsed.get('skills', {})
    if not isinstance(raw_skills, dict):
        raw_skills = {}

    skills = {
        "original": _ensure_string(raw_skills.get('original', '')),
        "tailored": _ensure_string(raw_skills.get('tailored', '')),
        "explanation": _ensure_string(raw_skills.get('explanation', ''))
    }

    # ── jobs ─────────────────────────────────────────────────────────────────
    raw_jobs = parsed.get('jobs', [])
    if not isinstance(raw_jobs, list):
        raw_jobs = []

    jobs = []
    for job in raw_jobs:
        if not isinstance(job, dict):
            continue

        raw_bullets = job.get('bullets', [])
        if not isinstance(raw_bullets, list):
            raw_bullets = []

        bullets = []
        for b in raw_bullets:
            if not isinstance(b, dict):
                continue
            bullets.append({
                "index": int(b.get('index', 0)),
                "original": _ensure_string(b.get('original', '')),
                "tailored": _ensure_string(b.get('tailored', '')),
                "explanation": _ensure_string(b.get('explanation', ''))
            })

        jobs.append({
            "id": str(job.get('id', '')),
            "company": str(job.get('company', '')),
            "title": str(job.get('title', '')),
            "location": job.get('location'),
            "dates": job.get('dates'),
            "bullets": bullets
        })

    # ── sections (projects, education, certifications, etc.) ─────────────────
    raw_sections = parsed.get('sections', [])
    if not isinstance(raw_sections, list):
        raw_sections = []

    sections = []
    for sec in raw_sections:
        if not isinstance(sec, dict):
            continue

        raw_entries = sec.get('entries', [])
        if not isinstance(raw_entries, list):
            raw_entries = []

        entries = []
        for entry in raw_entries:
            if not isinstance(entry, dict):
                continue

            raw_bullets = entry.get('bullets', [])
            if not isinstance(raw_bullets, list):
                raw_bullets = []

            bullets = []
            for b in raw_bullets:
                if not isinstance(b, dict):
                    continue
                bullets.append({
                    "index": int(b.get('index', 0)),
                    "original": _ensure_string(b.get('original', '')),
                    "tailored": _ensure_string(b.get('tailored', '')),
                    "explanation": _ensure_string(b.get('explanation', ''))
                })

            entries.append({
                "id": str(entry.get('id', '')),
                "bullets": bullets
            })

        sections.append({
            "sectionType": str(sec.get('section_type', 'unknown')),
            "entries": entries
        })

    return {
        "summary": summary,
        "skills": skills,
        "jobs": jobs,
        "sections": sections
    }


async def chat_with_assistant(
    message: str,
    resume_text: str,
    job_description: str,
    tailored_data: Optional[dict] = None,
    chat_history: Optional[List[dict]] = None,
    api_key: Optional[str] = None
) -> str:
    """Handle a chat message from the user in the AI Assistant sidebar."""
    client = get_openai_client(api_key)
    effective_key = api_key or os.getenv('OPENAI_API_KEY')

    if not client or not effective_key:
        return "No API key configured. Add your key in Settings to use the AI assistant."

    try:
        from services.job_analyzer import analyze_job_description
        job_analysis = analyze_job_description(job_description)

        tailoring_context = ""
        if tailored_data:
            summary_tailored = tailored_data.get('summary', {}).get('tailored', 'N/A')
            skills_tailored = tailored_data.get('skills', {}).get('tailored', 'N/A')
            total_bullets = sum(
                len(job.get('bullets', []))
                for job in tailored_data.get('jobs', [])
            )
            tailoring_context = f"""
CURRENT TAILORED RESUME STATE:
- Summary: {str(summary_tailored)[:300]}
- Skills: {str(skills_tailored)[:300]}
- Number of tailored job bullets: {total_bullets}
"""

        system_prompt = f"""You are the AI Assistant for Resume Tailor, a tool that helps job seekers optimize their resumes for specific positions.

YOUR ROLE:
- Help the user refine and improve their tailored resume
- Answer questions about why specific changes were made
- Suggest further improvements based on the job description
- Provide actionable, specific advice (not generic tips)

ORIGINAL RESUME (excerpt):
{resume_text[:1500]}

TARGET JOB DESCRIPTION (excerpt):
{job_description[:1500]}

JOB ANALYSIS:
- Key Skills: {', '.join(job_analysis.get('required_skills', [])[:10])}
- Experience Level: {job_analysis.get('experience_level', 'N/A')}
- Top Keywords: {', '.join(job_analysis.get('keywords', [])[:10])}
{tailoring_context}

RESPONSE GUIDELINES:
1. Keep responses concise and actionable — no more than 2-3 short paragraphs
2. Reference the actual job description requirements, not generic advice
3. Use plain language — avoid jargon about "ATS optimization" or "keyword density"
4. Be direct: if something in the resume is weak for this role, say so clearly
5. Format responses with line breaks for readability — avoid walls of text
6. When asked to improve a bullet point or section, ALWAYS respond in this exact format:

IMPROVED:
"[Your improved text here]"

WHY:
[1-2 sentence explanation of what changed and why]

7. Only provide ONE improved version per request
8. For general questions (not editing requests), respond conversationally without the IMPROVED/WHY format"""

        messages = [{"role": "system", "content": system_prompt}]

        if chat_history:
            for msg in chat_history[-10:]:
                role = "assistant" if msg.get("role") == "agent" else "user"
                messages.append({"role": role, "content": msg["content"]})

        messages.append({"role": "user", "content": message})

        response = await client.chat.completions.create(
            model=get_model(),
            messages=messages,
            temperature=0.7,
            max_tokens=4000
        )

        return response.choices[0].message.content

    except Exception as e:
        print(f"Error in chat: {e}")
        return "I encountered an error processing your request. Please try again."
    finally:
        await client.close()
