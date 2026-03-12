# Job Application Tracker & Portable Session Files

## Overview

Two related features that solve the data persistence problem:

1. **Job Application Tracker** — A full tracking board for job applications (status, interview stages, notes, which resume was used). Exportable/importable as Excel (.xlsx).
2. **Portable Session Files (.rtb)** — Compressed session backups that let users save/restore tailoring sessions as small downloadable files (~5-15 KB each), eliminating dependency on IndexedDB.

---

## What Already Exists

Before building, understand what's already in place:

- **`ApplicationStatus` type** (`storage.ts` line 22): `'none' | 'applied' | 'interviewing' | 'offered' | 'rejected'`
- **`TailoringSession.applicationStatus`** and `appliedAt?` fields — already persisted in IndexedDB
- **`updateApplicationStatus()`** in AppContext — writes to IndexedDB
- **Status badges** in `UploadPage.tsx` and `AppShell.tsx` — color-coded display already exists
- **Mini tracker board** in `UploadPage.tsx` (line 668+) — groups sessions by status
- **`exportSession()`/`importSession()`** in AppContext — JSON export of single sessions (version 1 format)
- **IndexedDB stores**: `resumes`, `jobDescriptions`, `sessions` — normalized with FK relationships

**Key gaps**: No interview round tracking, no notes, no dates beyond `appliedAt`, no Excel export, no batch operations, no compression, sessions are ephemeral (IndexedDB can be cleared by browser).

---

## Feature 1: Job Application Tracker

### 1.1 Extend the Data Model

**File**: `frontend/src/types/storage.ts`

Add new fields to `TailoringSession` and extend `ApplicationStatus`:

```typescript
// Expand status options
export type ApplicationStatus =
  | 'saved'        // bookmarked, haven't applied yet
  | 'applied'      // submitted application
  | 'phone-screen' // initial phone/recruiter screen
  | 'interview-1'  // first round interview
  | 'interview-2'  // second round
  | 'interview-3'  // third+ round
  | 'take-home'    // take-home assignment
  | 'offered'      // received offer
  | 'accepted'     // accepted offer
  | 'rejected'     // rejected (by them or by you)
  | 'withdrawn'    // withdrew application
  | 'none';        // not tracking

// New: Interview round details
export interface InterviewRound {
  round: number;
  type: 'phone' | 'technical' | 'behavioral' | 'system-design' | 'hiring-manager' | 'panel' | 'other';
  date?: string;        // ISO date string
  notes?: string;       // free-form notes
  interviewerName?: string;
  outcome?: 'passed' | 'failed' | 'pending' | 'cancelled';
}

// New: Application tracking metadata
export interface ApplicationTracking {
  applicationUrl?: string;     // link to the job posting
  appliedVia?: string;         // "LinkedIn", "Company website", "Referral", etc.
  contactName?: string;        // recruiter or referral name
  contactEmail?: string;
  salary?: string;             // expected or offered salary range
  notes?: string;              // general notes
  interviews: InterviewRound[];
  nextFollowUp?: string;       // ISO date for next follow-up reminder
  tags?: string[];             // user-defined tags: "remote", "fintech", etc.
}
```

Add to `TailoringSession`:
```typescript
export interface TailoringSession {
  // ... existing fields ...
  tracking?: ApplicationTracking;  // new, optional for backward compat
}
```

**Acceptance criteria**:
- New types are backward compatible (all new fields optional)
- Existing sessions without `tracking` field continue to work
- IndexedDB schema does NOT need a version bump (schemaless values in object stores)

**Complexity**: 1 file

---

### 1.2 Create Tracker UI Components

**New files**:
- `frontend/src/components/tracker/TrackerBoard.tsx` — Kanban-style board view
- `frontend/src/components/tracker/TrackerTable.tsx` — Table/list view
- `frontend/src/components/tracker/ApplicationDetailModal.tsx` — Edit modal for a single application
- `frontend/src/components/tracker/TrackerView.tsx` — Container with view toggle (board/table) and export/import buttons

