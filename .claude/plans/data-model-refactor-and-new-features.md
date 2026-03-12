# Data Model Refactor, Sankey Chart, Drag-and-Drop Board, and Contract Rules

## Overview

Five workstreams driven by the user's feedback:

1. **Data model refactor** — Rename and restructure so a "session" contains multiple tailorings (resume + JD + tailored output), not just one.
2. **CLAUDE.md contract rule** — Enforce that every new feature ships with a frontend/backend data model contract and tests.
3. **Remove My Applications page** — Hide the redundant `ApplicationsPage` view.
4. **Sankey chart view** — Interactive flow visualization of application pipeline (saved → applied → interview → offered/rejected).
5. **Drag-and-drop board** — Enable drag-and-drop between columns on the tracker Kanban board.

---

## What Exists Today

### Current data model

```
StoredResume (1) ←── resumeId ──── TailoringSession ──── jobDescriptionId ──→ (1) StoredJobDescription
                                         │
                                    tracking?: ApplicationTracking
                                    tailoredData: TailoredData
                                    chatHistory: ChatMessage[]
```

A `TailoringSession` is 1 resume × 1 job description × 1 tailored output. If a user tailors the same resume against 3 different jobs, that's 3 separate sessions with no grouping. The `.rtb` export wraps one or more `SessionBundle[]` in a flat array with no hierarchy.

### Current views

| View | Route | Purpose |
|------|-------|---------|
| `'upload'` | UploadPage | Upload resume + JD, start tailoring |
| `'workspace'` | AppShell + CenterPanel | Edit tailored resume |
| `'tracker'` | TrackerView | Kanban board + table, Excel/RTB export |
| `'applications'` | ApplicationsPage | Table-only list (user says: pointless) |

### Current board

`TrackerBoard.tsx` renders 5 columns. Cards are `<button>` elements. Clicking opens `ApplicationDetailModal`. **No drag-and-drop** — status changes only happen via the modal dropdown.

---

## Workstream 1: Data Model Refactor

### Problem

"Session" currently means "one tailoring" — confusing. The user wants to restore a "session" and see multiple tailorings. The naming is wrong:

- A **tailoring** = one resume + one JD + the AI output + chat history + accepted changes
- A **session** (or "workspace" / "project") = a collection of tailorings the user is working on

### New model

**Rename `TailoringSession` → `Tailoring`**:
```typescript
// frontend/src/types/storage.ts

export interface Tailoring {
  id: string;
  workspaceId: string;          // FK → Workspace (NEW)
  resumeId: string;             // FK → StoredResume
  jobDescriptionId: string;     // FK → StoredJobDescription
  tailoredData: TailoredData;
  acceptedChanges: AcceptedChanges;
  chatHistory: ChatMessage[];
  status: 'active' | 'completed';
  applicationStatus: ApplicationStatus;
  appliedAt?: string;
  tracking?: ApplicationTracking;
  createdAt: string;
  updatedAt: string;
  isDirty?: boolean;
}
```

**New entity — `Workspace`** (what the user thinks of as a "session"):
```typescript
export interface Workspace {
  id: string;
  name: string;                 // user-editable label, e.g. "Q1 2026 Job Search"
  createdAt: string;
  updatedAt: string;
}
```

**Relationships**:
```
Workspace (1) ──→ (*) Tailoring ──→ (1) StoredResume
                                  ──→ (1) StoredJobDescription
```

A workspace groups tailorings. Restoring a `.rtb` restores the workspace and all its tailorings.

### Migration strategy

- Add a new `workspaces` IndexedDB object store (bump DB version to 3)
- On upgrade from v2→v3:
  1. Create `workspaces` store
  2. For each existing `TailoringSession`, create a `Workspace` with `name = "Imported Session"` and assign `workspaceId`
  3. Rename the store from `sessions` to `tailorings` (or add `tailorings` and copy data)
- All new tailorings get a `workspaceId`. User can group multiple tailorings in one workspace.

### Files to change

