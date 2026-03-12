# Fix Data Contracts and Blank Page

## Problem Summary

- **`raw_label` / `rawLabel` mismatch**: The `contracts/parsed_resume.json` contract and frontend types expect `rawLabel` (camelCase), but the backend `resume_parser.py` does not produce a `raw_label` or `rawLabel` field at all. The actual backend output is a flat dict of `{content, bullets}` per section -- not an array of typed section objects. `ResumePreview.tsx` reads `section.rawLabel` on lines 429, 473, 512, 602, 689, 772, 871, 964, which is always `undefined`, causing fallback strings to be used and custom section headings to be silently lost.
- **Blank workspace from empty tailored data**: When the LLM fails, `_minimal_tailored_data()` (`resume_tailor.py` line 238) returns empty strings and empty arrays. `ResumePreview.tsx` line 423 (`if (!summaryText.trim()) return null`) and line 467 (`if (!skillsText.trim()) return null`) hide all sections, resulting in a completely blank workspace with no user feedback.
- **`App.tsx` `return null` blank page**: `App.tsx` line 310-312 returns `null` (blank DOM) when `resume` or `tailoredData` is missing in workspace view -- no loading indicator, no error message, no way to recover.
- **Job ID correlation not validated**: `ResumePreview.tsx` line 518 does `tailoredData.jobs?.find(j => j.id === job.id)` which fails silently if LLM-generated job IDs don't match parsed resume job IDs. No contract enforces ID matching.

## Prerequisites

- Working on the `contract-validation` worktree at `/Users/cordell/source/Resume-Builder/.worktrees/contract-validation`
- The worktree already contains `contracts/` with `parsed_resume.json`, `tailored_response.json`, `validate_contract.py`
- `frontend/src/utils/validateApiResponse.ts` exists and needs updating as part of this plan
- `backend/tests/test_contract.py` and `backend/tests/fixtures.py` exist with initial contract tests

---

## Phase 1: Fix Data Contracts (ground truth)

Establish the contracts as the single source of truth for what the backend actually returns.

### Task 1: Update `contracts/parsed_resume.json` to match actual backend output

**What to change**: The current contract uses `rawLabel` (camelCase) and describes an array-of-sections structure with typed objects (`{type, rawLabel, confidence, content}`). The actual backend (`resume_parser.py` `extract_sections()` on line 56) returns a flat dict: `{contact: {name, email, phone, linkedin}, summary: {content, bullets}, experience: {content, bullets}, ...}`. The parse endpoint (`main.py` line 56-59) wraps this as `{raw_text, sections: <that flat dict>}`.

The contract must be rewritten to reflect the actual backend output shape. Use `raw_label` (snake_case) in any section metadata if the LLM-parsed pipeline is being targeted, OR document the flat dict shape if we're documenting what the regex parser actually returns.

**Decision**: Since the frontend expects the structured format (array of typed sections), and the contract should document the **target API shape** that both sides agree on, update the contract to use `raw_label` (snake_case) as the backend convention. The frontend transformation layer (Task 4) will convert to `rawLabel`.

**Files**:
- `contracts/parsed_resume.json` (lines 1-88) -- rewrite entirely

**Acceptance criteria**:
- Contract JSON uses `raw_label` (snake_case) consistently
- Contract matches the structure the backend will produce after Task 6 adds Pydantic models
- Running `python contracts/validate_contract.py contracts/parsed_resume.json` exits 0

**Complexity**: 1-file change

---

### Task 2: Create `contracts/job_analysis.json`

**What to change**: The `/api/analyze-job` endpoint (`main.py` line 84-91) calls `analyze_job_description()` from `job_analyzer.py` (line 6-22), which returns `{keywords: string[], required_skills: string[], preferred_skills: string[], experience_level: string, key_responsibilities: string[]}`. No contract exists for this.

**Files**:
- `contracts/job_analysis.json` -- new file

**Contents**: A sample JSON payload matching the return shape of `analyze_job_description()` (`job_analyzer.py` line 16-22):
```json
{
  "keywords": ["python", "react", "aws", ...],
  "required_skills": ["python", "react", ...],
  "preferred_skills": ["kubernetes", "terraform", ...],
  "experience_level": "Mid-level",
  "key_responsibilities": ["Design and implement scalable APIs", ...]
}
```