#### TrackerBoard.tsx (Kanban view)
Columns for each status group:
- **Pipeline**: saved
- **Applied**: applied
- **Interviewing**: phone-screen, interview-1, interview-2, interview-3, take-home
- **Outcomes**: offered, accepted, rejected, withdrawn

Each card shows:
- Job title + company (from `StoredJobDescription.title`)
- Status badge (color-coded)
- Applied date (if set)
- Next interview date (from `tracking.interviews`)
- Resume name used
- Click to open `ApplicationDetailModal`

#### TrackerTable.tsx (List view)
Sortable/filterable table columns:
- Job Title | Company | Status | Applied Date | Resume Used | Last Updated | Next Follow-up | Tags

#### ApplicationDetailModal.tsx
Full edit form for one application:
- Status dropdown (all `ApplicationStatus` values)
- Interview rounds — add/edit/delete rounds with type, date, notes, outcome
- Application metadata — URL, applied via, contact info, salary, notes, tags
- Timeline view showing status changes chronologically
- "Which resume did you use?" — shows resume name, links back to session

#### TrackerView.tsx
Container component:
- Toggle between Board and Table views
- "Export to Excel" button
- "Import from Excel" button
- Search/filter bar (by status, tags, date range)
- Summary stats: total applications, response rate, interview rate

**Acceptance criteria**:
- User can view all tracked applications in board or table format
- User can edit application details including interview rounds
- Changes persist to IndexedDB immediately
- Empty state shows helpful onboarding message

**Complexity**: 4 new files, ~800-1200 lines total

---

### 1.3 Add Tracker Navigation

**Files**:
- `frontend/src/App.tsx` — add `'tracker'` to `currentView` union type
- `frontend/src/context/AppContext.tsx` — add `'tracker'` view state
- `frontend/src/components/UploadPage.tsx` — add "View Tracker" button in header

Add a third view mode alongside `'upload'` and `'workspace'`:
```typescript
currentView: 'upload' | 'workspace' | 'tracker'
```

Navigation: "View Tracker" button in UploadPage header, "Back to Tracker" in AppShell.

**Acceptance criteria**:
- User can navigate to tracker from upload page
- User can navigate back from tracker to upload
- Tracker view loads all sessions from IndexedDB on mount

**Complexity**: 3 files modified

---

### 1.4 Excel Export

**New file**: `frontend/src/services/excelExport.ts`

**Dependency**: `exceljs` (supports styled headers, read+write, ~500KB bundle)

```bash
cd frontend && npm install exceljs
```

Export function creates a workbook with two sheets:

**Sheet 1: "Applications"** (one row per session)
| Column | Source |
|--------|--------|
| Job Title | `jobDescription.title` |
| Company | `jobDescription.company` |
| Job URL | `tracking.applicationUrl` |
| Status | `session.applicationStatus` |
| Applied Date | `session.appliedAt` |
| Applied Via | `tracking.appliedVia` |
| Resume Used | `resume.name` |
| Salary | `tracking.salary` |
| Tags | `tracking.tags.join(', ')` |
| Contact | `tracking.contactName` |
| Contact Email | `tracking.contactEmail` |
| Notes | `tracking.notes` |
| Next Follow-up | `tracking.nextFollowUp` |
| Interview Count | `tracking.interviews.length` |
| Last Updated | `session.updatedAt` |
| Created | `session.createdAt` |

**Sheet 2: "Interviews"** (one row per interview round)
| Column | Source |
|--------|--------|
| Job Title | (joined from session) |
| Company | (joined from session) |
| Round | `interview.round` |
| Type | `interview.type` |
| Date | `interview.date` |
| Interviewer | `interview.interviewerName` |
| Outcome | `interview.outcome` |
| Notes | `interview.notes` |

**Styling**:
- Bold + blue header row
- Auto-width columns
- Status cells color-coded (green=offered, red=rejected, etc.)
- Date columns formatted as dates
- Freeze top row