| File | Change |
|------|--------|
| `types/storage.ts` | Rename `TailoringSession` → `Tailoring`, add `Workspace`, update `SessionBundle` |
| `services/db.ts` | Add `workspaces` store, bump version to 3, add migration, rename session helpers |
| `services/sessionFile.ts` | Update `SessionBundle` and `RtbEnvelope` to include workspace |
| `services/excelExport.ts` | Update to use `Tailoring` type name |
| `context/AppContext.tsx` | Rename all `session` references → `tailoring`, add workspace management |
| `App.tsx` | Update prop types |
| `components/UploadPage.tsx` | Update session references |
| `components/layout/AppShell.tsx` | Update export to include workspace |
| `components/tracker/*.tsx` | Update type references |
| `types/index.ts` | No change (these are backend response types) |

### Backward compatibility

- `.rtb` import: detect `version: 1` (old format with no workspace) → auto-wrap each bundle in a new workspace
- Old IndexedDB data: migration creates workspaces for orphaned tailorings
- Excel import: works the same (creates tailorings, assigns to a default workspace)

### Acceptance criteria

- User can create a workspace, then tailor multiple resumes against different jobs within it
- Restoring a `.rtb` brings back the workspace with all its tailorings
- Upload page shows workspace selector (pick existing or create new)
- Workspace view lists all tailorings in the workspace
- Old data migrates cleanly (no data loss)

### Complexity: HIGH — touches nearly every frontend file. ~15-20 files, ~500-800 line changes.

---

## Workstream 2: CLAUDE.md Contract Rule

### Problem

Bugs keep appearing because frontend types diverge from backend response shapes. Need a rule that prevents this.

### Rule to add to `.claude/CLAUDE.md`

Add a new section after "## Architecture":