**Acceptance criteria**:
- File exists at `contracts/job_analysis.json`
- Shape matches `job_analyzer.py` return value
- `validate_contract.py` can detect and validate it (see Task 3)

**Complexity**: 1-file change (new file)

---

### Task 3: Update `contracts/validate_contract.py` to handle job analysis and fix `raw_label`

**What to change**:
1. `validate_parsed()` (line 268-272) checks for `rawLabel` -- change to check for `raw_label` (snake_case) to match the updated contract
2. Add a new `validate_job_analysis()` function that checks for `keywords` (list of strings), `required_skills` (list of strings), `preferred_skills` (list of strings), `experience_level` (string), `key_responsibilities` (list of strings)
3. Update `detect_and_validate()` (line 325-347) to detect job analysis payloads (has `keywords` and `required_skills` top-level keys)

**Files**:
- `contracts/validate_contract.py` (lines 268-272 for `rawLabel` fix, lines 325-347 for detection, new function for job analysis)

**Acceptance criteria**:
- `python contracts/validate_contract.py contracts/parsed_resume.json` passes (uses `raw_label`)
- `python contracts/validate_contract.py contracts/job_analysis.json` passes
- `python contracts/validate_contract.py contracts/tailored_response.json` still passes

**Complexity**: 1-file change

---

## Phase 2: Fix the Data Pipeline (transform at boundary)

Fix the frontend to correctly transform backend responses and validate them.

### Task 4: Transform `raw_label` to `rawLabel` in `api.ts` `parseResume()`

**What to change**: In `frontend/src/services/api.ts` lines 40-54, the `parseResume()` function receives the raw backend response and maps it to the `ParsedResume` interface. After the existing mapping logic (lines 46-54), add a transformation step that maps each section's `raw_label` to `rawLabel`.

Add after line 52 (inside the return block):
```typescript
sections: Array.isArray(parsed.sections)
  ? parsed.sections.map((s: any) => ({
      ...s,
      rawLabel: s.rawLabel ?? s.raw_label ?? s.type ?? 'Unknown',
    }))
  : [],
```

This handles both cases: backend already sends `rawLabel` (future) or sends `raw_label` (current contract).

**Files**:
- `frontend/src/services/api.ts` (lines 50-54)

**Acceptance criteria**:
- `parseResume()` output always has `rawLabel` on every section object
- Existing `raw_label` from backend is transformed; `rawLabel` is preserved if already present
- TypeScript compiles without errors

**Complexity**: 1-file change

---

### Task 5: Update `validateParsedResume()` to check `raw_label` pre-transform and `rawLabel` post-transform

**What to change**: In `frontend/src/utils/validateApiResponse.ts` line 116, the validator checks `sec.rawLabel` but the raw response will have `raw_label`. Split validation into two steps:

1. **Pre-transform validation** (called on raw response): check for `raw_label` (snake_case) OR `rawLabel` (camelCase) -- either is acceptable from the backend
2. **Post-transform validation** (optional, for defense-in-depth): verify `rawLabel` is present after the transform in `api.ts`

Update `validateParsedResume()` to accept both `raw_label` and `rawLabel`:
```typescript
if (!isString(sec.rawLabel) && !isString((sec as any).raw_label)) {
  warn(T, `sections[${i}].rawLabel`, sec.rawLabel);
}
```

**Files**:
- `frontend/src/utils/validateApiResponse.ts` (line 116)

**Acceptance criteria**:
- No warning logged when backend sends `raw_label` (snake_case)
- No warning logged when data already has `rawLabel` (camelCase)
- Warning still logged when neither field is present

**Complexity**: 1-file change

---

### Task 6: Add backend Pydantic response models

**What to change**: `backend/main.py` returns raw dicts from all endpoints with no schema enforcement. Add Pydantic `response_model` definitions to enforce the contract at the source.

Add the following models to `main.py` (or a new `backend/models.py` file):