**Acceptance criteria**:
- Downloads as `job-tracker-YYYY-MM-DD.xlsx`
- Opens correctly in Excel, Google Sheets, LibreOffice
- Contains all tracked application data
- Headers are styled and columns auto-sized

**Complexity**: 1 new file (~200 lines)

---

### 1.5 Excel Import

**Same file**: `frontend/src/services/excelExport.ts` (add `importFromExcel` function)

Import parses the "Applications" sheet and creates/updates sessions:

1. Read the uploaded `.xlsx` file with `exceljs`
2. Map each row back to `ApplicationTracking` fields
3. For each row:
   - Check if a session with matching job title + company already exists → update
   - If not, create a new "tracker-only" session (no parsed resume or tailored data, just tracking metadata)
4. If "Interviews" sheet exists, merge interview rounds into the matching sessions

**Edge cases**:
- Rows with no job title → skip with warning
- Duplicate rows → use last occurrence
- Extra columns → ignore
- Missing columns → use defaults

**Acceptance criteria**:
- User can upload a previously exported `.xlsx` and see their data restored
- User can upload a manually-created spreadsheet (e.g., from a Google Sheet) with the right column headers
- Import shows a summary: "Imported 15 applications (3 new, 12 updated)"
- Import does NOT overwrite session tailoring data (only tracking metadata)

**Complexity**: ~150 lines added to existing file

---

## Feature 2: Portable Session Files (.rtb)

### 2.1 Create Session Serialization Service

**New file**: `frontend/src/services/sessionFile.ts`

Uses the native `CompressionStream` API (zero dependencies, gzip compression).

**Export flow**:
```
Session data (JSON) → TextEncoder → CompressionStream (gzip) → Blob (.rtb file)
```

**File format** (simple envelope, no binary header for v1):
```json
{
  "format": "resume-tailor-backup",
  "version": 1,
  "exportedAt": "2026-03-12T...",
  "session": { /* TailoringSession */ },
  "resume": { /* StoredResume */ },
  "jobDescription": { /* StoredJobDescription */ }
}
```

This JSON is then gzip-compressed into a `.rtb` file.

```typescript
// Export
async function exportSessionFile(
  session: TailoringSession,
  resume: StoredResume,
  jobDescription: StoredJobDescription
): Promise<Blob>

// Import
async function importSessionFile(file: File): Promise<{
  session: TailoringSession;
  resume: StoredResume;
  jobDescription: StoredJobDescription;
}>

// Batch export (all sessions)
async function exportAllSessions(): Promise<Blob>

// Batch import
async function importAllSessions(file: File): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}>
```

**Size estimates**:
| Content | Raw JSON | Compressed .rtb |
|---------|----------|-----------------|
| Single session | 20-60 KB | 3-12 KB |
| 10 sessions | 200-600 KB | 25-75 KB |
| 50 sessions | 1-3 MB | 120-350 KB |

**Acceptance criteria**:
- Exported `.rtb` file is 75-85% smaller than equivalent JSON
- Importing a `.rtb` restores the full session (resume, JD, tailored data, chat history, tracking)
- Invalid files show clear error messages
- Version check on import (rejects future versions with helpful message)
- CompressionStream TypeScript declarations included (`.d.ts` file if needed)

**Complexity**: 1 new file (~150-200 lines)

---

### 2.2 Add Export/Import UI

**Files to modify**:
- `frontend/src/components/layout/AppShell.tsx` — add "Save Session (.rtb)" button in toolbar
- `frontend/src/components/UploadPage.tsx` — add "Load Session (.rtb)" in the upload area
- `frontend/src/components/tracker/TrackerView.tsx` — add "Export All (.rtb)" button

**Single session export** (from workspace):
- Button in AppShell header/toolbar: "Save Session"
- Downloads `session-{jobTitle}-{date}.rtb`
- Toast notification: "Session saved (12 KB)"

