"""Resume parser module — uses LLM to extract structured data from resumes."""
import json
import os
import logging
from pathlib import Path
from typing import Dict, List, Optional, Union
from docx import Document
from PyPDF2 import PdfReader

from services.openai_client import get_openai_client, get_model

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Text extraction (file → raw string)
# ---------------------------------------------------------------------------

def extract_text_from_file(file_path: Union[str, Path]) -> str:
    """Extract text from DOCX or PDF file."""
    file_path = Path(file_path)
    suffix = file_path.suffix.lower()

    if suffix == '.docx':
        doc = Document(file_path)
        return '\n'.join(p.text for p in doc.paragraphs)
    elif suffix == '.pdf':
        reader = PdfReader(file_path)
        return '\n'.join(page.extract_text() for page in reader.pages)
    else:
        raise ValueError(f"Unsupported file format: {suffix}")


# ---------------------------------------------------------------------------
# LLM-powered resume parsing (sole parser)
# ---------------------------------------------------------------------------

async def parse_resume_with_llm(
    file_path_or_text: str,
    is_text: bool = False,
    api_key: Optional[str] = None,
) -> Dict[str, any]:
    """
    Parse resume using the LLM.

    Args:
        file_path_or_text: File path or text content
        is_text: True if source is text content, False if file path
        api_key: Optional API key (overrides env var)

    Returns:
        Dictionary with keys: contact, sections, raw_text

    Raises:
        RuntimeError: If LLM parsing fails (no key, bad response, etc.)
    """
    logger.info(f"parse_resume_with_llm called: is_text={is_text}")

    try:
        text = file_path_or_text if is_text else extract_text_from_file(file_path_or_text)
        logger.info(f"Text extracted: {len(text)} chars")
    except Exception as e:
        logger.error(f"Text extraction failed: {e}")
        raise RuntimeError(f"Failed to extract text from file: {e}")

    client = get_openai_client(api_key)
    effective_key = api_key or os.getenv('OPENAI_API_KEY')

    if not client or not effective_key:
        raise RuntimeError(
            "No API key configured. Add your key in Settings or set OPENAI_API_KEY in .env"
        )

    model = get_model()
    logger.info(f"Using model: {model}")

    try:
        truncated_text = text[:12000]
        user_prompt = _build_parsing_prompt(truncated_text)

        logger.info("Sending request to LLM...")
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a strict JSON-only resume parser. "
                        "Your sole output is a single valid JSON object — no markdown fences, "
                        "no explanatory text, no trailing comments. "
                        "Extract information exactly as it appears in the resume; never invent, "
                        "paraphrase, or hallucinate content. "
                        "Use semantic understanding to classify section headings: "
                        "'Work History' → experience, 'Technical Expertise' → skills, "
                        "'Academic Background' → education, and so on. "
                        "When a section's purpose is ambiguous, set type to 'unknown' and "
                        "confidence below 0.7. "
                        "Return ONLY the JSON object described in the user message."
                    ),
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
            temperature=0.1,
            max_tokens=16000,
        )

        raw_response = response.choices[0].message.content
        finish_reason = response.choices[0].finish_reason
        logger.info(
            f"LLM response received: {len(raw_response) if raw_response else 0} chars, "
            f"finish_reason={finish_reason}"
        )

        parsed = _parse_llm_json(raw_response)

        if parsed is None:
            logger.error(
                f"Failed to parse LLM response: {raw_response[:500] if raw_response else 'empty'}"
            )
            raise RuntimeError("LLM returned unparseable response")

        logger.info("Resume parsing completed successfully")
        return _normalize_llm_result(parsed, text)

    except RuntimeError:
        raise
    except Exception as e:
        logger.error(f"LLM resume parsing failed: {e}")
        raise RuntimeError(f"LLM resume parsing failed: {e}")
    finally:
        await client.close()


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

