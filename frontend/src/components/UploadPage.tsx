import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { ParsedResume, TailoredData } from '../types';
import { ApplicationStatus } from '../types/storage';
import { SettingsModal } from './SettingsModal';
import { useAppContext, SessionSummary, ExportedSession, SavedResumeSummary, SavedJobDescriptionSummary } from '../context/AppContext';
import { importSessionFile } from '../services/sessionFile';

interface UploadPageProps {
  onTailoringComplete: (
    resume: ParsedResume,
    tailoredData: TailoredData,
    resumeText?: string,
    jobDescription?: string
  ) => void;
}

type ProgressStep = 'idle' | 'parsing' | 'analyzing' | 'tailoring' | 'complete';

interface StepInfo {
  key: ProgressStep;
  label: string;
  description: string;
}

const STEPS: StepInfo[] = [
  { key: 'parsing', label: 'Parsing resume', description: 'Extracting sections, skills, and experience from your resume...' },
  { key: 'analyzing', label: 'Analyzing job description', description: 'Identifying key requirements and keywords from the job posting...' },
  { key: 'tailoring', label: 'Tailoring suggestions', description: 'Generating optimized content to match the job requirements...' },
  { key: 'complete', label: 'Done', description: 'Your tailored resume is ready!' },
];

const APPLICATION_STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; bg: string; border: string }> = {
  none: { label: 'No Status', color: 'text-text-muted', bg: 'bg-dark-elevated', border: 'border-dark-border' },
  applied: { label: 'Applied', color: 'text-accent-blue', bg: 'bg-accent-blue/10', border: 'border-accent-blue/30' },
  interviewing: { label: 'Interviewing', color: 'text-accent-yellow', bg: 'bg-accent-yellow/10', border: 'border-accent-yellow/30' },
  offered: { label: 'Offered', color: 'text-accent-green', bg: 'bg-accent-green/10', border: 'border-accent-green/30' },
  rejected: { label: 'Rejected', color: 'text-accent-red', bg: 'bg-accent-red/10', border: 'border-accent-red/30' },
};

const STATUS_ORDER: ApplicationStatus[] = ['applied', 'interviewing', 'offered', 'rejected'];