**Single session import** (from upload page):
- In the upload area, alongside "Upload Resume", add "Restore Session (.rtb)"
- Accepts `.rtb` files
- On success: restores session and navigates to workspace
- On failure: shows error ("Invalid file format" or "This file was created with a newer version")

**Batch export** (from tracker):
- "Export All Sessions" button
- Downloads `all-sessions-{date}.rtb`
- Includes ALL sessions, resumes, and JDs

**Acceptance criteria**:
- User can save any session as a `.rtb` file from the workspace
- User can restore a session from `.rtb` on the upload page
- User can export/import all sessions at once from the tracker
- File input accepts only `.rtb` extension

**Complexity**: 3 files modified, ~100-150 lines total

---

### 2.3 Add CompressionStream TypeScript Declarations

**New file**: `frontend/src/types/compression.d.ts`

```typescript
interface CompressionStream extends GenericTransformStream {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
}

declare var CompressionStream: {
  prototype: CompressionStream;
  new (format: 'gzip' | 'deflate' | 'deflate-raw'): CompressionStream;
};

interface DecompressionStream extends GenericTransformStream {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
}

declare var DecompressionStream: {
  prototype: DecompressionStream;
  new (format: 'gzip' | 'deflate' | 'deflate-raw'): DecompressionStream;
};
```

**Complexity**: 1 new file, 20 lines

---

## Implementation Order

Execute in this order (each phase is independently shippable):

### Phase 1: Portable Session Files (unblocks data safety)
1. Task 2.3 — CompressionStream types
2. Task 2.1 — `sessionFile.ts` service
3. Task 2.2 — Export/import UI in AppShell + UploadPage

**Why first**: This immediately gives users a way to back up their work. No new dependencies needed. Estimated 2-3 tasks for subagents.

### Phase 2: Tracker Data Model + Excel
4. Task 1.1 — Extend data model (`storage.ts`)
5. Task 1.4 — Excel export (`excelExport.ts` + install `exceljs`)
6. Task 1.5 — Excel import (add to `excelExport.ts`)

**Why second**: The data model changes are backward compatible and the Excel service is self-contained.

### Phase 3: Tracker UI
7. Task 1.2 — Tracker UI components (TrackerBoard, TrackerTable, DetailModal, TrackerView)
8. Task 1.3 — Navigation integration (App.tsx, AppContext, UploadPage)

**Why last**: Depends on the data model from Phase 2. Largest amount of UI work.

---

## Dependencies

| Package | Purpose | Size Impact |
|---------|---------|-------------|
| `exceljs` | Excel read/write with styling | ~500 KB (bundled) |
| None | CompressionStream is native | 0 KB |

---

## Testing

### Manual smoke tests
1. Create a session → Save as .rtb → Clear browser data → Import .rtb → Verify session restored
2. Track 5 applications with different statuses → Export Excel → Open in Excel/Sheets → Verify data
3. Edit Excel manually → Import → Verify updates applied
4. Export all sessions as .rtb → Clear data → Import .rtb → Verify all sessions restored
5. Try importing an invalid file → Verify error message
6. Try importing a .rtb with `version: 2` → Verify "newer version" message

### Automated tests (if backend tests are added)
- Contract validation for the `.rtb` envelope format
- Round-trip test: export → import → compare original vs imported

---

## Definition of Done

- [ ] Users can save individual sessions as `.rtb` files (~5-15 KB)
- [ ] Users can restore sessions from `.rtb` files (full resume, JD, tailored data, chat)
- [ ] Users can export all sessions as a single `.rtb` file
- [ ] Tracker view shows all applications in board and table formats
- [ ] Users can track interview rounds, notes, contacts, salary, tags per application
- [ ] Users can export tracker data as styled Excel (.xlsx)
- [ ] Users can import tracker data from Excel (creates/updates applications)
- [ ] All new features work without backend changes (frontend-only)
- [ ] No new backend dependencies
- [ ] Frontend builds without TypeScript errors
- [ ] Backward compatible — existing sessions without tracking data still work