def _build_parsing_prompt(resume_text: str) -> str:
    """Build the LLM prompt with the exact output schema."""
    return f"""Extract all information from the resume below and return it as a single JSON object
matching the schema described here. Do NOT include any text outside the JSON object.

REQUIRED OUTPUT SCHEMA:
{{
  "contact": {{
    "name": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "linkedin": "string or null",
    "github": "string or null",
    "website": "string or null"
  }},
  "sections": [
    {{
      "type": "<one of: summary | experience | education | skills | certifications | projects | awards | volunteer | languages | contact | unknown>",
      "raw_label": "<exact heading text from the resume, e.g. 'Work History'>",
      "confidence": <float 0.0–1.0 indicating how certain you are about the type mapping>,

      // For type == "summary":
      "content": "Full summary/objective/profile text verbatim"

      // For type == "experience":
      // "jobs" array — one entry per distinct position, ordered as they appear
      "jobs": [
        {{
          "company": "Company name",
          "title": "Job title",
          "location": "City, ST or Remote or null",
          "dates": "Date range string exactly as written, e.g. 'Jan 2020 – Present'",
          "bullets": [
            {{"text": "Bullet text verbatim", "index": 0}},
            {{"text": "Bullet text verbatim", "index": 1}}
          ]
        }}
      ]

      // For type == "education":
      // "entries" array — one entry per institution
      "entries": [
        {{
          "institution": "School name",
          "degree": "Degree type e.g. B.S.",
          "field": "Field of study",
          "dates": "Date range or graduation year",
          "bullets": []
        }}
      ]

      // For type == "skills":
      "content": "Full skills text verbatim (may be comma-separated, grouped, etc.)"

      // For type == "projects":
      // "entries" array — one entry per project
      "entries": [
        {{
          "name": "Project name",
          "dates": "Date or date range, or null",
          "description": "Optional short description or null",
          "bullets": [
            {{"text": "Bullet text verbatim", "index": 0}}
          ]
        }}
      ]

      // For type == "certifications":
      // "entries" array — one entry per certification
      "entries": [
        {{
          "name": "Certification name",
          "issuer": "Issuing organisation or null",
          "date": "Date or null",
          "bullets": []
        }}
      ]

      // For type == "awards":
      // "entries" array — one entry per award
      "entries": [
        {{
          "name": "Award name",
          "issuer": "Issuing organisation or null",
          "date": "Date or null",
          "bullets": []
        }}
      ]

      // For type == "volunteer" | "languages" | "contact" | "unknown":
      // Use "content" with the verbatim section text
      "content": "Verbatim section text"
    }}
  ]
}}

SEMANTIC MAPPING RULES (non-exhaustive — use your judgment for unlisted headings):
- "Work History", "Employment History", "Professional Experience", "Career History" → experience
- "Technical Skills", "Core Competencies", "Technical Expertise", "Key Skills" → skills
- "Academic Background", "Academic History", "Degrees" → education
- "Licenses & Certifications", "Professional Certifications" → certifications
- "Personal Projects", "Open Source", "Portfolio" → projects
- "Honors", "Achievements", "Awards & Recognition" → awards
- "Community Involvement", "Volunteering" → volunteer
- If a section's purpose is genuinely ambiguous → unknown, confidence < 0.7

ADDITIONAL RULES:
1. Extract information EXACTLY as written — do not paraphrase or rewrite.
2. Omit sections entirely if they are not present in the resume.
3. Set confidence = 1.0 for headings that exactly match a canonical type name.
4. Set confidence between 0.7 and 0.99 for headings that are clearly mappable with semantics.
5. Set confidence < 0.7 and type = "unknown" for genuinely ambiguous sections.
6. IDs (job-0, edu-0, etc.) will be assigned by the caller — do NOT include "id" fields in your output.
7. Return ONLY the JSON object — no markdown, no explanation.

RESUME TEXT:
{resume_text}"""


# ---------------------------------------------------------------------------
# JSON parsing & repair (unchanged from original)
# ---------------------------------------------------------------------------