```python
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ContactInfo(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    website: Optional[str] = None

class SectionContent(BaseModel):
    content: str = ""
    bullets: List[str] = []

class ParsedResumeResponse(BaseModel):
    raw_text: str = ""
    filename: Optional[str] = None
    sections: Dict[str, Any]  # flat dict of section_name -> SectionContent
    contact: Optional[ContactInfo] = None

class JobAnalysisResponse(BaseModel):
    keywords: List[str] = []
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    experience_level: str = "Not specified"
    key_responsibilities: List[str] = []
```

Then update the endpoint decorators:
- `@app.post("/api/parse-resume", response_model=ParsedResumeResponse)` (line 47)
- `@app.post("/api/analyze-job", response_model=JobAnalysisResponse)` (line 84)

**Note**: The `parse_resume()` function (`resume_parser.py` line 56-73) returns a flat dict where `sections` contains sub-dicts like `contact`, `summary`, `experience`, etc. The current endpoint (`main.py` line 56-59) nests this as `{raw_text, sections: <flat dict>}`. The Pydantic model should reflect this actual shape. The contact info is extracted inside the `sections` dict by `extract_sections()` (line 63), so the endpoint currently returns `{raw_text, sections: {contact: {...}, summary: {...}, ...}}`. The model should match this.

**Files**:
- `backend/main.py` (lines 1-7 for imports, lines 27-39 for model additions, lines 47 and 84 for response_model)
- OR create `backend/models.py` and import from there

**Acceptance criteria**:
- FastAPI auto-generates OpenAPI schema matching the contract
- Invalid response shapes raise FastAPI validation errors instead of silently passing
- All existing endpoints still work (backward compatible)
- `GET /docs` shows the response schemas

**Complexity**: 1-2 file change

---

## Phase 3: Fix Error Display (user-visible)

Replace blank pages and silent failures with actionable user feedback.

### Task 7: Fix `App.tsx` blank page guard

**What to change**: Replace `App.tsx` lines 310-312:
```typescript
if (!resume || !tailoredData) {
  return null;
}
```

With a proper error/recovery UI:
```tsx
if (!resume || !tailoredData) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-dark-bg text-text-primary gap-4">
      <p className="text-text-secondary">Something went wrong loading your session.</p>
      <button
        onClick={navigateToUpload}
        className="px-4 py-2 bg-accent-blue text-dark-bg rounded-lg hover:bg-opacity-90"
      >
        Start Over
      </button>
    </div>
  );
}
```

Ensure `navigateToUpload` (or equivalent function from `useAppContext`) is available in scope. Check how `onBack` works in `AppShell` -- it calls a similar navigation function.

**Files**:
- `frontend/src/App.tsx` (lines 310-312)

**Acceptance criteria**:
- When `resume` or `tailoredData` is null in workspace view, user sees "Something went wrong" message with a "Start Over" button
- Clicking "Start Over" navigates to upload page
- No blank white screen ever

**Complexity**: 1-file change

---

### Task 8: Add empty-data detection in workspace

**What to change**: In `CenterPanel.tsx` (line 40-62) or `ResumePreview.tsx`, detect when `tailoredData` has empty content indicating LLM failure. Specifically check:
- `tailoredData.summary.tailored` is empty string
- `tailoredData.skills.tailored` is empty string
- `tailoredData.jobs` is an empty array

When all three are true (matching `_minimal_tailored_data()` shape from `resume_tailor.py` line 238-253), show a warning banner.

Add to `CenterPanel.tsx` before the `<ResumePreview>` render:
```tsx
const isEmptyTailoring = !tailoredData.summary?.tailored?.trim()
  && !tailoredData.skills?.tailored?.trim()
  && (!tailoredData.jobs || tailoredData.jobs.length === 0);

if (isEmptyTailoring) {
  return (
    <div className="h-full flex items-center justify-center px-8">
      <div className="text-center max-w-md">
        <p className="text-accent-yellow text-lg font-medium mb-2">
          The AI couldn't process your resume
        </p>
        <p className="text-text-secondary text-sm">
          Try again or check your API key in Settings.
        </p>
      </div>
    </div>
  );
}
```

**Files**:
- `frontend/src/components/layout/CenterPanel.tsx` (lines 40-62)

