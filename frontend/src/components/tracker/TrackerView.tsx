import { useState, useEffect, useRef } from 'react';
import { TailoringSession, StoredResume, StoredJobDescription, ApplicationStatus } from '../../types/storage';
import { sessionDB, resumeDB, jobDescriptionDB } from '../../services/db';
import { exportToExcel, importFromExcel, ImportResult } from '../../services/excelExport';
import { exportAllSessionsFile, downloadBlob, SessionBundle } from '../../services/sessionFile';
import TrackerBoard from './TrackerBoard';
import TrackerTable from './TrackerTable';
import SankeyChart from './SankeyChart';
import ApplicationDetailModal from './ApplicationDetailModal';

interface Props {
  onBack: () => void;
}

type ViewMode = 'table' | 'board' | 'chart';

const ACTIVE_STATUSES: ApplicationStatus[] = [
  'applied', 'phone-screen', 'interview-1', 'interview-2', 'interview-3', 'take-home',
];

const OFFER_STATUSES: ApplicationStatus[] = ['offered', 'accepted'];

function buildBundles(
  sessions: TailoringSession[],
  resumeMap: Map<string, StoredResume>,
  jdMap: Map<string, StoredJobDescription>
): SessionBundle[] {
  return sessions
    .map((session) => ({
      session,
      resume: resumeMap.get(session.resumeId) ?? null,
      jobDescription: jdMap.get(session.jobDescriptionId) ?? null,
    }))
    .filter((b): b is SessionBundle =>
      b.resume !== null && b.jobDescription !== null
    )
    .concat(
      // Also include sessions with missing resume/jd as partial bundles
      sessions
        .filter((session) => !resumeMap.has(session.resumeId) || !jdMap.has(session.jobDescriptionId))
        .map((session) => ({
          session,
          resume: resumeMap.get(session.resumeId) as StoredResume,
          jobDescription: jdMap.get(session.jobDescriptionId) as StoredJobDescription,
        }))
    )
    .sort((a, b) =>
      new Date(b.session.updatedAt).getTime() - new Date(a.session.updatedAt).getTime()
    );
}