def _parse_llm_json(raw: str) -> Optional[Dict]:
    """Attempt to parse JSON from LLM response, handling common issues."""
    if not raw:
        return None

    cleaned = raw.strip()

    # Strip markdown code fences if present
    if cleaned.startswith("```"):
        first_newline = cleaned.find('\n')
        if first_newline != -1:
            cleaned = cleaned[first_newline + 1:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    # Try direct parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try extracting JSON object
    start = cleaned.find('{')
    if start != -1:
        end = cleaned.rfind('}')
        if end > start:
            try:
                return json.loads(cleaned[start:end + 1])
            except json.JSONDecodeError:
                pass

        # Truncated JSON recovery: close open brackets/braces
        fragment = cleaned[start:]
        repaired = _repair_truncated_json(fragment)
        if repaired:
            logger.warning("Recovered truncated JSON response from LLM")
            return repaired

    return None


def _repair_truncated_json(fragment: str) -> Optional[Dict]:
    """Try to repair truncated JSON by closing open brackets and braces."""
    # Track nesting to figure out what needs closing
    in_string = False
    escape_next = False
    stack = []  # track open { and [

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
        # Already balanced, try parse
        try:
            return json.loads(fragment)
        except json.JSONDecodeError:
            return None

    # Close any open string, then close brackets in reverse order
    suffix = ""
    # If we ended inside a string, close it
    if in_string:
        suffix += '"'

    # Close open containers in reverse
    for opener in reversed(stack):
        if opener == '{':
            suffix += '}'
        else:
            suffix += ']'

    # Try multiple repair strategies
    for attempt_suffix in [suffix, '""' + suffix, 'null' + suffix]:
        try:
            return json.loads(fragment + attempt_suffix)
        except json.JSONDecodeError:
            continue

    return None


# ---------------------------------------------------------------------------
# Normalisation — maps raw LLM output to the guaranteed return shape
# ---------------------------------------------------------------------------

# Valid canonical section types
_VALID_TYPES = frozenset({
    "summary", "experience", "education", "skills",
    "certifications", "projects", "awards",
    "volunteer", "languages", "contact", "unknown",
})

# ID prefix for each type that has structured entries
_ID_PREFIXES: Dict[str, str] = {
    "experience": "job",
    "education": "edu",
    "projects": "proj",
    "certifications": "cert",
    "awards": "award",
}


def _normalize_contact(raw: any) -> Dict[str, Optional[str]]:
    """Return a fully-populated contact dict with null for missing fields."""
    if not isinstance(raw, dict):
        raw = {}
    fields = ("name", "email", "phone", "linkedin", "github", "website")
    return {f: raw.get(f) or None for f in fields}


def _normalize_bullets(raw: any) -> List[Dict]:
    """Normalise a bullets list to [{text, index}, …]."""
    if not isinstance(raw, list):
        return []
    result = []
    for i, item in enumerate(raw):
        if isinstance(item, dict):
            result.append({
                "text": str(item.get("text", "")),
                "index": int(item.get("index", i)),
            })
        elif isinstance(item, str) and item:
            result.append({"text": item, "index": i})
    return result


def _normalize_jobs(raw_jobs: any, section_counters: Dict[str, int]) -> List[Dict]:
    """Normalise the jobs list for an experience section, assigning stable IDs."""
    if not isinstance(raw_jobs, list):
        return []
    result = []
    for job in raw_jobs:
        if not isinstance(job, dict):
            continue
        idx = section_counters.get("job", 0)
        section_counters["job"] = idx + 1
        result.append({
            "id": f"job-{idx}",
            "company": job.get("company") or "",
            "title": job.get("title") or "",
            "location": job.get("location") or None,
            "dates": job.get("dates") or "",
            "bullets": _normalize_bullets(job.get("bullets")),
        })
    return result


def _normalize_edu_entries(raw_entries: any, section_counters: Dict[str, int]) -> List[Dict]:
    """Normalise education entries, assigning stable IDs."""
    if not isinstance(raw_entries, list):
        return []
    result = []
    for entry in raw_entries:
        if not isinstance(entry, dict):
            continue
        idx = section_counters.get("edu", 0)
        section_counters["edu"] = idx + 1
        result.append({
            "id": f"edu-{idx}",
            "institution": entry.get("institution") or "",
            "degree": entry.get("degree") or None,
            "field": entry.get("field") or None,
            "dates": entry.get("dates") or None,
            "bullets": _normalize_bullets(entry.get("bullets")),
        })
    return result


def _normalize_project_entries(raw_entries: any, section_counters: Dict[str, int]) -> List[Dict]:
    """Normalise project entries, assigning stable IDs."""
    if not isinstance(raw_entries, list):
        return []
    result = []
    for entry in raw_entries:
        if not isinstance(entry, dict):
            continue
        idx = section_counters.get("proj", 0)
        section_counters["proj"] = idx + 1
        result.append({
            "id": f"proj-{idx}",
            "name": entry.get("name") or "",
            "dates": entry.get("dates") or None,
            "description": entry.get("description") or None,
            "bullets": _normalize_bullets(entry.get("bullets")),
        })
    return result


def _normalize_cert_entries(raw_entries: any, section_counters: Dict[str, int]) -> List[Dict]:
    """Normalise certification entries, assigning stable IDs."""
    if not isinstance(raw_entries, list):
        return []
    result = []
    for entry in raw_entries:
        if not isinstance(entry, dict):
            continue
        idx = section_counters.get("cert", 0)
        section_counters["cert"] = idx + 1
        result.append({
            "id": f"cert-{idx}",
            "name": entry.get("name") or "",
            "issuer": entry.get("issuer") or None,
            "date": entry.get("date") or None,
            "bullets": _normalize_bullets(entry.get("bullets")),
        })
    return result


def _normalize_award_entries(raw_entries: any, section_counters: Dict[str, int]) -> List[Dict]:
    """Normalise award entries, assigning stable IDs."""
    if not isinstance(raw_entries, list):
        return []
    result = []
    for entry in raw_entries:
        if not isinstance(entry, dict):
            continue
        idx = section_counters.get("award", 0)
        section_counters["award"] = idx + 1
        result.append({
            "id": f"award-{idx}",
            "name": entry.get("name") or "",
            "issuer": entry.get("issuer") or None,
            "date": entry.get("date") or None,
            "bullets": _normalize_bullets(entry.get("bullets")),
        })
    return result


def _normalize_section(raw_section: Dict, section_counters: Dict[str, int]) -> Optional[Dict]:
    """
    Normalise a single section dict from the LLM output.

    Returns a normalised section dict, or None if the input is not a valid dict.
    """
    if not isinstance(raw_section, dict):
        return None

    # Resolve type
    raw_type = str(raw_section.get("type", "unknown")).lower().strip()
    sec_type = raw_type if raw_type in _VALID_TYPES else "unknown"

    # Resolve confidence
    try:
        confidence = float(raw_section.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))
    except (TypeError, ValueError):
        confidence = 0.5

    # If type was not in valid set, lower confidence
    if raw_type not in _VALID_TYPES and confidence >= 0.7:
        confidence = 0.5

    raw_label = str(raw_section.get("raw_label", sec_type))

    base = {
        "type": sec_type,
        "raw_label": raw_label,
        "confidence": confidence,
    }

    if sec_type == "summary":
        base["content"] = str(raw_section.get("content", ""))

    elif sec_type == "experience":
        base["jobs"] = _normalize_jobs(raw_section.get("jobs", []), section_counters)

    elif sec_type == "education":
        base["entries"] = _normalize_edu_entries(
            raw_section.get("entries", []), section_counters
        )

    elif sec_type == "skills":
        base["content"] = str(raw_section.get("content", ""))

    elif sec_type == "projects":
        base["entries"] = _normalize_project_entries(
            raw_section.get("entries", []), section_counters
        )

    elif sec_type == "certifications":
        base["entries"] = _normalize_cert_entries(
            raw_section.get("entries", []), section_counters
        )

    elif sec_type == "awards":
        base["entries"] = _normalize_award_entries(
            raw_section.get("entries", []), section_counters
        )

    else:
        # summary, volunteer, languages, contact, unknown — plain content
        base["content"] = str(raw_section.get("content", ""))

    return base


def _normalize_llm_result(parsed: Dict, original_text: str) -> Dict[str, any]:
    """Normalise LLM output to the guaranteed return shape: {contact, sections, raw_text}."""
    contact = _normalize_contact(parsed.get("contact"))

    raw_sections = parsed.get("sections", [])
    if not isinstance(raw_sections, list):
        raw_sections = []

    # Shared counters so IDs are unique across all sections of the same type
    section_counters: Dict[str, int] = {}

    sections: List[Dict] = []
    for raw_sec in raw_sections:
        normalised = _normalize_section(raw_sec, section_counters)
        if normalised is not None:
            sections.append(normalised)

    return {
        "contact": contact,
        "sections": sections,
        "raw_text": original_text,
    }