export const UploadPage: React.FC<UploadPageProps> = ({ onTailoringComplete: _onTailoringComplete }) => {
  const {
    hasActiveSession,
    resumeSession,
    getSavedSessions,
    getSavedResumes,
    getSavedJobDescriptions,
    getResumeById,
    getJobDescriptionById,
    saveResumeOnly,
    saveJobDescriptionOnly,
    deleteSession,
    importSession,
    startSessionWithExistingResume,
    updateApplicationStatus,
  } = useAppContext();

  // Three-step flow state
  type UploadStep = 'resume' | 'job' | 'tailor';
  const [currentStep, setCurrentStep] = useState<UploadStep>('resume');
  const [parsedResumeId, setParsedResumeId] = useState<string | null>(null);
  const [parsedResumeName, setParsedResumeName] = useState<string>('');

  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [progress, setProgress] = useState<ProgressStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [llmStatus, setLlmStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [llmError, setLlmError] = useState<string | null>(null);

  // Session management state
  const [savedSessions, setSavedSessions] = useState<SessionSummary[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const rtbInputRef = useRef<HTMLInputElement>(null);
  const [rtbError, setRtbError] = useState<string | null>(null);

  // Saved resumes state
  const [savedResumes, setSavedResumes] = useState<SavedResumeSummary[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [showResumes, setShowResumes] = useState(false);

  // Saved job descriptions state
  const [savedJobDescriptions, setSavedJobDescriptions] = useState<SavedJobDescriptionSummary[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showSavedJobs, setShowSavedJobs] = useState(false);

  // Job description input mode
  type JobInputMode = 'paste' | 'url';
  const [jobInputMode, setJobInputMode] = useState<JobInputMode>('url');
  const [jobUrl, setJobUrl] = useState('');
  const [scrapingJob, setScrapingJob] = useState(false);

  // Tracker view
  const [showTracker, setShowTracker] = useState(false);

  // Status dropdown state
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);

  const loading = progress !== 'idle';

  // Load saved sessions, resumes, and job descriptions
  useEffect(() => {
    const loadData = async () => {
      setLoadingSessions(true);
      const [sessions, resumes, jobDescs] = await Promise.all([
        getSavedSessions(),
        getSavedResumes(),
        getSavedJobDescriptions(),
      ]);
      setSavedSessions(sessions);
      setSavedResumes(resumes);
      setSavedJobDescriptions(jobDescs);
      setLoadingSessions(false);
    };
    loadData();
  }, [getSavedSessions, getSavedResumes, getSavedJobDescriptions]);

  const handleSelectResume = (resumeId: string) => {
    setSelectedResumeId(resumeId);
    setFile(null); // Clear file if selecting saved resume
    setShowResumes(false);
  };

  const handleClearSelectedResume = () => {
    setSelectedResumeId(null);
  };

  const handleSelectJob = async (jobId: string) => {
    const jd = await getJobDescriptionById(jobId);
    if (jd) {
      setSelectedJobId(jobId);
      setJobDescription(jd.content);
      if (jd.url) setJobUrl(jd.url);
      setShowSavedJobs(false);
    }
  };

  const handleClearSelectedJob = () => {
    setSelectedJobId(null);
    setJobDescription('');
    setJobUrl('');
  };

  const handleResumeSession = async (sessionId: string) => {
    await resumeSession(sessionId);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this session? This cannot be undone.')) {
      await deleteSession(sessionId);
      setSavedSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }
  };

  const handleStatusChange = async (sessionId: string, status: ApplicationStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    await updateApplicationStatus(sessionId, status);
    setSavedSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, applicationStatus: status, appliedAt: status === 'applied' && !s.appliedAt ? new Date().toISOString() : s.appliedAt }
          : s
      )
    );
    setStatusDropdownId(null);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as ExportedSession;
      const success = await importSession(data);
      if (!success) {
        setError('Failed to import session. The file may be invalid.');
      }
    } catch {
      setError('Failed to read session file. Please ensure it\'s a valid JSON file.');
    }

    // Reset input
    if (importInputRef.current) {
      importInputRef.current.value = '';
    }
  };

  const handleRtbRestoreClick = () => {
    setRtbError(null);
    rtbInputRef.current?.click();
  };

  const handleRtbFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRtbError(null);

    try {
      const bundles = await importSessionFile(file);
      if (bundles.length === 0) {
        setRtbError('No sessions found in file.');
        return;
      }

      // Import all bundles; navigate is handled by importSession on each call
      let firstSuccess = false;
      for (const bundle of bundles) {
        const data: ExportedSession = {
          version: 1,
          exportedAt: new Date().toISOString(),
          resume: bundle.resume,
          jobDescription: bundle.jobDescription,
          session: bundle.session,
        };
        const success = await importSession(data);
        if (success && !firstSuccess) {
          firstSuccess = true;
        }
      }

      if (!firstSuccess) {
        setRtbError('Failed to restore session from file.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to read .rtb file.';
      setRtbError(message);
    }

    // Reset input
    if (rtbInputRef.current) {
      rtbInputRef.current.value = '';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Ping the LLM on mount and when settings close to verify real connectivity.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setLlmStatus('checking');
      setLlmError(null);
      const result = await api.checkHealth();
      if (cancelled) return;
      if (result.connected) {
        setLlmStatus('connected');
      } else {
        // Retry once after 3s in case backend is still starting
        await new Promise(r => setTimeout(r, 3000));
        if (cancelled) return;
        const retry = await api.checkHealth();
        if (cancelled) return;
        if (retry.connected) {
          setLlmStatus('connected');
        } else {
          setLlmStatus('disconnected');
          setLlmError(retry.error || 'Cannot connect to LLM');
        }
      }
    };
    check();
    return () => { cancelled = true; };
  }, [settingsOpen]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setSelectedResumeId(null); // Clear saved resume selection when uploading new file
      setError(null);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.type === 'application/pdf' || droppedFile.name.endsWith('.docx'))) {
      setFile(droppedFile);
      setSelectedResumeId(null); // Clear saved resume selection when uploading new file
      setError(null);
    } else {
      setError('Please upload a PDF or DOCX file');
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  };

  // Step 1: Parse resume or select saved one, then advance to step 2
  const handleResumeStep = async () => {
    if (selectedResumeId) {
      // Already saved — just advance
      const savedResume = savedResumes.find(r => r.id === selectedResumeId);
      setParsedResumeId(selectedResumeId);
      setParsedResumeName(savedResume?.name || 'Saved Resume');
      setError(null);
      setCurrentStep('job');
      return;
    }

    if (!file) {
      setError('Please upload a resume or select a saved one');
      return;
    }

    setError(null);

    try {
      setProgress('parsing');
      const resumeResult = await api.parseResume(file);
      const resumeText = resumeResult.raw_text || '';

      // Save to IndexedDB
      const resumeId = await saveResumeOnly(resumeResult, resumeText, file.name);

      setParsedResumeId(resumeId);
      setParsedResumeName(file.name);

      // Refresh saved resumes list
      const resumes = await getSavedResumes();
      setSavedResumes(resumes);

      setProgress('idle');
      setCurrentStep('job');
    } catch (err: unknown) {
      console.error('Error:', err);
      let errorMessage = 'Failed to parse resume. Please try again.';
      if (err && typeof err === 'object') {
        const axiosError = err as { response?: { data?: { detail?: string } }; message?: string };
        if (axiosError.response?.data?.detail) {
          errorMessage = axiosError.response.data.detail;
        } else if (axiosError.message) {
          errorMessage = axiosError.message;
        }
      }
      setError(errorMessage);
    } finally {
      setProgress('idle');
    }
  };

  // Step 2: Tailor resume with job description
  const handleTailorStep = async () => {
    if (!parsedResumeId) {
      setError('No resume selected');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Please paste a job description');
      return;
    }

    setError(null);

    try {
      const savedResume = await getResumeById(parsedResumeId);
      if (!savedResume) {
        setError('Resume not found. Please go back and re-upload.');
        return;
      }

      setProgress('analyzing');
      await new Promise(r => setTimeout(r, 400));

      setProgress('tailoring');
      const tailoredResult = await api.tailorResume(savedResume.rawText, jobDescription);

      setProgress('complete');
      await new Promise(r => setTimeout(r, 600));

      // JD is already auto-saved by handleJobStep or handleScrapeJob
      await startSessionWithExistingResume(parsedResumeId, jobDescription, tailoredResult, selectedJobId || undefined);
    } catch (err: unknown) {
      console.error('Error:', err);
      let errorMessage = 'Failed to process resume. Please try again.';
      if (err && typeof err === 'object') {
        const axiosError = err as { response?: { data?: { detail?: string } }; message?: string };
        if (axiosError.response?.data?.detail) {
          errorMessage = axiosError.response.data.detail;
        } else if (axiosError.message) {
          errorMessage = axiosError.message;
        }
      }
      setError(errorMessage);
    } finally {
      setProgress('idle');
    }
  };

  // Step 2: Confirm job description and advance to tailor
  const handleJobStep = async () => {
    if (!jobDescription.trim()) {
      setError('Please provide a job description');
      return;
    }
    setError(null);

    // Auto-save if not already a saved JD
    if (!selectedJobId) {
      const firstLine = jobDescription.split('\n')[0].substring(0, 50);
      const savedId = await saveJobDescriptionOnly(
        firstLine || 'Untitled Job',
        jobDescription,
        jobUrl || undefined
      );
      setSelectedJobId(savedId);

      // Refresh saved JDs list
      const jds = await getSavedJobDescriptions();
      setSavedJobDescriptions(jds);
    }

    setCurrentStep('tailor');
  };

  const handleChangeJob = () => {
    setCurrentStep('job');
    setError(null);
  };

  // Scrape job description from URL
  const handleScrapeJob = async () => {
    if (!jobUrl.trim()) {
      setError('Please enter a job posting URL');
      return;
    }

    setError(null);
    setScrapingJob(true);

    try {
      const result = await api.scrapeJob(jobUrl.trim());
      setJobDescription(result.text);

      // Auto-save the scraped JD
      const title = result.title || result.text.split('\n')[0].substring(0, 50) || 'Untitled Job';
      const savedId = await saveJobDescriptionOnly(
        title,
        result.text,
        jobUrl.trim(),
        result.company || undefined
      );
      setSelectedJobId(savedId);

      // Refresh saved JDs list
      const jds = await getSavedJobDescriptions();
      setSavedJobDescriptions(jds);

      // Auto-advance to tailor step
      setCurrentStep('tailor');
    } catch (err: unknown) {
      let errorMessage = 'Failed to scrape job posting.';
      if (err && typeof err === 'object') {
        const axiosError = err as { response?: { data?: { detail?: string } }; message?: string };
        if (axiosError.response?.data?.detail) {
          errorMessage = axiosError.response.data.detail;
        } else if (axiosError.message) {
          errorMessage = axiosError.message;
        }
      }
      setError(errorMessage);
    } finally {
      setScrapingJob(false);
    }
  };

  const handleChangeResume = () => {
    setCurrentStep('resume');
    setParsedResumeId(null);
    setParsedResumeName('');
    setError(null);
  };

  // Tracker: group sessions by status
  const trackedSessions = savedSessions.filter(s => s.applicationStatus && s.applicationStatus !== 'none');

  const renderStatusBadge = (status: ApplicationStatus) => {
    if (status === 'none') return null;
    const config = APPLICATION_STATUS_CONFIG[status];
    return (
      <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${config.color} ${config.bg} border ${config.border}`}>
        {config.label}
      </span>
    );
  };

  const renderStatusDropdown = (session: SessionSummary) => {
    const isOpen = statusDropdownId === session.id;
    const currentStatus = session.applicationStatus || 'none';

    return (
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setStatusDropdownId(isOpen ? null : session.id);
          }}
          className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors ${
            currentStatus === 'none'
              ? 'text-text-muted hover:text-text-secondary hover:bg-dark-hover'
              : `${APPLICATION_STATUS_CONFIG[currentStatus].color} ${APPLICATION_STATUS_CONFIG[currentStatus].bg}`
          }`}
        >
          {currentStatus === 'none' ? 'Set status' : APPLICATION_STATUS_CONFIG[currentStatus].label}
          <svg className="w-3 h-3 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setStatusDropdownId(null); }} />
            <div className="absolute right-0 mt-1 w-36 bg-dark-surface border border-dark-border rounded-lg shadow-xl z-20 overflow-hidden">
              {currentStatus !== 'none' && (
                <button
                  onClick={(e) => handleStatusChange(session.id, 'none', e)}
                  className="w-full px-3 py-2 text-xs text-text-muted hover:bg-dark-hover transition-colors text-left"
                >
                  Clear status
                </button>
              )}
              {STATUS_ORDER.map((status) => (
                <button
                  key={status}
                  onClick={(e) => handleStatusChange(session.id, status, e)}
                  className={`w-full px-3 py-2 text-xs hover:bg-dark-hover transition-colors text-left ${
                    currentStatus === status ? 'font-medium ' + APPLICATION_STATUS_CONFIG[status].color : 'text-text-primary'
                  }`}
                >
                  {APPLICATION_STATUS_CONFIG[status].label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-dark-border flex items-center justify-between bg-dark-surface/80 backdrop-blur-sm">
        <h1 className="text-xl font-semibold text-text-primary">Resume Tailor</h1>
        <div className="flex items-center gap-3">
          {/* LLM connection status badge */}
          <button
            onClick={() => llmStatus !== 'connected' && setSettingsOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              llmStatus === 'connected'
                ? 'bg-accent-green/15 text-accent-green'
                : llmStatus === 'checking'
                  ? 'bg-accent-yellow/15 text-accent-yellow'
                  : 'bg-accent-red/15 text-accent-red cursor-pointer hover:bg-accent-red/25'
            }`}
          >
            {llmStatus === 'connected' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-accent-green" />
                LLM Connected
              </>
            ) : llmStatus === 'checking' ? (
              <>
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Checking...
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-accent-red" />
                Not Connected
              </>
            )}
          </button>
          {/* Import button (JSON legacy) */}
          <button
            onClick={handleImportClick}
            className="flex items-center gap-2 px-3 py-1.5 text-text-secondary hover:text-text-primary hover:bg-dark-hover rounded-lg transition-colors text-sm"
            title="Import Session (JSON)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
          {/* Restore Session (.rtb) button */}
          <button
            onClick={handleRtbRestoreClick}
            className="flex items-center gap-2 px-3 py-1.5 text-text-secondary hover:text-text-primary hover:bg-dark-hover rounded-lg transition-colors text-sm"
            title="Restore Session (.rtb)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Restore Session
          </button>
          {/* Settings button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="relative p-2 rounded-full hover:bg-dark-hover transition-colors group"
            title="Settings"
          >
            <svg className="w-6 h-6 text-text-secondary group-hover:text-text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>
      </header>

      {/* LLM disconnected alert banner */}
      {llmStatus === 'disconnected' && (
        <div className="mx-6 mt-4 flex items-center gap-3 p-4 bg-accent-red/10 border border-accent-red/30 rounded-lg">
          <svg className="w-5 h-5 text-accent-red flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-accent-red">LLM not connected</p>
            <p className="text-xs text-text-muted mt-0.5">
              {llmError || 'Could not reach the AI service.'}{' '}
              <button onClick={() => setSettingsOpen(true)} className="text-accent-blue hover:underline">
                Open Settings
              </button>{' '}
              to configure your API key.
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-text-primary mb-3">
              Transform Your Resume
            </h2>
            <p className="text-text-secondary">
              Upload your resume and paste the job description to get AI-powered suggestions
            </p>
          </div>

          {/* Continue Current Session Banner */}
          {hasActiveSession && (
            <div className="mb-6 p-4 bg-accent-blue/10 border border-accent-blue/30 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent-blue/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">You have an active session</p>
                  <p className="text-xs text-text-muted">Continue where you left off</p>
                </div>
              </div>
              <button
                onClick={() => resumeSession(savedSessions[0]?.id || '')}
                className="px-4 py-2 bg-accent-blue text-dark-bg rounded-lg text-sm font-medium hover:bg-opacity-90 transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {/* Saved Sessions & Tracker Section */}
          {savedSessions.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => { setShowSessions(!showSessions); setShowTracker(false); }}
                  className={`flex items-center gap-2 text-sm transition-colors ${
                    showSessions && !showTracker ? 'text-text-primary font-medium' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showSessions && !showTracker ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {savedSessions.length} saved session{savedSessions.length !== 1 ? 's' : ''}
                </button>
                {trackedSessions.length > 0 && (
                  <>
                    <span className="text-dark-border">|</span>
                    <button
                      onClick={() => { setShowTracker(!showTracker); setShowSessions(true); }}
                      className={`flex items-center gap-1.5 text-sm transition-colors ${
                        showTracker ? 'text-accent-blue font-medium' : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Tracker
                    </button>
                  </>
                )}
              </div>

              {/* Tracker View */}
              {showSessions && showTracker && (
                <div className="space-y-4 mb-4">
                  {STATUS_ORDER.map((status) => {
                    const sessionsForStatus = savedSessions.filter(s => (s.applicationStatus || 'none') === status);
                    if (sessionsForStatus.length === 0) return null;
                    const config = APPLICATION_STATUS_CONFIG[status];
                    return (
                      <div key={status}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${config.color} ${config.bg} border ${config.border}`}>
                            {config.label}
                          </span>
                          <span className="text-xs text-text-muted">{sessionsForStatus.length}</span>
                        </div>
                        <div className="space-y-1.5">
                          {sessionsForStatus.map((session) => (
                            <div
                              key={session.id}
                              onClick={() => handleResumeSession(session.id)}
                              className={`flex items-center justify-between p-3 bg-dark-surface border rounded-lg cursor-pointer hover:border-accent-blue transition-colors group ${config.border}`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors truncate">
                                    {session.jobTitle || 'Untitled Job'}{session.jobCompany ? ` @ ${session.jobCompany}` : ''}
                                  </p>
                                  <p className="text-xs text-text-muted">
                                    {session.resumeName && session.resumeName !== 'Uploaded Resume'
                                      ? session.resumeName.replace(/\.(pdf|docx)$/i, '')
                                      : 'Resume'
                                    }
                                    {session.appliedAt && ` · Applied ${formatDate(session.appliedAt)}`}
                                  </p>
                                </div>
                              </div>
                              {renderStatusDropdown(session)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Regular Sessions List */}
              {showSessions && !showTracker && (
                <div className="space-y-2 mb-4">
                  {loadingSessions ? (
                    <div className="text-center py-4 text-text-muted text-sm">Loading sessions...</div>
                  ) : (
                    savedSessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => handleResumeSession(session.id)}
                        className="flex items-center justify-between p-3 bg-dark-surface border border-dark-border rounded-lg cursor-pointer hover:border-accent-blue transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 bg-dark-elevated rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors truncate">
                                {session.resumeName && session.resumeName !== 'Uploaded Resume'
                                  ? `${session.resumeName.replace(/\.(pdf|docx)$/i, '')} — ${session.jobTitle || 'Untitled Job'}${session.jobCompany ? ` @ ${session.jobCompany}` : ''}`
                                  : `${session.jobTitle || 'Untitled Job'}${session.jobCompany ? ` @ ${session.jobCompany}` : ''}`
                                }
                              </p>
                              {renderStatusBadge(session.applicationStatus || 'none')}
                            </div>
                            <p className="text-xs text-text-muted">{formatDate(session.updatedAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {renderStatusDropdown(session)}
                          <button
                            onClick={(e) => handleDeleteSession(session.id, e)}
                            className="p-1.5 text-text-muted hover:text-accent-red opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete session"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Import Session (JSON legacy) */}
          <input
            type="file"
            ref={importInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />
          {/* Restore Session (.rtb) */}
          <input
            type="file"
            ref={rtbInputRef}
            onChange={handleRtbFileChange}
            accept=".rtb"
            className="hidden"
          />
          {/* RTB restore error */}
          {rtbError && (
            <div className="mb-4 p-3 bg-accent-red/10 border border-accent-red/30 rounded-lg text-sm text-accent-red">
              {rtbError}
            </div>
          )}

          {/* Step Indicator */}
          {(() => {
            const steps = [
              { key: 'resume' as const, label: 'Resume' },
              { key: 'job' as const, label: 'Job Description' },
              { key: 'tailor' as const, label: 'Tailor' },
            ];
            const stepOrder = ['resume', 'job', 'tailor'] as const;
            const currentIndex = stepOrder.indexOf(currentStep);

            return (
              <div className="flex items-center gap-2 mb-6">
                {steps.map((step, i) => {
                  const isDone = i < currentIndex;
                  const isActive = step.key === currentStep;
                  return (
                    <React.Fragment key={step.key}>
                      {i > 0 && <div className="w-6 h-px bg-dark-border" />}
                      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${
                        isActive ? 'bg-accent-blue/15 text-accent-blue'
                        : isDone ? 'bg-accent-green/15 text-accent-green'
                        : 'bg-dark-elevated text-text-muted'
                      }`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isActive ? 'bg-accent-blue text-dark-bg'
                          : isDone ? 'bg-accent-green text-dark-bg'
                          : 'bg-dark-border text-text-muted'
                        }`}>
                          {isDone ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : String(i + 1)}
                        </span>
                        {step.label}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })()}

          {/* Upload Card */}
          <div className="bg-dark-surface rounded-2xl p-8 border border-dark-border space-y-6">
            {/* STEP 1: Resume Upload */}
            {currentStep === 'resume' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block">
                      <span className="text-sm font-medium text-text-primary">Resume</span>
                      <span className="text-text-muted text-sm ml-2">(PDF or DOCX)</span>
                    </label>
                    {savedResumes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowResumes(!showResumes)}
                        className="text-xs text-accent-blue hover:underline"
                        disabled={loading}
                      >
                        {showResumes ? 'Upload new' : `Use saved (${savedResumes.length})`}
                      </button>
                    )}
                  </div>

                  {/* Saved Resumes List */}
                  {showResumes && savedResumes.length > 0 ? (
                    <div className="space-y-2">
                      {savedResumes.map((resume) => (
                        <button
                          key={resume.id}
                          type="button"
                          onClick={() => handleSelectResume(resume.id)}
                          disabled={loading}
                          className={`
                            w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
                            ${selectedResumeId === resume.id
                              ? 'border-accent-green bg-accent-green/5'
                              : 'border-dark-border bg-dark-elevated hover:border-accent-blue hover:bg-dark-hover'
                            }
                            ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            selectedResumeId === resume.id ? 'bg-accent-green/20' : 'bg-dark-hover'
                          }`}>
                            {selectedResumeId === resume.id ? (
                              <svg className="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${
                              selectedResumeId === resume.id ? 'text-accent-green' : 'text-text-primary'
                            }`}>
                              {resume.name}
                            </p>
                            <p className="text-xs text-text-muted">
                              Uploaded {formatDate(resume.uploadedAt)} · {resume.sessionCount} session{resume.sessionCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                          {selectedResumeId === resume.id && (
                            <span className="text-xs text-accent-green font-medium px-2 py-1 bg-accent-green/10 rounded">
                              Selected
                            </span>
                          )}
                        </button>
                      ))}
                      {selectedResumeId && (
                        <button
                          type="button"
                          onClick={handleClearSelectedResume}
                          className="w-full text-center text-xs text-text-muted hover:text-text-secondary py-2"
                          disabled={loading}
                        >
                          Clear selection
                        </button>
                      )}
                      <p className="text-xs text-text-muted text-center pt-2">
                        <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Using a saved resume skips parsing and saves API tokens
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Show selected saved resume if one is chosen but list is hidden */}
                      {selectedResumeId && !showResumes ? (
                        <div className="flex items-center gap-3 p-4 border-2 border-accent-green bg-accent-green/5 rounded-xl">
                          <div className="w-10 h-10 bg-accent-green/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-accent-green truncate">
                              {savedResumes.find(r => r.id === selectedResumeId)?.name || 'Saved Resume'}
                            </p>
                            <p className="text-xs text-text-muted">Saved resume selected · No parsing needed</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleClearSelectedResume}
                            className="p-1.5 text-text-muted hover:text-accent-red transition-colors"
                            title="Clear selection"
                            disabled={loading}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            type="file"
                            accept=".pdf,.docx"
                            onChange={handleFileChange}
                            disabled={loading}
                            className="hidden"
                            id="resume-upload"
                          />
                          <label
                            htmlFor="resume-upload"
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            className={`
                              flex flex-col items-center justify-center w-full px-6 py-8 border-2 border-dashed rounded-xl
                              transition-all duration-200 cursor-pointer
                              ${file
                                ? 'border-accent-green bg-accent-green/5'
                                : 'border-dark-border hover:border-accent-blue bg-dark-elevated hover:bg-dark-hover'
                              }
                              ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                          >
                            {file ? (
                              <>
                                <svg className="w-10 h-10 text-accent-green mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-accent-green font-medium">{file.name}</p>
                                <p className="text-xs text-text-muted mt-1">Click to change file</p>
                              </>
                            ) : (
                              <>
                                <svg className="w-10 h-10 text-text-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="text-text-primary font-medium">Drop your resume here</p>
                                <p className="text-xs text-text-muted mt-1">or click to browse</p>
                              </>
                            )}
                          </label>
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-start gap-3 p-4 bg-accent-red/10 border border-accent-red/30 rounded-lg">
                    <svg className="w-5 h-5 text-accent-red flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-accent-red text-sm">{error}</p>
                  </div>
                )}

                {/* Progress (parsing only) */}
                {loading && (
                  <div className="flex items-center gap-3 p-4 bg-dark-elevated rounded-xl border border-dark-border">
                    <svg className="animate-spin h-5 w-5 text-accent-blue flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm text-text-primary">Parsing your resume...</span>
                  </div>
                )}

                {/* Step 1 Button */}
                <button
                  onClick={handleResumeStep}
                  disabled={loading || (!file && !selectedResumeId)}
                  className={`
                    w-full py-4 px-6 rounded-xl font-semibold text-lg
                    transition-all duration-200 flex items-center justify-center gap-3
                    ${loading || (!file && !selectedResumeId)
                      ? 'bg-dark-border text-text-muted cursor-not-allowed'
                      : 'bg-accent-blue text-dark-bg hover:bg-opacity-90'
                    }
                  `}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Parsing...
                    </>
                  ) : selectedResumeId ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      Continue
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Parse Resume
                    </>
                  )}
                </button>
              </>
            )}

            {/* STEP 2: Job Description */}
            {currentStep === 'job' && (
              <>
                {/* Selected Resume Bar (compact) */}
                <div className="flex items-center gap-3 p-3 border border-accent-green/30 bg-accent-green/5 rounded-xl">
                  <div className="w-6 h-6 bg-accent-green/20 rounded flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-accent-green truncate flex-1">{parsedResumeName}</p>
                  <button
                    type="button"
                    onClick={handleChangeResume}
                    className="text-xs text-text-muted hover:text-accent-blue transition-colors"
                  >
                    Change
                  </button>
                </div>

                {/* Selected Saved JD display */}
                {selectedJobId && (
                  <div className="flex items-center gap-3 p-3 border border-accent-green/30 bg-accent-green/5 rounded-xl">
                    <div className="w-6 h-6 bg-accent-green/20 rounded flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-accent-green truncate flex-1">
                      {savedJobDescriptions.find(j => j.id === selectedJobId)?.title || 'Saved Job Description'}
                    </p>
                    <button
                      type="button"
                      onClick={handleClearSelectedJob}
                      className="text-xs text-text-muted hover:text-accent-blue transition-colors"
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Job Description */}
                {!selectedJobId && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="job-description">
                        <span className="text-sm font-medium text-text-primary">Job Description</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {savedJobDescriptions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowSavedJobs(!showSavedJobs)}
                            className="text-xs text-accent-blue hover:underline"
                            disabled={scrapingJob}
                          >
                            {showSavedJobs ? 'Enter new' : `Use saved (${savedJobDescriptions.length})`}
                          </button>
                        )}
                        {!showSavedJobs && (
                          <div className="flex items-center gap-1 bg-dark-elevated rounded-lg p-0.5 border border-dark-border">
                            <button
                              type="button"
                              onClick={() => setJobInputMode('url')}
                              disabled={scrapingJob}
                              className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                                jobInputMode === 'url'
                                  ? 'bg-accent-blue/15 text-accent-blue font-medium'
                                  : 'text-text-muted hover:text-text-secondary'
                              }`}
                            >
                              Paste link
                            </button>
                            <button
                              type="button"
                              onClick={() => setJobInputMode('paste')}
                              disabled={scrapingJob}
                              className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                                jobInputMode === 'paste'
                                  ? 'bg-accent-blue/15 text-accent-blue font-medium'
                                  : 'text-text-muted hover:text-text-secondary'
                              }`}
                            >
                              Paste text
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Saved Job Descriptions List */}
                    {showSavedJobs ? (
                      <div className="space-y-2">
                        {savedJobDescriptions.map((jd) => (
                          <button
                            key={jd.id}
                            type="button"
                            onClick={() => handleSelectJob(jd.id)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dark-border bg-dark-elevated hover:border-accent-blue hover:bg-dark-hover transition-all text-left cursor-pointer"
                          >
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-dark-hover">
                              <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-primary truncate">
                                {jd.title}{jd.company ? ` @ ${jd.company}` : ''}
                              </p>
                              <p className="text-xs text-text-muted">
                                Saved {formatDate(jd.createdAt)} · {jd.sessionCount} session{jd.sessionCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : jobInputMode === 'url' ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={jobUrl}
                            onChange={(e) => setJobUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleScrapeJob()}
                            disabled={scrapingJob}
                            placeholder="https://jobs.example.com/posting/123"
                            className="flex-1 px-4 py-3 bg-dark-elevated border border-dark-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue transition-colors disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={handleScrapeJob}
                            disabled={scrapingJob || !jobUrl.trim()}
                            className={`px-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
                              scrapingJob || !jobUrl.trim()
                                ? 'bg-dark-border text-text-muted cursor-not-allowed'
                                : 'bg-accent-blue text-dark-bg hover:bg-opacity-90'
                            }`}
                          >
                            {scrapingJob ? (
                              <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Fetching...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Fetch
                              </>
                            )}
                          </button>
                        </div>
                        {jobDescription && (
                          <div className="relative">
                            <textarea
                              value={jobDescription}
                              onChange={(e) => setJobDescription(e.target.value)}
                              className="w-full h-36 px-4 py-3 bg-dark-elevated border border-accent-green/30 rounded-xl text-text-primary focus:outline-none focus:border-accent-blue transition-colors resize-none text-sm"
                            />
                            <div className="absolute top-2 right-2">
                              <span className="px-2 py-0.5 text-[10px] bg-accent-green/15 text-accent-green rounded-full font-medium">
                                Fetched
                              </span>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-text-muted">
                          <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Paste a job posting URL and we'll extract the description
                        </p>
                      </div>
                    ) : (
                      <textarea
                        id="job-description"
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the complete job description here..."
                        className="w-full h-48 px-4 py-3 bg-dark-elevated border border-dark-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue transition-colors resize-none"
                      />
                    )}

                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="flex items-start gap-3 p-4 bg-accent-red/10 border border-accent-red/30 rounded-lg">
                    <svg className="w-5 h-5 text-accent-red flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-accent-red text-sm">{error}</p>
                  </div>
                )}

                {/* Step 2 Button */}
                <button
                  onClick={handleJobStep}
                  disabled={!jobDescription.trim() || scrapingJob}
                  className={`
                    w-full py-4 px-6 rounded-xl font-semibold text-lg
                    transition-all duration-200 flex items-center justify-center gap-3
                    ${!jobDescription.trim() || scrapingJob
                      ? 'bg-dark-border text-text-muted cursor-not-allowed'
                      : 'bg-accent-blue text-dark-bg hover:bg-opacity-90'
                    }
                  `}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Continue
                </button>
              </>
            )}

            {/* STEP 3: Tailor */}
            {currentStep === 'tailor' && (
              <>
                {/* Completed steps summary */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 border border-accent-green/30 bg-accent-green/5 rounded-xl">
                    <div className="w-6 h-6 bg-accent-green/20 rounded flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-accent-green truncate flex-1">{parsedResumeName}</p>
                    <button
                      type="button"
                      onClick={handleChangeResume}
                      disabled={loading}
                      className="text-xs text-text-muted hover:text-accent-blue transition-colors disabled:opacity-50"
                    >
                      Change
                    </button>
                  </div>
                  <div className="flex items-center gap-3 p-3 border border-accent-green/30 bg-accent-green/5 rounded-xl">
                    <div className="w-6 h-6 bg-accent-green/20 rounded flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-accent-green truncate flex-1">
                      {jobDescription.split('\n')[0].substring(0, 50)}{jobDescription.split('\n')[0].length > 50 ? '...' : ''}
                    </p>
                    <button
                      type="button"
                      onClick={handleChangeJob}
                      disabled={loading}
                      className="text-xs text-text-muted hover:text-accent-blue transition-colors disabled:opacity-50"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-start gap-3 p-4 bg-accent-red/10 border border-accent-red/30 rounded-lg">
                    <svg className="w-5 h-5 text-accent-red flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-accent-red text-sm">{error}</p>
                  </div>
                )}

                {/* Progress Steps */}
                {loading && (
                  <div className="space-y-4 py-4 bg-dark-elevated rounded-xl p-4 border border-dark-border">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-sm font-medium text-text-primary">Tailoring your resume</span>
                    </div>
                    {STEPS.filter(s => s.key !== 'parsing').map((step) => {
                      const stepIndex = STEPS.findIndex(s => s.key === step.key);
                      const currentIndex = STEPS.findIndex(s => s.key === progress);
                      const isDone = stepIndex < currentIndex || progress === 'complete';
                      const isActive = step.key === progress && progress !== 'complete';

                      return (
                        <div key={step.key} className={`flex items-start gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-accent-blue/10 border border-accent-blue/30' : ''}`}>
                          <div className="mt-0.5">
                            {isDone ? (
                              <svg className="w-5 h-5 text-accent-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : isActive ? (
                              <svg className="animate-spin h-5 w-5 text-accent-blue flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-dark-border flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex-1">
                            <span className={`text-sm font-medium ${isDone ? 'text-accent-green' : isActive ? 'text-text-primary' : 'text-text-muted'}`}>
                              {step.label}
                            </span>
                            {isActive && (
                              <p className="text-xs text-text-muted mt-1">{step.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Step 3 Button */}
                <button
                  onClick={handleTailorStep}
                  disabled={loading}
                  className={`
                    w-full py-4 px-6 rounded-xl font-semibold text-lg
                    transition-all duration-200 flex items-center justify-center gap-3
                    ${loading
                      ? 'bg-dark-border text-text-muted cursor-not-allowed'
                      : 'bg-accent-blue text-dark-bg hover:bg-opacity-90'
                    }
                  `}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Tailor My Resume
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="bg-dark-surface rounded-xl p-4 border border-dark-border">
              <div className="w-8 h-8 bg-accent-blue/20 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-medium text-text-primary text-sm mb-1">Impact First</h3>
              <p className="text-xs text-text-muted">Quantifiable results</p>
            </div>

            <div className="bg-dark-surface rounded-xl p-4 border border-dark-border">
              <div className="w-8 h-8 bg-accent-green/20 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="font-medium text-text-primary text-sm mb-1">Strong Verbs</h3>
              <p className="text-xs text-text-muted">Built, led, shipped</p>
            </div>

            <div className="bg-dark-surface rounded-xl p-4 border border-dark-border">
              <div className="w-8 h-8 bg-accent-yellow/20 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-accent-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="font-medium text-text-primary text-sm mb-1">Scannable</h3>
              <p className="text-xs text-text-muted">Easy to read</p>
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};
