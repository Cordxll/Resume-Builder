#!/usr/bin/env python3
"""
validate_contract.py — Validate TailoredData or ParsedResume JSON payloads
against the expected API contract.

Usage:
    python contracts/validate_contract.py contracts/tailored_response.json
    python contracts/validate_contract.py contracts/parsed_resume.json
"""

import json
import sys


# ---------------------------------------------------------------------------
# Checker class (replaces module-level mutable state)
# ---------------------------------------------------------------------------

class Checker:
    def __init__(self) -> None:
        self.passed: list[str] = []
        self.failed: list[str] = []

    def ok(self, msg: str) -> None:
        print(f"  \u2705 {msg}")
        self.passed.append(msg)

    def fail(self, msg: str) -> None:
        print(f"  \u274c {msg}")
        self.failed.append(msg)

    def check(self, condition: bool, pass_msg: str, fail_msg: str) -> bool:
        if condition:
            self.ok(pass_msg)
        else:
            self.fail(fail_msg)
        return condition


def is_nonempty_str(val) -> bool:
    return isinstance(val, str) and bool(val.strip())


# ---------------------------------------------------------------------------
# TailoredData validation
# ---------------------------------------------------------------------------

def validate_tailored(data: dict, checks: Checker) -> None:
    print("\n[TailoredData]")

    # Top-level keys
    for key in ("summary", "skills", "jobs", "sections"):
        checks.check(key in data, f"has top-level key '{key}'", f"missing top-level key '{key}'")

    # summary
    print("\n  summary:")
    summary = data.get("summary", {})
    checks.check(isinstance(summary, dict), "summary is a dict", "summary.summary is not a dict")
    for field in ("original", "tailored", "explanation"):
        val = summary.get(field)
        checks.check(
            is_nonempty_str(val),
            f"summary.{field} is a non-empty string",
            f"summary.{field} is missing or empty (got {repr(val)})",
        )

    # skills
    print("\n  skills:")
    skills = data.get("skills", {})
    checks.check(isinstance(skills, dict), "skills is a dict", "skills is not a dict")
    for field in ("original", "tailored", "explanation"):
        val = skills.get(field)
        checks.check(
            is_nonempty_str(val),
            f"skills.{field} is a non-empty string",
            f"skills.{field} is missing or empty (got {repr(val)})",
        )

    # jobs
    print("\n  jobs:")
    jobs = data.get("jobs", [])
    checks.check(isinstance(jobs, list), "jobs is a list", f"jobs is not a list (got {type(jobs).__name__})")
    if isinstance(jobs, list):
        if not jobs:
            checks.fail("jobs must be a non-empty list")
        for i, job in enumerate(jobs):
            prefix = f"jobs[{i}]"
            checks.check(isinstance(job, dict), f"{prefix} is a dict", f"{prefix} is not a dict")
            if not isinstance(job, dict):
                continue
            for field in ("id", "company", "title"):
                val = job.get(field)
                checks.check(
                    is_nonempty_str(val),
                    f"{prefix}.{field} is a non-empty string",
                    f"{prefix}.{field} is missing or empty (got {repr(val)})",
                )
            bullets = job.get("bullets", [])
            checks.check(
                isinstance(bullets, list),
                f"{prefix}.bullets is a list",
                f"{prefix}.bullets is not a list",
            )
            if isinstance(bullets, list):
                for j, bullet in enumerate(bullets):
                    bprefix = f"{prefix}.bullets[{j}]"
                    checks.check(isinstance(bullet, dict), f"{bprefix} is a dict", f"{bprefix} is not a dict")
                    if not isinstance(bullet, dict):
                        continue
                    checks.check(
                        isinstance(bullet.get("index"), int),
                        f"{bprefix}.index is an int",
                        f"{bprefix}.index is not an int (got {repr(bullet.get('index'))})",
                    )
                    for field in ("original", "tailored", "explanation"):
                        val = bullet.get(field)
                        checks.check(
                            is_nonempty_str(val),
                            f"{bprefix}.{field} is a non-empty string",
                            f"{bprefix}.{field} is missing or empty (got {repr(val)})",
                        )

    # sections
    print("\n  sections:")
    sections = data.get("sections", [])
    checks.check(
        isinstance(sections, list),
        "sections is a list",
        f"sections is not a list (got {type(sections).__name__})",
    )
    valid_section_types = {
        "summary", "experience", "education", "skills", "certifications",
        "projects", "awards", "volunteer", "languages", "contact", "unknown",
    }
    if isinstance(sections, list):
        for i, sec in enumerate(sections):
            sprefix = f"sections[{i}]"
            checks.check(isinstance(sec, dict), f"{sprefix} is a dict", f"{sprefix} is not a dict")
            if not isinstance(sec, dict):
                continue
            st = sec.get("sectionType")
            checks.check(
                isinstance(st, str) and bool(st),
                f"{sprefix}.sectionType is a non-empty string",
                f"{sprefix}.sectionType is missing or empty (got {repr(st)})",
            )
            if isinstance(st, str):
                checks.check(
                    st in valid_section_types,
                    f"{sprefix}.sectionType '{st}' is a valid type",
                    f"{sprefix}.sectionType '{st}' is not a recognised type",
                )
            entries = sec.get("entries")
            checks.check(
                isinstance(entries, list),
                f"{sprefix}.entries is a list",
                f"{sprefix}.entries is not a list (got {repr(entries)})",
            )
            if isinstance(entries, list):
                for k, entry in enumerate(entries):
                    eprefix = f"{sprefix}.entries[{k}]"
                    checks.check(
                        isinstance(entry, dict),
                        f"{eprefix} is a dict",
                        f"{eprefix} is not a dict",
                    )
                    if not isinstance(entry, dict):
                        continue
                    bullets = entry.get("bullets")
                    checks.check(
                        isinstance(bullets, list),
                        f"{eprefix}.bullets is a list",
                        f"{eprefix}.bullets is not a list (got {repr(bullets)})",
                    )
                    if isinstance(bullets, list):
                        for j, bullet in enumerate(bullets):
                            bprefix = f"{eprefix}.bullets[{j}]"
                            checks.check(
                                isinstance(bullet, dict),
                                f"{bprefix} is a dict",
                                f"{bprefix} is not a dict",
                            )
                            if not isinstance(bullet, dict):
                                continue
                            checks.check(
                                isinstance(bullet.get("index"), int),
                                f"{bprefix}.index is an int",
                                f"{bprefix}.index is not an int (got {repr(bullet.get('index'))})",
                            )
                            for field in ("original", "tailored", "explanation"):
                                val = bullet.get(field)
                                checks.check(
                                    is_nonempty_str(val),
                                    f"{bprefix}.{field} is a non-empty string",
                                    f"{bprefix}.{field} is missing or empty (got {repr(val)})",
                                )