export default function TrackerView({ onBack }: Props): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [allBundles, setAllBundles] = useState<SessionBundle[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [selectedBundle, setSelectedBundle] = useState<SessionBundle | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const rtbExportInProgress = useRef(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessions, resumes, jds] = await Promise.all([
        sessionDB.getAll(),
        resumeDB.getAll(),
        jobDescriptionDB.getAll(),
      ]);
      const resumeMap = new Map(resumes.map((r) => [r.id, r]));
      const jdMap = new Map(jds.map((jd) => [jd.id, jd]));
      setAllBundles(buildBundles(sessions, resumeMap, jdMap));
    } catch (err) {
      console.error('Failed to load tracker data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered bundles for display
  const filteredBundles = search.trim()
    ? allBundles.filter((b) => {
        const q = search.toLowerCase();
        const title = (b.jobDescription?.title ?? '').toLowerCase();
        const company = (b.jobDescription?.company ?? '').toLowerCase();
        return title.includes(q) || company.includes(q);
      })
    : allBundles;

  // Stats
  const totalCount = allBundles.length;
  const activeCount = allBundles.filter((b) =>
    ACTIVE_STATUSES.includes(b.session.applicationStatus ?? 'none')
  ).length;
  const offerCount = allBundles.filter((b) =>
    OFFER_STATUSES.includes(b.session.applicationStatus ?? 'none')
  ).length;

  // Excel export
  const handleExcelExport = async () => {
    try {
      await exportToExcel(allBundles);
      showToast('Exported to Excel');
    } catch (err) {
      console.error('Excel export failed:', err);
      showToast('Export failed');
    }
  };

  // Excel import
  const handleExcelImport = async (file: File) => {
    try {
      const result: ImportResult = await importFromExcel(file);
      const msg = `Imported ${result.imported} new, updated ${result.updated}${result.skipped > 0 ? `, skipped ${result.skipped}` : ''}`;
      showToast(msg);
      await loadData();
    } catch (err) {
      console.error('Excel import failed:', err);
      showToast('Import failed');
    }
  };

  // RTB export all
  const handleRtbExport = async () => {
    if (rtbExportInProgress.current) return;
    rtbExportInProgress.current = true;
    try {
      const blob = await exportAllSessionsFile(allBundles);
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `all-sessions-${date}.rtb`);
      showToast('All sessions exported');
    } catch (err) {
      console.error('RTB export failed:', err);
      showToast('Export failed');
    } finally {
      rtbExportInProgress.current = false;
    }
  };

  // Handle drag-and-drop status change from board
  const handleStatusChange = async (sessionId: string, newStatus: ApplicationStatus) => {
    const bundle = allBundles.find((b) => b.session.id === sessionId);
    if (!bundle) return;
    const updated: TailoringSession = {
      ...bundle.session,
      applicationStatus: newStatus,
      appliedAt: newStatus === 'applied' && !bundle.session.appliedAt
        ? new Date().toISOString()
        : bundle.session.appliedAt,
      updatedAt: new Date().toISOString(),
    };
    try {
      await sessionDB.save(updated);
      await loadData();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Save bundle after modal edit
  const handleSave = async (updated: TailoringSession) => {
    try {
      await sessionDB.save(updated);
      await loadData();
      setSelectedBundle(null);
      showToast('Application updated');
    } catch (err) {
      console.error('Failed to save:', err);
      showToast('Save failed');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-dark-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-dark-border bg-dark-surface/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-text-primary">Application Tracker</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Toast */}
          {toast && (
            <span className="text-xs text-accent-green font-medium mr-2 transition-opacity">
              {toast}
            </span>
          )}

          {/* Export Excel */}
          <button
            onClick={handleExcelExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary border border-dark-border rounded-lg hover:bg-dark-hover hover:text-text-primary transition-colors"
            title="Export to Excel"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel
          </button>

          {/* Import Excel */}
          <button
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary border border-dark-border rounded-lg hover:bg-dark-hover hover:text-text-primary transition-colors"
            title="Import from Excel"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
            </svg>
            Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleExcelImport(file);
                e.target.value = '';
              }
            }}
          />

          {/* Export RTB */}
          <button
            onClick={handleRtbExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary border border-dark-border rounded-lg hover:bg-dark-hover hover:text-text-primary transition-colors"
            title="Export all sessions as .rtb"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            .rtb
          </button>
        </div>
      </header>

      {/* Stats bar */}
      {!loading && (
        <div className="flex items-center gap-6 px-6 py-2.5 bg-dark-surface border-b border-dark-border flex-shrink-0">
          <span className="text-sm text-text-secondary">
            <span className="text-text-primary font-semibold">{totalCount}</span> applications
          </span>
          <span className="text-sm text-text-secondary">
            <span className="text-accent-blue font-semibold">{activeCount}</span> active
          </span>
          <span className="text-sm text-text-secondary">
            <span className="text-accent-green font-semibold">{offerCount}</span> offer{offerCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-dark-border bg-dark-surface flex-shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or company..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-dark-border bg-dark-elevated text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue"
          />
        </div>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-dark-border overflow-hidden">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-accent-blue text-dark-bg'
                : 'text-text-secondary hover:text-text-primary hover:bg-dark-hover'
            }`}
          >
            Table
          </button>
          <button
            onClick={() => setViewMode('board')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'board'
                ? 'bg-accent-blue text-dark-bg'
                : 'text-text-secondary hover:text-text-primary hover:bg-dark-hover'
            }`}
          >
            Board
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'chart'
                ? 'bg-accent-blue text-dark-bg'
                : 'text-text-secondary hover:text-text-primary hover:bg-dark-hover'
            }`}
          >
            Flow
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-text-secondary">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-dark-surface border border-dark-border rounded-xl overflow-hidden">
            <TrackerTable bundles={filteredBundles} onSelectBundle={setSelectedBundle} />
          </div>
        ) : viewMode === 'board' ? (
          <div className="h-full">
            <TrackerBoard bundles={filteredBundles} onSelectBundle={setSelectedBundle} onStatusChange={handleStatusChange} />
          </div>
        ) : (
          <SankeyChart bundles={filteredBundles} />
        )}
      </main>

      {/* Application Detail Modal */}
      {selectedBundle && (
        <ApplicationDetailModal
          session={selectedBundle.session}
          resume={selectedBundle.resume}
          jobDescription={selectedBundle.jobDescription}
          onClose={() => setSelectedBundle(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
