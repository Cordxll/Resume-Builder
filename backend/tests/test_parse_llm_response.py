"""
Tests for parse_llm_response in services/resume_tailor.py
"""
import json
import pytest

from services.resume_tailor import parse_llm_response, _ensure_string
from tests.fixtures import (
    SAMPLE_LLM_RESPONSE_FULL,
    SAMPLE_LLM_RESPONSE_MARKDOWN,
    SAMPLE_LLM_RESPONSE_TRUNCATED,
    SAMPLE_LLM_RESPONSE_INVALID,
    EXPECTED_TAILORED_DATA,
)

DUMMY_RESUME = "Experienced engineer with Python and Java skills."


class TestParseLlmResponse:

    def test_full_valid_response(self):
        """Full valid JSON parses correctly and sectionType is camelCase in output."""
        result = parse_llm_response(SAMPLE_LLM_RESPONSE_FULL, DUMMY_RESUME)

        assert result == EXPECTED_TAILORED_DATA

        # Verify sectionType is camelCase (not section_type)
        for section in result["sections"]:
            assert "sectionType" in section
            assert "section_type" not in section

    def test_markdown_fenced_response(self):
        """Markdown fences are stripped and the payload is parsed correctly."""
        result = parse_llm_response(SAMPLE_LLM_RESPONSE_MARKDOWN, DUMMY_RESUME)

        assert result["summary"]["tailored"] == EXPECTED_TAILORED_DATA["summary"]["tailored"]
        assert result["skills"]["tailored"] == EXPECTED_TAILORED_DATA["skills"]["tailored"]
        assert len(result["jobs"]) == len(EXPECTED_TAILORED_DATA["jobs"])
        assert result["sections"][0]["sectionType"] == "projects"

    def test_truncated_json_repaired(self):
        """Truncated JSON is repaired and returns a dict with required top-level keys."""
        result = parse_llm_response(SAMPLE_LLM_RESPONSE_TRUNCATED, DUMMY_RESUME)

        # Even if repair only recovered part of the data, the shape must be correct
        assert isinstance(result, dict)
        assert "summary" in result
        assert "skills" in result
        assert "jobs" in result
        assert "sections" in result

    def test_invalid_json_returns_minimal(self):
        """Completely invalid JSON returns the minimal data shape with empty fields."""
        result = parse_llm_response(SAMPLE_LLM_RESPONSE_INVALID, DUMMY_RESUME)

        assert result["summary"] == {"original": "", "tailored": "", "explanation": ""}
        assert result["skills"] == {"original": "", "tailored": "", "explanation": ""}
        assert result["jobs"] == []
        assert result["sections"] == []

    def test_skills_list_coerced_to_string(self):
        """If skills.original or skills.tailored is a list, it is joined with ', '."""
        payload = json.dumps({
            "summary": {"original": "x", "tailored": "y", "explanation": "z"},
            "skills": {
                "original": ["Python", "Java", "SQL"],
                "tailored": ["Python", "Java", "SQL", "AWS"],
                "explanation": "Added AWS"
            },
            "jobs": [],
            "sections": []
        })
        result = parse_llm_response(payload, DUMMY_RESUME)

        assert result["skills"]["original"] == "Python, Java, SQL"
        assert result["skills"]["tailored"] == "Python, Java, SQL, AWS"

    def test_empty_sections_array(self):
        """An empty sections array in the LLM response produces an empty list in output."""
        payload = json.dumps({
            "summary": {"original": "x", "tailored": "y", "explanation": "z"},
            "skills": {"original": "Python", "tailored": "Python", "explanation": ""},
            "jobs": [],
            "sections": []
        })
        result = parse_llm_response(payload, DUMMY_RESUME)

        assert result["sections"] == []

    def test_section_type_mapping(self):
        """Input section_type (snake_case from LLM) maps to sectionType (camelCase) in output."""
        payload = json.dumps({
            "summary": {"original": "", "tailored": "", "explanation": ""},
            "skills": {"original": "", "tailored": "", "explanation": ""},
            "jobs": [],
            "sections": [
                {
                    "section_type": "projects",
                    "entries": [
                        {"id": "proj-0", "bullets": []}
                    ]
                },
                {
                    "section_type": "education",
                    "entries": [
                        {"id": "edu-0", "bullets": []}
                    ]
                }
            ]
        })
        result = parse_llm_response(payload, DUMMY_RESUME)

        assert len(result["sections"]) == 2
        assert result["sections"][0]["sectionType"] == "projects"
        assert result["sections"][1]["sectionType"] == "education"
        for section in result["sections"]:
            assert "section_type" not in section