**Acceptance criteria**:
- When LLM fails and `_minimal_tailored_data()` is returned, user sees yellow warning
- When LLM succeeds (non-empty tailored data), normal resume preview renders
- Warning mentions checking API key

**Complexity**: 1-file change

---

### Task 9: Add error state to UploadPage for empty parse results

**What to change**: In `UploadPage.tsx`, after calling `api.parseResume()`, check if the result has zero usable sections. The current backend returns sections as a flat dict where each value has `{content, bullets}`. If all sections have empty content, the parse failed.

Find the code that calls `api.parseResume()` and add a check after it returns:
```typescript
const hasContent = parsed.sections && (
  Array.isArray(parsed.sections)
    ? parsed.sections.length > 0
    : Object.values(parsed.sections).some((s: any) => s?.content?.trim())
);

if (!hasContent) {
  setError('Could not extract sections from your resume. Try a different file format or paste the text directly.');
  setProgressStep('idle');
  return;
}
```

**Files**:
- `frontend/src/components/UploadPage.tsx` -- find the `parseResume` call and add validation after it

**Acceptance criteria**:
- When parse returns empty/no sections, user sees error message
- Error message suggests trying a different format or pasting text
- Progress resets to idle so user can try again

**Complexity**: 1-file change

---

### Task 10: Add job description validation feedback

**What to change**: In `UploadPage.tsx`, before the tailoring pipeline starts, validate the job description input. If it's very short (<100 characters) or effectively empty, show a warning.

Find the submit/start handler and add:
```typescript
if (jobDescription.trim().length < 100) {
  setJobDescWarning('Job description seems too short. Add more detail for better tailoring.');
}
```

This should be a warning (not a blocker) -- the user can still proceed. Use a yellow warning text below the job description textarea.

**Files**:
- `frontend/src/components/UploadPage.tsx` -- add state for warning, add validation logic, add warning display

**Acceptance criteria**:
- Warning appears when job description < 100 chars
- Warning does not block submission
- Warning clears when user adds more text
- Yellow text is visible but not alarming

**Complexity**: 1-file change

---

## Phase 4: Fix Backend Tests (update to match real contract)

### Task 11: Update test fixtures to use `raw_label` consistently

**What to change**: Review `backend/tests/fixtures.py` (lines 1-180). The current fixtures test `parse_llm_response` output, which uses `sectionType` (camelCase, mapped from `section_type`). These fixtures are for the TailoredData contract, not the ParsedResume contract. Verify there are no stale `rawLabel` references.

Add a new fixture for a sample ParsedResume response (what the parse endpoint returns) to enable testing the parsed resume contract:
```python
SAMPLE_PARSED_RESUME = {
    "raw_text": "...",
    "sections": {
        "contact": {"name": "Test User", "email": "test@example.com"},
        "summary": {"content": "Experienced engineer.", "bullets": []},
        "experience": {"content": "...", "bullets": ["Built APIs", "Led team"]},
        "education": {"content": "...", "bullets": []},
        "skills": {"content": "Python, Java", "bullets": []},
        "certifications": {"content": "", "bullets": []},
        "projects": {"content": "", "bullets": []},
    }
}
```

**Files**:
- `backend/tests/fixtures.py` (add new fixture at end)

