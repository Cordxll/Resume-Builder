# Merge Tracker Branch + UI Improvements

## Problem

1. **Feature branch not merged**: All tracker + .rtb export work is on `feature/tracker-and-sessions` (9 commits, PR pushed). The user is running `main`, which only has legacy exports (DOCX + JSON). The .rtb "Save Session" button and "View Tracker" navigation exist on the feature branch but aren't visible yet.

2. **Dedicated "My Applications" table page**: The user wants a standalone page (not buried inside TrackerView) showing a clean table of everywhere they applied. Think of it as a quick-glance "Where did I apply?" view — simpler than the full tracker with its board/table/search/import/export controls.

---

## What Already Exists (on feature branch)

- `TrackerView.tsx` — full tracker with board/table toggle, search, Excel/RTB import/export, stats bar
- `TrackerTable.tsx` — sortable table component (Job Title, Company, Status, Applied Date, Resume Used, Tags, Last Updated)
- `TrackerBoard.tsx` — Kanban board component
- `ApplicationDetailModal.tsx` — full edit modal for tracking details
- `AppShell.tsx` — Export dropdown with DOCX, JSON, and .rtb options
- `UploadPage.tsx` — "View Tracker" button + "Restore Session (.rtb)" button
- Navigation: `currentView` supports `'upload' | 'workspace' | 'tracker'`

---

## Tasks

### Task 1: Merge feature branch to main

Merge `feature/tracker-and-sessions` into `main` so all the work becomes live.

```bash
cd /Users/cordell/source/Resume-Builder
git checkout main
git pull origin main
git merge feature/tracker-and-sessions
# Resolve any conflicts (likely in files that changed on both branches)
npm run build   # verify
```

**Acceptance criteria**:
- `main` has all 9 feature branch commits
- Frontend builds clean
- Export dropdown shows DOCX, JSON, and .rtb options
- "View Tracker" button visible on upload page

**Complexity**: 1 merge, potential conflict resolution

---

### Task 2: Add "My Applications" quick-view page

Create a lightweight "My Applications" page — a streamlined table-only view focused on "where did I apply?" that's faster to scan than the full TrackerView.

**New file**: `frontend/src/components/tracker/ApplicationsPage.tsx`

**Differences from TrackerView**:
| Feature | TrackerView | ApplicationsPage |
|---------|-------------|-------------------|
| Board view | Yes | No — table only |
| Excel import/export | Yes | No |
| RTB export | Yes | No |
| Search bar | Yes | Yes |
| Stats bar | Yes | Simpler — just count |
| Detail modal | Full edit | View-only summary |
| Status filter | No | Yes — dropdown to filter by status |
| Purpose | Full management | Quick "where did I apply?" glance |

**UI layout**:
- Header: "My Applications" + back button + application count
- Filter row: status dropdown filter (e.g. "All", "Applied", "Interviewing", "Offered") + search input
- Table: Job Title | Company | Status (badge) | Applied Date | Resume Used | Current Stage
  - "Current Stage" shows the latest interview round or status text
  - Rows link to the full TrackerView detail modal for editing
- Footer: "Open Full Tracker" link → navigates to TrackerView

**Navigation**:
- Add `'applications'` to `currentView` type: `'upload' | 'workspace' | 'tracker' | 'applications'`
- Add `navigateToApplications()` in AppContext
- Add "My Applications" button on UploadPage (alongside "View Tracker")
- Render `<ApplicationsPage>` in App.tsx when `currentView === 'applications'`

**Acceptance criteria**:
- User can navigate to "My Applications" from upload page
- Shows filterable, searchable table of all tracked applications
- Status filter narrows results
- Clicking a row opens the detail modal
- "Open Full Tracker" navigates to the full TrackerView
- Build clean

**Complexity**: 1 new file + 3 files modified (App.tsx, AppContext.tsx, UploadPage.tsx)

---

### Task 3: Make .rtb export more discoverable

The .rtb export is currently the 3rd item in the Export dropdown — easy to miss. Improve discoverability:

**Changes to `AppShell.tsx`**:
1. Reorder export dropdown: put "Save Session (.rtb)" first (it's the recommended portable format), then DOCX, then JSON (legacy)
2. Add a subtle label: ".rtb" gets a "(Recommended)" suffix or a small "portable" tag
3. Add a divider between .rtb and the legacy formats

**Changes to `UploadPage.tsx`**:
1. The "Restore Session (.rtb)" button should be more prominent — move it next to or near "Upload Resume" rather than tucked in the header
2. Add helper text: "Resume a previous session" or similar

**Acceptance criteria**:
- .rtb is the first export option in the dropdown
- Visual distinction between .rtb (recommended) and legacy formats
- "Restore Session" is easily findable on upload page
- Build clean

**Complexity**: 2 files modified

---

## Implementation Order

1. **Task 1** (merge) — must come first, everything else builds on merged code
2. **Task 2** (Applications page) — the main feature ask
3. **Task 3** (.rtb discoverability) — UI polish

---

## Dependencies

No new packages needed. All work is frontend-only.
