import { useState, useEffect } from 'react';
import { TailoringSession, StoredResume, StoredJobDescription, ApplicationStatus } from '../../types/storage';
import { sessionDB, resumeDB, jobDescriptionDB } from '../../services/db';
import { SessionBundle } from '../../services/sessionFile';
import ApplicationDetailModal from './ApplicationDetailModal';

interface Props {
  onBack: () => void;
  onOpenTracker: () => void;
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  none: 'No Status',
  saved: 'Saved',
  applied: 'Applied',
  'phone-screen': 'Phone Screen',
  'interview-1': 'Interview 1',
  'interview-2': 'Interview 2',
  'interview-3': 'Interview 3+',
  'take-home': 'Take-Home',
  offered: 'Offered',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  none: 'bg-gray-500/20 text-gray-400',
  saved: 'bg-gray-500/20 text-gray-400',
  applied: 'bg-yellow-500/20 text-yellow-400',
  'phone-screen': 'bg-blue-500/20 text-blue-400',
  'interview-1': 'bg-blue-500/20 text-blue-400',
  'interview-2': 'bg-blue-500/20 text-blue-400',
  'interview-3': 'bg-blue-500/20 text-blue-400',
  'take-home': 'bg-blue-500/20 text-blue-400',
  offered: 'bg-green-500/20 text-green-400',
  accepted: 'bg-emerald-500/20 text-emerald-400',
  rejected: 'bg-red-500/20 text-red-400',
  withdrawn: 'bg-orange-500/20 text-orange-400',
};

function getCurrentStage(session: TailoringSession): string {
  const interviews = session.tracking?.interviews ?? [];
  if (interviews.length > 0) {
    const latest = [...interviews].sort((a, b) => b.round - a.round)[0];
    return `Round ${latest.round}: ${latest.type.replace('-', ' ')}`;
  }
  return STATUS_LABELS[session.applicationStatus ?? 'none'] ?? session.applicationStatus ?? 'none';
}

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
    .filter((b): b is SessionBundle => b.resume !== null && b.jobDescription !== null)
    .sort((a, b) =>
      new Date(b.session.updatedAt).getTime() - new Date(a.session.updatedAt).getTime()
    );
}

type StatusFilter = ApplicationStatus | 'all';

const STATUS_GROUPS: { label: string; statuses: ApplicationStatus[] }[] = [
  {
    label: 'Active',
    statuses: ['applied', 'phone-screen', 'interview-1', 'interview-2', 'interview-3', 'take-home'],
  },
  {
    label: 'Outcomes',
    statuses: ['offered', 'accepted', 'rejected', 'withdrawn'],
  },
  {
    label: 'Other',
    statuses: ['saved', 'none'],
  },
];

export default function ApplicationsPage({ onBack, onOpenTracker }: Props): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [allBundles, setAllBundles] = useState<SessionBundle[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedBundle, setSelectedBundle] = useState<SessionBundle | null>(null);

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
      console.error('Failed to load applications data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredBundles = allBundles.filter((b) => {
    if (statusFilter !== 'all') {
      const appStatus = b.session.applicationStatus ?? 'none';
      if (appStatus !== statusFilter) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const title = (b.jobDescription?.title ?? '').toLowerCase();
      const company = (b.jobDescription?.company ?? '').toLowerCase();
      if (!title.includes(q) && !company.includes(q)) return false;
    }
    return true;
  });

  const handleSave = async (updated: TailoringSession) => {
    try {
      await sessionDB.save(updated);
      await loadData();
      setSelectedBundle(null);
    } catch (err) {
      console.error('Failed to save:', err);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-dark-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-dark-border bg-dark-surface/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-text-primary">My Applications</h1>
          {!loading && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
              {allBundles.length}
            </span>
          )}
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-dark-hover rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </header>

      {/* Filter / Search row */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-dark-border bg-dark-surface flex-shrink-0">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-1.5 rounded-lg border border-dark-border bg-dark-elevated text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
        >
          <option value="all">All Statuses</option>
          {STATUS_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.statuses.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

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

        <div className="flex-1" />

        <button
          onClick={onOpenTracker}
          className="flex items-center gap-1.5 text-sm text-accent-blue hover:text-accent-blue/80 transition-colors"
        >
          Open Full Tracker
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-h-0">
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
        ) : filteredBundles.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-text-muted text-center max-w-xs">
              {allBundles.length === 0
                ? 'No applications yet. Start tailoring a resume to track your applications.'
                : 'No applications match your filters.'}
            </p>
          </div>
        ) : (
          <div className="bg-dark-surface border-b border-dark-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Job Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Applied Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Resume Used
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Current Stage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {filteredBundles.map((bundle) => {
                  const appStatus = bundle.session.applicationStatus ?? 'none';
                  return (
                    <tr
                      key={bundle.session.id}
                      onClick={() => setSelectedBundle(bundle)}
                      className="hover:bg-dark-hover cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                        {bundle.jobDescription?.title ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                        {bundle.jobDescription?.company ?? '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[appStatus]}`}
                        >
                          {STATUS_LABELS[appStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                        {bundle.session.appliedAt
                          ? bundle.session.appliedAt.slice(0, 10)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap max-w-[160px] truncate">
                        {bundle.resume?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap capitalize">
                        {getCurrentStage(bundle.session)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

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
