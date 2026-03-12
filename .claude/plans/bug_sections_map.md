# Bug Fix Plan: `resume.sections.map is not a function`

## Root Cause

`backend/main.py` wraps the return value of `parse_resume_with_llm` under a `"sections"` key:

```python
# main.py lines 137-140 (text path)
sections = await parse_resume_with_llm(text, ...)  # returns { contact, sections[], raw_text }
resume_data = {
    "raw_text": text,
    "sections": sections,   # ← sections is the full ParsedResume object, NOT an array
}
```

So the HTTP response body is:
```json
{
  "raw_text": "...",
  "sections": {
    "contact": { ... },
    "sections": [ ... ],
    "raw_text": "..."
  }
}
```

`api.ts` then does:
```typescript
return {
  contact: data.contact,        // undefined — contact is at data.sections.contact
  sections: data.sections || [], // data.sections is a plain object (truthy), not an array
  raw_text: data.raw_text,
};
```

`data.sections || []` never falls back to `[]` because the object is truthy, so `resume.sections` is set to a `{}` instead of `[]`. Calling `.map()` on it throws `TypeError: resume.sections.map is not a function`.

---

## Fix

### Primary fix — `backend/main.py` (lines 137-158)

Unwrap `sections_data` before returning so the response shape matches `ParsedResume`:

**Text path:**
```python
sections_data = await parse_resume_with_llm(text, is_text=True, api_key=x_openai_api_key)
resume_data = {
    "contact": sections_data.get("contact"),
    "sections": sections_data.get("sections", []),
    "raw_text": text,
}
```

**File path:**
```python
sections_data = await parse_resume_with_llm(tmp_path, is_text=False, api_key=x_openai_api_key)
resume_data = {
    "contact": sections_data.get("contact"),
    "sections": sections_data.get("sections", []),
    "raw_text": sections_data.get("raw_text", ""),
    "filename": file.filename,
}
```

### Secondary fix — `frontend/src/services/api.ts` (lines 40-46)

Defensive unwrap in case the backend still nests the result:

```typescript
const parsed = Array.isArray(data.sections)
  ? data
  : (data.sections && typeof data.sections === 'object' ? data.sections : data);
return {
  contact: parsed.contact,
  sections: Array.isArray(parsed.sections) ? parsed.sections : [],
  raw_text: parsed.raw_text || data.raw_text,
};
```

### Defensive guards — callers of `resume.sections`

Add `|| []` fallbacks wherever `resume.sections` is accessed before data is guaranteed:

- `frontend/src/components/layout/LeftSidebar.tsx` — change `resume.sections.map(...)` → `(resume.sections || []).map(...)`
- `frontend/src/components/resume/ResumePreview.tsx` — change `resume.sections.map(...)` → `(resume.sections || []).map(...)`

---

## Verification Steps

1. Start backend: `cd backend && source .venv/bin/activate && uvicorn main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Upload a resume (DOCX/PDF) — confirm no TypeError in console
4. Paste resume text — confirm same
5. Check DevTools Network tab for `/api/parse-resume` response — confirm shape is `{ contact, sections[], raw_text }`
6. Check `resume.sections` is an array in React DevTools state
