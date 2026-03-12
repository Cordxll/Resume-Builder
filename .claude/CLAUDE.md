# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Running the app
```bash
# Start both servers together
./run.sh

# Backend only (from repo root — uses backend/.venv)
cd backend && source .venv/bin/activate && python main.py
# Or with hot reload:
cd backend && source .venv/bin/activate && uvicorn main:app --reload

# Frontend only
cd frontend && npm run dev
```

Backend: `http://localhost:8000` | Frontend: `http://localhost:5173`

### Frontend scripts
```bash
cd frontend
npm run dev      # dev server with HMR
npm run build    # tsc + vite build → frontend/dist/
npm run lint     # ESLint (max-warnings 0)
npm run preview  # serve built dist
```

### Backend setup (first time)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Environment
Copy `.env.example` to `backend/.env` and set credentials. The backend supports any OpenAI-compatible provider via three env vars:
- `OPENAI_API_KEY` — required
- `OPENAI_BASE_URL` — optional; omit for OpenAI, set for Gemini/DeepSeek/Groq/etc.
- `OPENAI_MODEL` — defaults to `gemini-2.5-flash`

The frontend can also pass the API key at runtime via the Settings modal (stored in `localStorage`), sent as `X-OpenAI-API-Key` header to the backend.

## Architecture

This is a full-stack resume tailoring app. The backend is a Python FastAPI service; the frontend is a React/TypeScript SPA built with Vite and styled with Tailwind CSS.

### Backend (`backend/`)

**Entry point**: `main.py` — all FastAPI routes are defined here.

**Services** (`backend/services/`):
- `openai_client.py` — factory for `AsyncOpenAI` client; reads `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`. All other services import from here.
- `resume_parser.py` — parses DOCX/PDF/text into structured sections using LLM.
- `resume_tailor.py` — takes raw resume text + job description → returns `TailoredData` (original/tailored sections + change summaries). Also handles the `/api/chat` endpoint logic via `chat_with_assistant`.
- `job_analyzer.py` — lightweight non-LLM analysis of job descriptions (keyword extraction).
- `docx_exporter.py` — generates a `.docx` file from accepted changes using `python-docx`.

**API key flow**: All LLM-touching endpoints accept an optional `X-OpenAI-API-Key` header. The header key takes precedence over the server `.env` key. `get_config` (`GET /api/config`) tells the frontend whether a server-side key is configured.

**Logs**: Rotating log files written to `backend/logs/app.log`.

### Frontend (`frontend/src/`)

**Two views**: `upload` (UploadPage) and `workspace` (AppShell + CenterPanel).

**State management**: A single React context (`AppContext.tsx`) with `useReducer` holds all app state. `AppProvider` wraps the whole app. This context also manages all IndexedDB persistence via the session/resume/job description DB helpers.

**Persistence layer**:
- `services/db.ts` — IndexedDB wrapper (`resume-tailor-db`). Three object stores: `resumes`, `jobDescriptions`, `sessions`. Session data auto-saves with a 3-second debounce on `isDirty` changes.
- `services/storage.ts` — `localStorage` helpers for API key and server key status.
- The current active session ID is kept in `localStorage` (`currentSessionId`) and restored on app mount.

**Data flow for tailoring**:
1. `UploadPage` collects resume (file/text) + job description
2. Calls `api.parseResume()` → `POST /api/parse-resume` → structured `ParsedResume`
3. Calls `api.tailorResume()` → `POST /api/tailor-resume` → `TailoredData`
4. `AppContext.startNewSession()` persists to IndexedDB, dispatches `START_SESSION`
5. App renders workspace view: `AppShell` (3-panel layout) containing `CenterPanel`

**Workspace layout** (`components/layout/`):
- `AppShell` — outer 3-panel shell; holds `LeftSidebar` (section nav) and `RightSidebar` (chat)
- `CenterPanel` — renders `ResumePreview` and `ResumeSectionCard` components
- `LeftSidebar` — section navigation + export button
- `RightSidebar` — AI chat panel

**Inline editing**: `EditContext` (in `AppContext`) tracks which bullet/section is being edited. `InlineEditPopup` lets users edit text or ask AI directly. The AI edit prompt is sent through the normal chat flow with a structured format (`IMPROVED: "..."` / `WHY: ...`); `extractSuggestion` / `extractExplanation` (`utils/`) parse the response.

**Undo/redo**: `editHistory` in state (a `Map<key, entry>`) tracks original tailored values per edit key (e.g., `"summary"`, `"experience-0-2"`). Undo/redo operate on this map.

**Key types** (`types/index.ts`):
- `ParsedResume` — structured resume sections from parser
- `TailoredData` — `{ original, tailored, changes }` where `tailored.jobs` is `TailoredJob[]` (structured with per-bullet `bulletExplanations`)
- `AcceptedChanges` — `{ summary, experience, skills }` booleans
- `EditContext` — `{ section, jobIndex?, bulletIndex?, originalContent, isActive }`

**API client** (`services/api.ts`): Thin axios wrapper. `VITE_API_URL` env var overrides the default `http://localhost:8000`.

**Theme**: `useTheme` hook (dark/light) applies a class to `<html>`.
