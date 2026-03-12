import { useState } from 'react';
import {
  TailoringSession,
  StoredResume,
  StoredJobDescription,
  ApplicationStatus,
  ApplicationTracking,
  InterviewRound,
} from '../../types/storage';

interface Props {
  session: TailoringSession;
  resume: StoredResume | null;
  jobDescription: StoredJobDescription | null;
  onClose: () => void;
  onSave: (updated: TailoringSession) => void;
}

const STATUS_OPTIONS: ApplicationStatus[] = [
  'none', 'saved', 'applied', 'phone-screen',
  'interview-1', 'interview-2', 'interview-3', 'take-home',
  'offered', 'accepted', 'rejected', 'withdrawn',
];

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

const INTERVIEW_TYPES: InterviewRound['type'][] = [
  'phone', 'technical', 'behavioral', 'system-design', 'hiring-manager', 'panel', 'other',
];

const INTERVIEW_OUTCOMES: NonNullable<InterviewRound['outcome']>[] = [
  'passed', 'failed', 'pending', 'cancelled',
];

const OUTCOME_COLORS: Record<NonNullable<InterviewRound['outcome']>, string> = {
  passed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

interface NewRoundForm {
  round: string;
  type: InterviewRound['type'];
  date: string;
  interviewerName: string;
  notes: string;
  outcome: NonNullable<InterviewRound['outcome']> | '';
}

const emptyRoundForm: NewRoundForm = {
  round: '',
  type: 'phone',
  date: '',
  interviewerName: '',
  notes: '',
  outcome: '',
};

export default function ApplicationDetailModal({
  session,
  resume,
  jobDescription,
  onClose,
  onSave,
}: Props): JSX.Element {
  const tracking = session.tracking ?? { interviews: [] };

  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus>(
    session.applicationStatus ?? 'none'
  );
  const [applicationUrl, setApplicationUrl] = useState(tracking.applicationUrl ?? '');
  const [appliedDate, setAppliedDate] = useState(
    session.appliedAt ? session.appliedAt.slice(0, 10) : ''
  );
  const [appliedVia, setAppliedVia] = useState(tracking.appliedVia ?? '');
  const [salary, setSalary] = useState(tracking.salary ?? '');
  const [contactName, setContactName] = useState(tracking.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(tracking.contactEmail ?? '');
  const [notes, setNotes] = useState(tracking.notes ?? '');
  const [tagsInput, setTagsInput] = useState((tracking.tags ?? []).join(', '));
  const [tags, setTags] = useState<string[]>(tracking.tags ?? []);
  const [nextFollowUp, setNextFollowUp] = useState(
    tracking.nextFollowUp ? tracking.nextFollowUp.slice(0, 10) : ''
  );
  const [interviews, setInterviews] = useState<InterviewRound[]>(
    tracking.interviews ?? []
  );
  const [showAddRound, setShowAddRound] = useState(false);
  const [newRound, setNewRound] = useState<NewRoundForm>(emptyRoundForm);

  const handleTagsBlur = () => {
    const parsed = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    setTags(parsed);
  };

  const handleAddRound = () => {
    const roundNum = parseInt(newRound.round, 10);
    if (isNaN(roundNum) || roundNum < 1) return;

    const round: InterviewRound = {
      round: roundNum,
      type: newRound.type,
      date: newRound.date || undefined,
      interviewerName: newRound.interviewerName || undefined,
      notes: newRound.notes || undefined,
      outcome: (newRound.outcome as InterviewRound['outcome']) || undefined,
    };

    setInterviews((prev) => [...prev, round]);
    setNewRound(emptyRoundForm);
    setShowAddRound(false);
  };

  const handleDeleteRound = (idx: number) => {
    setInterviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const updatedTracking: ApplicationTracking = {
      applicationUrl: applicationUrl || undefined,
      appliedVia: appliedVia || undefined,
      contactName: contactName || undefined,
      contactEmail: contactEmail || undefined,
      salary: salary || undefined,
      notes: notes || undefined,
      interviews,
      nextFollowUp: nextFollowUp ? new Date(nextFollowUp).toISOString() : undefined,
      tags: tags.length > 0 ? tags : undefined,
    };

    const updated: TailoringSession = {
      ...session,
      applicationStatus,
      appliedAt: appliedDate ? new Date(appliedDate).toISOString() : session.appliedAt,
      tracking: updatedTracking,
      updatedAt: new Date().toISOString(),
    };

    onSave(updated);
  };

  const jobTitle = jobDescription?.title ?? 'Unknown Job';
  const company = jobDescription?.company ?? '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] bg-dark-surface border border-dark-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-dark-border flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{jobTitle}</h2>
            {company && (
              <p className="text-sm text-text-secondary mt-0.5">{company}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-dark-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
              Application Status
            </label>
            <select
              value={applicationStatus}
              onChange={(e) => setApplicationStatus(e.target.value as ApplicationStatus)}
              className={`w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-elevated text-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-accent-blue ${STATUS_COLORS[applicationStatus]}`}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="bg-dark-surface text-text-primary">
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {/* Application Details */}
          <div>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
              Application Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-text-muted mb-1">Application URL</label>
                <input
                  type="url"
                  value={applicationUrl}
                  onChange={(e) => setApplicationUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-elevated text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Applied Date</label>
                <input
                  type="date"
                  value={appliedDate}
                  onChange={(e) => setAppliedDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-elevated text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Applied Via</label>
                <input
                  type="text"
                  value={appliedVia}
                  onChange={(e) => setAppliedVia(e.target.value)}
                  placeholder="LinkedIn, Indeed..."
                  className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-elevated text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Salary / Range</label>
                <input
                  type="text"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="$120k–$140k"
                  className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-elevated text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue"
                />
              </div>
              {resume && (
                <div>
                  <label className="block text-xs text-text-muted mb-1">Resume Used</label>
                  <div className="px-3 py-2 rounded-lg border border-dark-border bg-dark-elevated text-sm text-text-secondary truncate">
                    {resume.name}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
              Contact
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Contact Name</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Recruiter name"
                  className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-elevated text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Contact Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="recruiter@company.com"
                  className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-elevated text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any notes about this application..."
              className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-elevated text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:ring-1 focus:ring-accent-blue"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
              Tags
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onBlur={handleTagsBlur}
              placeholder="startup, remote, fintech (comma-separated)"
              className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-elevated text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Next Follow-up */}
          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
              Next Follow-up
            </label>
            <input
              type="date"
              value={nextFollowUp}
              onChange={(e) => setNextFollowUp(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-elevated text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
            />
          </div>

          {/* Interview Rounds */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Interview Rounds ({interviews.length})
              </h3>
              <button
                onClick={() => setShowAddRound((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-accent-blue hover:text-accent-blue/80 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Round
              </button>
            </div>

            {/* Existing rounds */}
            {interviews.length > 0 && (
              <div className="space-y-2 mb-3">
                {interviews.map((round, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg bg-dark-elevated border border-dark-border"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-medium text-text-muted w-8 flex-shrink-0">
                        R{round.round}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-text-primary capitalize">
                          {round.type.replace('-', ' ')}
                          {round.interviewerName && (
                            <span className="text-text-muted"> — {round.interviewerName}</span>
                          )}
                        </p>
                        {round.date && (
                          <p className="text-xs text-text-muted">{round.date.slice(0, 10)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {round.outcome && (
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${OUTCOME_COLORS[round.outcome]}`}>
                          {round.outcome}
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteRound(idx)}
                        className="p-1 rounded hover:bg-dark-hover text-text-muted hover:text-accent-red transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add round form */}
            {showAddRound && (
              <div className="p-4 rounded-lg border border-dark-border bg-dark-elevated space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Round #</label>
                    <input
                      type="number"
                      min={1}
                      value={newRound.round}
                      onChange={(e) => setNewRound((r) => ({ ...r, round: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-lg border border-dark-border bg-dark-surface text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Type</label>
                    <select
                      value={newRound.type}
                      onChange={(e) =>
                        setNewRound((r) => ({ ...r, type: e.target.value as InterviewRound['type'] }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-dark-border bg-dark-surface text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
                    >
                      {INTERVIEW_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t.replace('-', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Date</label>
                    <input
                      type="date"
                      value={newRound.date}
                      onChange={(e) => setNewRound((r) => ({ ...r, date: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-lg border border-dark-border bg-dark-surface text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Interviewer</label>
                    <input
                      type="text"
                      value={newRound.interviewerName}
                      onChange={(e) => setNewRound((r) => ({ ...r, interviewerName: e.target.value }))}
                      placeholder="Name (optional)"
                      className="w-full px-3 py-1.5 rounded-lg border border-dark-border bg-dark-surface text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Outcome</label>
                    <select
                      value={newRound.outcome}
                      onChange={(e) =>
                        setNewRound((r) => ({
                          ...r,
                          outcome: e.target.value as NonNullable<InterviewRound['outcome']> | '',
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-dark-border bg-dark-surface text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
                    >
                      <option value="">-- pending --</option>
                      {INTERVIEW_OUTCOMES.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-text-muted mb-1">Notes</label>
                    <textarea
                      value={newRound.notes}
                      onChange={(e) => setNewRound((r) => ({ ...r, notes: e.target.value }))}
                      rows={2}
                      placeholder="Optional notes..."
                      className="w-full px-3 py-1.5 rounded-lg border border-dark-border bg-dark-surface text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:ring-1 focus:ring-accent-blue"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setShowAddRound(false); setNewRound(emptyRoundForm); }}
                    className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddRound}
                    disabled={!newRound.round}
                    className="px-3 py-1.5 text-xs bg-accent-blue text-dark-bg rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
                  >
                    Add Round
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-dark-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-dark-border rounded-lg hover:bg-dark-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-accent-blue text-dark-bg rounded-lg hover:bg-opacity-90 transition-colors font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
