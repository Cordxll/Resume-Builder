# contracts/

Canonical API payload examples and a validation script for the resume tailoring app.

## Purpose

This directory documents and enforces the data contract between the FastAPI backend and the React frontend. The JSON files are ground-truth examples for the two primary API responses.

## Files

| File | Description |
|---|---|
| `tailored_response.json` | Canonical sample for `POST /api/tailor-resume` → `TailoredData` |
| `parsed_resume.json` | Canonical sample for `POST /api/parse-resume` → `ParsedResume` |
| `validate_contract.py` | Standalone validation script (no external dependencies) |

## Usage

```bash
# Validate the TailoredData sample
python contracts/validate_contract.py contracts/tailored_response.json

# Validate the ParsedResume sample
python contracts/validate_contract.py contracts/parsed_resume.json
```

Exits 0 if all checks pass, 1 if any fail.
