import { useState } from 'react';
import { ApplicationStatus } from '../../types/storage';
import { SessionBundle } from '../../services/sessionFile';

interface Props {
  bundles: SessionBundle[];
  onSelectBundle: (bundle: SessionBundle) => void;
}

type SortKey = 'jobTitle' | 'company' | 'status' | 'appliedDate' | 'resumeUsed' | 'tags' | 'lastUpdated';
type SortDir = 'asc' | 'desc';

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

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

export default function TrackerTable({ bundles, onSelectBundle }: Props): JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>('lastUpdated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...bundles].sort((a, b) => {
    let valA: string;
    let valB: string;

    switch (sortKey) {
      case 'jobTitle':
        valA = a.jobDescription?.title ?? '';
        valB = b.jobDescription?.title ?? '';
        break;
      case 'company':
        valA = a.jobDescription?.company ?? '';
        valB = b.jobDescription?.company ?? '';
        break;
      case 'status':
        valA = a.session.applicationStatus ?? 'none';
        valB = b.session.applicationStatus ?? 'none';
        break;
      case 'appliedDate':
        valA = a.session.appliedAt ?? '';
        valB = b.session.appliedAt ?? '';
        break;
      case 'resumeUsed':
        valA = a.resume?.name ?? '';
        valB = b.resume?.name ?? '';
        break;
      case 'tags':
        valA = (a.session.tracking?.tags ?? []).join(', ');
        valB = (b.session.tracking?.tags ?? []).join(', ');
        break;
      case 'lastUpdated':
        valA = a.session.updatedAt ?? '';
        valB = b.session.updatedAt ?? '';
        break;
      default:
        valA = '';
        valB = '';
    }

    const cmp = valA.localeCompare(valB);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) {
      return (
        <svg className="w-3 h-3 text-text-muted opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDir === 'asc' ? (
      <svg className="w-3 h-3 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3 h-3 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const columns: { key: SortKey; label: string; sortable: boolean }[] = [
    { key: 'jobTitle', label: 'Job Title', sortable: true },
    { key: 'company', label: 'Company', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'appliedDate', label: 'Applied Date', sortable: true },
    { key: 'resumeUsed', label: 'Resume Used', sortable: true },
    { key: 'tags', label: 'Tags', sortable: false },
    { key: 'lastUpdated', label: 'Last Updated', sortable: true },
  ];

  if (bundles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <svg className="w-12 h-12 text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-text-secondary text-sm">No applications tracked yet</p>
        <p className="text-text-muted text-xs mt-1">Create a session and set an application status to start tracking</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dark-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap ${
                  col.sortable ? 'cursor-pointer hover:text-text-primary select-none' : ''
                }`}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <div className="flex items-center gap-1.5">
                  {col.label}
                  {col.sortable && <SortIcon col={col.key} />}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-dark-border">
          {sorted.map((bundle) => {
            const status = bundle.session.applicationStatus ?? 'none';
            const tags = bundle.session.tracking?.tags ?? [];
            return (
              <tr
                key={bundle.session.id}
                onClick={() => onSelectBundle(bundle)}
                className="hover:bg-dark-hover cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-text-primary font-medium max-w-[200px] truncate">
                  {bundle.jobDescription?.title ?? '—'}
                </td>
                <td className="px-4 py-3 text-text-secondary max-w-[150px] truncate">
                  {bundle.jobDescription?.company ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                  {formatDate(bundle.session.appliedAt)}
                </td>
                <td className="px-4 py-3 text-text-secondary max-w-[150px] truncate">
                  {bundle.resume?.name ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 max-w-[180px]">
                    {tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 text-xs rounded bg-accent-blue/10 text-accent-blue"
                      >
                        {tag}
                      </span>
                    ))}
                    {tags.length > 3 && (
                      <span className="text-xs text-text-muted">+{tags.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                  {formatDate(bundle.session.updatedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