**Acceptance criteria**:
- No `rawLabel` references in fixtures (there shouldn't be any currently)
- New `SAMPLE_PARSED_RESUME` fixture matches actual `parse_resume()` output shape
- Existing tests still pass

**Complexity**: 1-file change

---

### Task 12: Add contract integration test

**What to change**: Add a test to `backend/tests/test_contract.py` that runs `contracts/validate_contract.py` as a subprocess against the contract JSON files and asserts exit code 0. This ensures the contract files and validator stay in sync.

```python
import subprocess

class TestContractFiles:
    def test_parsed_resume_contract_valid(self):
        result = subprocess.run(
            ["python", "contracts/validate_contract.py", "contracts/parsed_resume.json"],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )
        assert result.returncode == 0, f"Validation failed:\n{result.stdout}\n{result.stderr}"

    def test_tailored_response_contract_valid(self):
        result = subprocess.run(
            ["python", "contracts/validate_contract.py", "contracts/tailored_response.json"],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )
        assert result.returncode == 0, f"Validation failed:\n{result.stdout}\n{result.stderr}"

    def test_job_analysis_contract_valid(self):
        result = subprocess.run(
            ["python", "contracts/validate_contract.py", "contracts/job_analysis.json"],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )
        assert result.returncode == 0, f"Validation failed:\n{result.stdout}\n{result.stderr}"
```

`PROJECT_ROOT` should be computed relative to the test file location (e.g., `Path(__file__).resolve().parent.parent.parent`).

**Files**:
- `backend/tests/test_contract.py` (add new test class at end)

**Acceptance criteria**:
- `pytest backend/tests/test_contract.py::TestContractFiles` passes
- All three contract JSON files validate successfully
- Test fails if someone breaks a contract file

**Complexity**: 1-file change

---

### Task 13: Add job ID correlation test

**What to change**: Add a test that verifies the job IDs in a parsed resume follow the expected `job-0`, `job-1`, ... pattern, and that the tailoring service produces matching IDs. This catches the silent mismatch bug where `ResumePreview.tsx` line 518 does `tailoredData.jobs?.find(j => j.id === job.id)`.

Add to `backend/tests/test_contract.py`:
```python
def test_job_ids_follow_pattern(self, full_result):
    """Job IDs in tailored data follow job-N pattern matching parsed resume."""
    for i, job in enumerate(full_result["jobs"]):
        assert job["id"] == f"job-{i}", (
            f"Job ID mismatch: expected 'job-{i}', got '{job['id']}'"
        )
```

Also add a test against the `contracts/parsed_resume.json` fixture to verify job IDs match.

**Files**:
- `backend/tests/test_contract.py` (add to `TestContractShape` class or new class)

**Acceptance criteria**:
- Test verifies job IDs in fixtures follow `job-N` pattern
- Test verifies parsed resume contract has matching job IDs
- Test fails if IDs are mismatched or out of order

**Complexity**: 1-file change

---

## Testing

### Run contract validation
```bash
cd /Users/cordell/source/Resume-Builder/.worktrees/contract-validation

# Validate all contracts
python contracts/validate_contract.py contracts/parsed_resume.json
python contracts/validate_contract.py contracts/tailored_response.json
python contracts/validate_contract.py contracts/job_analysis.json
```

### Run backend tests
```bash
cd backend
source .venv/bin/activate
pytest tests/test_contract.py -v
pytest tests/test_parse_llm_response.py -v
```

### Run frontend build (type check)
```bash
cd frontend
npm run build
```

### Run frontend lint
```bash
cd frontend
npm run lint
```

### Manual smoke test
1. Start app with `./run.sh`
2. Upload a resume (DOCX or PDF) and paste a job description
3. Verify section headings show custom labels (not fallback "Summary", "Skills", etc.)
4. Verify workspace is not blank
5. If no API key is set, verify error message appears (not blank page)
6. Try with a very short job description (<100 chars) -- verify warning appears
7. Open browser console -- verify no `[API Contract]` warnings about `rawLabel`

---

## Definition of Done

- [ ] `contracts/parsed_resume.json` uses `raw_label` (snake_case) and matches actual backend output shape
- [ ] `contracts/job_analysis.json` exists and documents `/api/analyze-job` response
- [ ] `contracts/validate_contract.py` validates all three contract files without errors
- [ ] `api.ts` `parseResume()` transforms `raw_label` to `rawLabel` at the API boundary
- [ ] `validateApiResponse.ts` accepts both `raw_label` and `rawLabel` without false warnings
- [ ] Backend endpoints have Pydantic `response_model` enforcing schema at source
- [ ] `App.tsx` never returns blank DOM -- shows error + recovery UI instead
- [ ] Empty tailored data (LLM failure) shows a user-visible warning, not a blank workspace
- [ ] Empty parse results show a user-facing error with actionable advice
- [ ] Short job descriptions trigger a visible (non-blocking) warning
- [ ] All backend tests pass (`pytest tests/ -v`)
- [ ] Frontend builds without TypeScript errors (`npm run build`)
- [ ] Frontend lint passes (`npm run lint`)
- [ ] No `[API Contract]` console warnings during normal operation
- [ ] Browser never shows a blank white page in any failure mode