# ---------------------------------------------------------------------------
# ParsedResume validation
# ---------------------------------------------------------------------------

def validate_parsed(data: dict, checks: Checker) -> None:
    print("\n[ParsedResume]")

    # Top-level keys
    for key in ("sections", "contact", "raw_text"):
        checks.check(key in data, f"has top-level key '{key}'", f"missing top-level key '{key}'")

    # contact
    print("\n  contact:")
    contact = data.get("contact", {})
    checks.check(isinstance(contact, dict), "contact is a dict", "contact is not a dict")
    if isinstance(contact, dict):
        # Required fields: must be present and non-empty strings
        for field in ("name", "email"):
            present = field in contact
            if present:
                val = contact[field]
                checks.check(
                    isinstance(val, str) and bool(val.strip()),
                    f"contact.{field} is a non-empty string",
                    f"contact.{field} is empty or not a string (got {repr(val)})",
                )
            else:
                checks.fail(f"contact.{field} key missing")
        # Optional fields: presence-only check
        for field in ("phone", "linkedin", "github", "website"):
            checks.check(
                field in contact,
                f"contact.{field} key present",
                f"contact.{field} key missing",
            )

    # raw_text
    print("\n  raw_text:")
    checks.check(
        isinstance(data.get("raw_text"), str),
        "raw_text is a string",
        f"raw_text is not a string (got {type(data.get('raw_text')).__name__})",
    )

    # sections
    print("\n  sections:")
    sections = data.get("sections", [])
    checks.check(isinstance(sections, list), "sections is a list", "sections is not a list")
    if not isinstance(sections, list):
        return

    valid_types = {
        "summary", "experience", "education", "skills", "certifications",
        "projects", "awards", "volunteer", "languages", "contact", "unknown",
    }

    for i, sec in enumerate(sections):
        sprefix = f"sections[{i}]"
        checks.check(isinstance(sec, dict), f"{sprefix} is a dict", f"{sprefix} is not a dict")
        if not isinstance(sec, dict):
            continue

        # Every section: type, rawLabel, confidence
        sec_type = sec.get("type")
        checks.check(
            isinstance(sec_type, str) and sec_type in valid_types,
            f"{sprefix}.type '{sec_type}' is valid",
            f"{sprefix}.type '{sec_type}' is missing or not a recognised type",
        )
        checks.check(
            isinstance(sec.get("rawLabel"), str),
            f"{sprefix}.rawLabel is a string",
            f"{sprefix}.rawLabel is missing or not a string",
        )
        conf = sec.get("confidence")
        checks.check(
            isinstance(conf, (int, float)) and 0.0 <= conf <= 1.0,
            f"{sprefix}.confidence {conf} is a float in [0,1]",
            f"{sprefix}.confidence {repr(conf)} is out of range or not numeric",
        )

        # Type-specific checks
        if sec_type == "experience":
            jobs = sec.get("jobs")
            checks.check(
                isinstance(jobs, list),
                f"{sprefix}.jobs is a list",
                f"{sprefix} (experience) missing 'jobs' list",
            )
            if isinstance(jobs, list):
                for j, job in enumerate(jobs):
                    jprefix = f"{sprefix}.jobs[{j}]"
                    checks.check(isinstance(job, dict), f"{jprefix} is a dict", f"{jprefix} is not a dict")
                    if not isinstance(job, dict):
                        continue
                    for field in ("id", "company", "title"):
                        checks.check(
                            field in job,
                            f"{jprefix}.{field} key present",
                            f"{jprefix}.{field} key missing",
                        )
                    checks.check(
                        isinstance(job.get("bullets"), list),
                        f"{jprefix}.bullets is a list",
                        f"{jprefix}.bullets is not a list",
                    )

        elif sec_type in ("summary", "skills"):
            checks.check(
                is_nonempty_str(sec.get("content")),
                f"{sprefix}.content is a non-empty string",
                f"{sprefix} ({sec_type}) has missing or empty 'content'",
            )

        elif sec_type in ("education", "projects", "certifications", "awards"):
            checks.check(
                isinstance(sec.get("entries"), list),
                f"{sprefix}.entries is a list",
                f"{sprefix} ({sec_type}) missing 'entries' list",
            )


# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------

def detect_and_validate(data: dict, checks: Checker) -> None:
    """Detect payload type and dispatch to the appropriate validator."""
    # TailoredData: top-level "jobs" key (list of job objects)
    if "jobs" in data and isinstance(data.get("jobs"), list):
        validate_tailored(data, checks)
    # ParsedResume: "sections" where items have a "type" field
    elif "sections" in data and isinstance(data.get("sections"), list):
        sections = data["sections"]
        if sections and isinstance(sections[0], dict) and "type" in sections[0]:
            validate_parsed(data, checks)
        elif not sections:
            # Empty sections — fall back to ParsedResume if "contact" present
            if "contact" in data or "raw_text" in data:
                validate_parsed(data, checks)
            else:
                print("ERROR: Cannot determine payload type (empty sections, no contact/raw_text).")
                sys.exit(2)
        else:
            print("ERROR: Cannot determine payload type.")
            sys.exit(2)
    else:
        print("ERROR: Cannot determine payload type (no 'jobs' list or 'sections' list found).")
        sys.exit(2)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python validate_contract.py <path-to-json-file>")
        sys.exit(2)

    path = sys.argv[1]
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"ERROR: File not found: {path}")
        sys.exit(2)
    except json.JSONDecodeError as exc:
        print(f"ERROR: Invalid JSON in {path}: {exc}")
        sys.exit(2)

    checks = Checker()

    print(f"Validating: {path}")
    detect_and_validate(data, checks)

    print()
    total_passed = len(checks.passed)
    total_failed = len(checks.failed)

    if total_failed == 0:
        print(f"Contract validation: PASSED ({total_passed} checks)")
        sys.exit(0)
    else:
        print(f"Contract validation: FAILED ({total_passed} passed, {total_failed} failed)")
        sys.exit(1)


if __name__ == "__main__":
    main()