```markdown
## Data Contracts

**Rule: Every new feature that introduces or changes a data shape between frontend and backend MUST include:**

1. **Backend contract fixture** — A JSON sample file under `contracts/` that represents the exact response shape the backend will return.
2. **Backend contract test** — A pytest test that validates the backend's actual output matches the contract fixture (field names, types, nesting).
3. **Frontend runtime validator** — A function in `frontend/src/utils/validateApiResponse.ts` that checks the shape at runtime and logs warnings (never crashes) if the response doesn't match.
4. **TypeScript types** — Frontend types in `types/index.ts` or `types/storage.ts` must exactly match the contract fixture's field names (camelCase for frontend, the backend must transform snake_case → camelCase before sending).

**Contract test location**: `backend/tests/test_contract.py` and `contracts/*.json`
**Frontend validator location**: `frontend/src/utils/validateApiResponse.ts`

When in doubt, check the existing contract fixtures and tests as reference.
```

### Files to change

| File | Change |
|------|--------|
| `.claude/CLAUDE.md` | Add "## Data Contracts" section |

### Complexity: LOW — 1 file, ~15 lines

---

## Workstream 3: Remove My Applications Page

### Problem

User says it's "kinda pointless" — the full tracker already has a table view. The ApplicationsPage is redundant.

### Changes

1. **Delete** `frontend/src/components/tracker/ApplicationsPage.tsx`
2. **Remove** `'applications'` from `currentView` type in `AppContext.tsx`
3. **Remove** `navigateToApplications` from `AppContext.tsx` (callback, interface, value)
4. **Remove** the `if (currentView === 'applications')` branch in `App.tsx`
5. **Remove** the import of `ApplicationsPage` in `App.tsx`
6. **Remove** the "My Applications" button from `UploadPage.tsx` header
7. **Remove** `SET_VIEW` payload type for `'applications'`

### Acceptance criteria

- No "My Applications" button on upload page
- No route to ApplicationsPage
- TypeScript builds clean
- TrackerView remains the single tracker entry point

### Complexity: LOW — delete 1 file, edit 4 files, ~30 lines removed

---

## Workstream 4: Sankey Chart View

### Problem

User wants a visual flow chart showing how applications move through the pipeline (saved → applied → interviewing → offered/rejected/withdrawn). Interactive: hover for details, exportable as image.

### Design

**New file**: `frontend/src/components/tracker/SankeyChart.tsx`

**Library**: Use `recharts` (already a common React charting library, ~200KB). Its `Sankey` component handles the flow diagram natively. Alternative: `d3-sankey` for more control, but recharts is simpler and React-native.

```bash
cd frontend && npm install recharts
```

**Data shape** for the Sankey:

Nodes (stages):
- `Saved` → `Applied` → `Phone Screen` → `Interview` → `Take-Home` → `Offered` → `Accepted`
- Branch: any stage → `Rejected` or `Withdrawn`

Links (flows): count of applications moving between each pair of statuses. Derived from `ApplicationTracking.interviews` + `applicationStatus`:

```typescript
interface SankeyNode {
  name: string;      // status label
  color: string;     // matching status badge color
}

interface SankeyLink {
  source: number;    // node index
  target: number;    // node index
  value: number;     // count of applications
}
```

**Building the flow data**:
For each tailoring/session, trace the logical path:
- If `applicationStatus === 'applied'`: link Saved→Applied
- If `applicationStatus === 'interview-2'`: link Saved→Applied→Interview (value 1 for each hop)
- If `applicationStatus === 'rejected'` and had interviews: link through each stage the application passed through before rejection

Simple approach: map each terminal status to a fixed path:
```
saved:        [Saved]
applied:      [Saved, Applied]
phone-screen: [Saved, Applied, Phone Screen]
interview-1:  [Saved, Applied, Interviewing]
interview-2:  [Saved, Applied, Interviewing]
interview-3:  [Saved, Applied, Interviewing]
take-home:    [Saved, Applied, Take-Home]
offered:      [Saved, Applied, Interviewing, Offered]
accepted:     [Saved, Applied, Interviewing, Offered, Accepted]
rejected:     [Saved, Applied, ..., Rejected]  (branch from last active stage)
withdrawn:    [Saved, Applied, ..., Withdrawn] (branch from last active stage)
```

**Interactive hover**: Recharts `Sankey` supports `onMouseEnter`/`onMouseLeave` on both nodes and links. Show a tooltip with:
- Node hover: "Applied: 15 applications"
- Link hover: "Applied → Interviewing: 8 applications" + list of job titles

**Export as image**: Add an "Export Chart" button that uses `html-to-image` or the native canvas approach:
```bash
cd frontend && npm install html-to-image
```
- Renders the chart container to a PNG
- Downloads as `application-flow-YYYY-MM-DD.png`

**Integration into TrackerView**:
- Add a third view mode: `'table' | 'board' | 'chart'`
- Add a chart icon toggle button alongside the existing table/board toggles
- When `viewMode === 'chart'`, render `<SankeyChart bundles={filteredBundles} />`

### Files

| File | Change |
|------|--------|
| `frontend/src/components/tracker/SankeyChart.tsx` | NEW — Sankey diagram component |
| `frontend/src/components/tracker/TrackerView.tsx` | Add `'chart'` view mode + toggle button |
| `frontend/package.json` | Add `recharts`, `html-to-image` |

### Acceptance criteria

- Sankey chart shows flow of applications through pipeline stages
- Hover on node → tooltip with count and status name
- Hover on link → tooltip with count and list of job titles (max 5, then "+N more")
- "Export Chart" button downloads PNG
- Empty state: "Add more applications to see your pipeline flow"
- Chart updates when filters change

### Complexity: MEDIUM — 1 new file (~300 lines), 1 modified, 2 new deps

---

## Workstream 5: Drag-and-Drop Board

### Problem

Changing application status requires opening the modal and using a dropdown. Users expect to drag cards between columns on a Kanban board.

### Design

**Library**: `@hello-pangea/dnd` (maintained fork of `react-beautiful-dnd`, ~170KB). React-native, accessibility-built-in, well-documented.

```bash
cd frontend && npm install @hello-pangea/dnd
```

**Changes to `TrackerBoard.tsx`**:

1. Wrap the entire board in `<DragDropContext onDragEnd={handleDragEnd}>`
2. Each column becomes a `<Droppable droppableId={columnId}>`
3. Each card becomes a `<Draggable draggableId={session.id} index={index}>`
4. `handleDragEnd(result)`:
   - Extract `source.droppableId` and `destination.droppableId`
   - Map column IDs to target status:
     - Column "Pipeline" → `'saved'`
     - Column "Applied" → `'applied'`
     - Column "Interviewing" → `'phone-screen'` (default first interviewing status; or pick based on position within column)
     - Column "Outcomes" → `'offered'` (user can refine via modal)
     - Column "Not Tracking" → `'none'`
   - Call `onStatusChange(session.id, newStatus)` — new prop

**New prop on TrackerBoard**:
```typescript
interface Props {
  bundles: SessionBundle[];
  onSelectBundle: (bundle: SessionBundle) => void;
  onStatusChange: (sessionId: string, newStatus: ApplicationStatus) => void;  // NEW
}
```

**TrackerView changes**:
- Pass `onStatusChange` to `TrackerBoard`
- Handler: update session's `applicationStatus`, auto-set `appliedAt` when moving to `applied`, save to IndexedDB, reload

**Visual feedback**:
- Dragging card shows a shadow/elevation effect
- Drop target column highlights
- After drop, card animates into its new column

**Column-to-status mapping** (for Interviewing/Outcomes which have multiple statuses):
When dropping into "Interviewing" column: set status to `'interview-1'` by default. When dropping into "Outcomes": set to `'offered'` by default. User can refine via the detail modal. This keeps the drag simple while avoiding ambiguity.

### Files

| File | Change |
|------|--------|
| `frontend/src/components/tracker/TrackerBoard.tsx` | Add DnD wrappers, `onStatusChange` prop, `handleDragEnd` |
| `frontend/src/components/tracker/TrackerView.tsx` | Pass `onStatusChange`, implement handler |
| `frontend/package.json` | Add `@hello-pangea/dnd` |

### Acceptance criteria

- User can drag a card from one column to another
- Card's status updates immediately on drop
- Status persists to IndexedDB
- Visual feedback during drag (card elevated, column highlighted)
- Dropping back to same column is a no-op
- Click still opens the detail modal (not interfered by drag)

### Complexity: MEDIUM — 2 files modified, 1 new dep, ~150 lines changed

---

## Implementation Order

```
Phase 1: Quick wins (independent, can parallelize)
  ├── Workstream 2: CLAUDE.md contract rule         [LOW, 1 file]
  ├── Workstream 3: Remove My Applications page     [LOW, 5 files]
  └── Workstream 5: Drag-and-drop board             [MEDIUM, 2 files + dep]

Phase 2: New feature
  └── Workstream 4: Sankey chart                    [MEDIUM, 2 files + deps]

Phase 3: Major refactor (do last — touches everything)
  └── Workstream 1: Data model refactor             [HIGH, ~15 files]
```

**Why this order:**
- Phase 1 items are independent and low-risk. Ship fast, get them off the board.
- Phase 2 (Sankey) is self-contained and doesn't depend on the data model refactor.
- Phase 3 (data model) is the largest change. Doing it last means all other features are stable and the refactor only needs to account for the final state of the code.

---

## New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `recharts` | Sankey chart + tooltips | ~200 KB |
| `html-to-image` | Export chart as PNG | ~15 KB |
| `@hello-pangea/dnd` | Drag-and-drop for Kanban board | ~170 KB |

---

## Definition of Done

- [ ] CLAUDE.md has data contract rule
- [ ] My Applications page removed, no route or button
- [ ] Tracker board supports drag-and-drop between columns
- [ ] Sankey chart view shows application pipeline flow with interactive hover
- [ ] Chart exportable as PNG
- [ ] `TailoringSession` renamed to `Tailoring`, new `Workspace` entity groups tailorings
- [ ] `.rtb` v2 format includes workspace, v1 import still works
- [ ] IndexedDB migration from v2→v3 preserves all existing data
- [ ] All features have contract tests where applicable
- [ ] Frontend builds clean, no TypeScript errors
