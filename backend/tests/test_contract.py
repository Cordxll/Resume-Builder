"""
Contract shape validation tests.

These tests assert that the output of parse_llm_response always satisfies
the TailoredData contract, regardless of what the LLM returns.
"""
import json
import pytest

from services.resume_tailor import parse_llm_response, _minimal_tailored_data
from tests.fixtures import (
    SAMPLE_LLM_RESPONSE_FULL,
    DUMMY_RESUME,
)


@pytest.fixture(scope="module")
def full_result():
    """Parse the full sample response once per module."""
    return parse_llm_response(SAMPLE_LLM_RESPONSE_FULL, DUMMY_RESUME)


class TestContractShape:

    def test_output_has_required_keys(self, full_result):
        """Output always has summary, skills, jobs, sections at the top level."""
        result = full_result
        for key in ("summary", "skills", "jobs", "sections"):
            assert key in result, f"Missing required key: {key}"

    def test_summary_has_required_fields(self, full_result):
        """summary has original, tailored, explanation as strings."""
        result = full_result
        summary = result["summary"]
        for field in ("original", "tailored", "explanation"):
            assert field in summary, f"summary missing field: {field}"
            assert isinstance(summary[field], str), (
                f"summary.{field} must be str, got {type(summary[field])}"
            )

    def test_skills_has_required_fields(self, full_result):
        """skills has original, tailored, explanation as strings."""
        result = full_result
        skills = result["skills"]
        for field in ("original", "tailored", "explanation"):
            assert field in skills, f"skills missing field: {field}"
            assert isinstance(skills[field], str), (
                f"skills.{field} must be str, got {type(skills[field])}"
            )

    def test_jobs_structure(self, full_result):
        """Each job has id, company, title, bullets (list)."""
        result = full_result
        assert isinstance(result["jobs"], list)
        for i, job in enumerate(result["jobs"]):
            assert isinstance(job, dict), f"job[{i}] must be a dict"
            for field in ("id", "company", "title", "bullets"):
                assert field in job, f"job[{i}] missing field: {field}"
            assert isinstance(job["id"], str), f"job[{i}].id must be str"
            assert isinstance(job["company"], str), f"job[{i}].company must be str"
            assert isinstance(job["title"], str), f"job[{i}].title must be str"
            assert isinstance(job["bullets"], list), f"job[{i}].bullets must be list"

    def test_bullet_structure(self, full_result):
        """Each bullet has index (int), original, tailored, explanation (all strings)."""
        result = full_result
        for i, job in enumerate(result["jobs"]):
            for j, bullet in enumerate(job["bullets"]):
                assert isinstance(bullet, dict), f"job[{i}].bullet[{j}] must be dict"
                assert "index" in bullet, f"job[{i}].bullet[{j}] missing 'index'"
                assert isinstance(bullet["index"], int), (
                    f"job[{i}].bullet[{j}].index must be int"
                )
                for field in ("original", "tailored", "explanation"):
                    assert field in bullet, f"job[{i}].bullet[{j}] missing '{field}'"
                    assert isinstance(bullet[field], str), (
                        f"job[{i}].bullet[{j}].{field} must be str"
                    )

    def test_sections_structure(self, full_result):
        """Each section has sectionType (str) and entries (list)."""
        result = full_result
        assert isinstance(result["sections"], list)
        for i, section in enumerate(result["sections"]):
            assert isinstance(section, dict), f"section[{i}] must be dict"
            assert "sectionType" in section, f"section[{i}] missing 'sectionType'"
            assert "entries" in section, f"section[{i}] missing 'entries'"
            assert isinstance(section["sectionType"], str), (
                f"section[{i}].sectionType must be str"
            )
            assert isinstance(section["entries"], list), (
                f"section[{i}].entries must be list"
            )

    def test_section_entry_structure(self, full_result):
        """Each section entry has id (str) and bullets (list)."""
        result = full_result
        for i, section in enumerate(result["sections"]):
            for j, entry in enumerate(section["entries"]):
                assert isinstance(entry, dict), (
                    f"section[{i}].entry[{j}] must be dict"
                )
                assert "id" in entry, f"section[{i}].entry[{j}] missing 'id'"
                assert "bullets" in entry, f"section[{i}].entry[{j}] missing 'bullets'"
                assert isinstance(entry["id"], str), (
                    f"section[{i}].entry[{j}].id must be str"
                )
                assert isinstance(entry["bullets"], list), (
                    f"section[{i}].entry[{j}].bullets must be list"
                )

    def test_minimal_data_valid_contract(self):
        """_minimal_tailored_data() itself satisfies the TailoredData contract."""
        result = _minimal_tailored_data()

        # Required top-level keys
        for key in ("summary", "skills", "jobs", "sections"):
            assert key in result, f"_minimal_tailored_data missing key: {key}"

        # summary fields
        for field in ("original", "tailored", "explanation"):
            assert isinstance(result["summary"][field], str)

        # skills fields
        for field in ("original", "tailored", "explanation"):
            assert isinstance(result["skills"][field], str)

        # jobs and sections are empty lists (valid)
        assert result["jobs"] == []
        assert result["sections"] == []
