import React, { ReactNode, useState, useEffect } from 'react';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { ParsedResume, AcceptedChanges, ChatMessage, EditContext } from '../../types';
import { ApplicationStatus } from '../../types/storage';
import { SettingsModal, hasAnyApiKey, checkServerApiKey } from '../SettingsModal';
import { useAppContext } from '../../context/AppContext';
import { sessionDB } from '../../services/db';
import { exportSessionFile, downloadBlob } from '../../services/sessionFile';

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; bg: string }> = {
  none:         { label: 'Set Status',    color: 'text-text-muted',       bg: 'hover:bg-dark-hover' },
  saved:        { label: 'Saved',         color: 'text-text-muted',       bg: 'bg-dark-hover' },
  applied:      { label: 'Applied',       color: 'text-accent-blue',      bg: 'bg-accent-blue/10' },
  'phone-screen': { label: 'Phone Screen', color: 'text-accent-yellow',   bg: 'bg-accent-yellow/10' },
  'interview-1': { label: 'Interview 1',  color: 'text-accent-yellow',    bg: 'bg-accent-yellow/10' },
  'interview-2': { label: 'Interview 2',  color: 'text-accent-yellow',    bg: 'bg-accent-yellow/10' },
  'interview-3': { label: 'Interview 3+', color: 'text-accent-yellow',    bg: 'bg-accent-yellow/10' },
  'take-home':  { label: 'Take-Home',     color: 'text-accent-yellow',    bg: 'bg-accent-yellow/10' },
  offered:      { label: 'Offered',       color: 'text-accent-green',     bg: 'bg-accent-green/10' },
  accepted:     { label: 'Accepted',      color: 'text-accent-green',     bg: 'bg-accent-green/10' },
  rejected:     { label: 'Rejected',      color: 'text-accent-red',       bg: 'bg-accent-red/10' },
  withdrawn:    { label: 'Withdrawn',     color: 'text-text-muted',       bg: 'bg-dark-hover' },
};

const STATUS_OPTIONS: ApplicationStatus[] = [
  'none', 'saved', 'applied', 'phone-screen',
  'interview-1', 'interview-2', 'interview-3', 'take-home',
  'offered', 'accepted', 'rejected', 'withdrawn',
];

interface AppShellProps {
  resume: ParsedResume;
  acceptedChanges: AcceptedChanges;
  onAcceptChange: (section: keyof AcceptedChanges) => void;
  activeSection: string | null;
  onSectionSelect: (section: string) => void;
  onSendMessage: (message: string) => void;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  hasApiKey: boolean;
  onExport: () => void;
  onBack: () => void;
  loading: boolean;
  editContext?: EditContext | null;
  onApplyEdit?: (newContent: string) => void;
  children: ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  resume,
  acceptedChanges,
  onAcceptChange,
  activeSection,
  onSectionSelect,
  onSendMessage,
  chatMessages,
  chatLoading,
  hasApiKey,
  onExport,
  onBack,
  loading,
  editContext,
  onApplyEdit,
  children,
}) => {
  const { exportSession, state, updateApplicationStatus } = useAppContext();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState(hasAnyApiKey());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [currentAppStatus, setCurrentAppStatus] = useState<ApplicationStatus>('none');
  const [savedText, setSavedText] = useState<string | null>(null);

  // Check server API key status on mount and when settings close
  useEffect(() => {
    checkServerApiKey().then(() => {
      setApiKeyStatus(hasAnyApiKey());
    });
  }, [settingsOpen]);

  // Load current session's application status
  useEffect(() => {
    if (state.currentSessionId) {
      sessionDB.get(state.currentSessionId).then((session) => {
        if (session) {
          setCurrentAppStatus(session.applicationStatus || 'none');
        }
      });
    }
  }, [state.currentSessionId]);

  const handleStatusChange = async (status: ApplicationStatus) => {
    if (!state.currentSessionId) return;
    await updateApplicationStatus(state.currentSessionId, status);
    setCurrentAppStatus(status);
    setShowStatusMenu(false);
  };

  const handleExportSession = async () => {
    setShowExportMenu(false);
    const data = await exportSession();
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume-session-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleExportDocx = () => {
    setShowExportMenu(false);
    onExport();
  };

  const handleSaveRtb = async () => {
    setShowExportMenu(false);
    const data = await exportSession();
    if (!data) return;

    const blob = await exportSessionFile(data.session, data.resume, data.jobDescription);
    const rawTitle = data.jobDescription.title || 'session';
    const slug = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const date = new Date().toISOString().split('T')[0];
    downloadBlob(blob, `session-${slug}-${date}.rtb`);

    setSavedText('Session saved!');
    setTimeout(() => setSavedText(null), 2000);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-dark-border bg-dark-surface/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-medium text-text-primary">Resume Tailor</h1>
          {/* Application Status Pill */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                STATUS_CONFIG[currentAppStatus].color
              } ${currentAppStatus === 'none' ? 'border border-dark-border hover:bg-dark-hover' : STATUS_CONFIG[currentAppStatus].bg}`}
            >
              {STATUS_CONFIG[currentAppStatus].label}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showStatusMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
                <div className="absolute left-0 mt-2 w-40 bg-dark-surface border border-dark-border rounded-lg shadow-xl z-20 overflow-hidden">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className={`w-full px-3 py-2 text-xs hover:bg-dark-hover transition-colors text-left ${
                        currentAppStatus === status
                          ? 'font-medium ' + STATUS_CONFIG[status].color
                          : 'text-text-primary'
                      }`}
                    >
                      {status === 'none' ? 'No Status' : STATUS_CONFIG[status].label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Save Session toast */}
          {savedText && (
            <span className="text-xs text-accent-green font-medium transition-opacity">{savedText}</span>
          )}
          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-dark-bg rounded-lg hover:bg-opacity-90 transition-all text-sm font-medium disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {loading ? 'Exporting...' : 'Export'}
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-dark-surface border border-dark-border rounded-lg shadow-xl z-20 overflow-hidden">
                  <button
                    onClick={handleExportDocx}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-dark-hover transition-colors text-left"
                  >
                    <svg className="w-4 h-4 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export as DOCX
                  </button>
                  <button
                    onClick={handleExportSession}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-dark-hover transition-colors text-left border-t border-dark-border"
                  >
                    <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Session (JSON)
                  </button>
                  <button
                    onClick={handleSaveRtb}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-dark-hover transition-colors text-left border-t border-dark-border"
                  >
                    <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Session (.rtb)
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="relative p-2 rounded-full hover:bg-dark-hover transition-colors group"
            title="Settings"
          >
            <svg className="w-5 h-5 text-text-secondary group-hover:text-text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {/* Indicator dot for API key status */}
            <span className={`absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-transparent ${apiKeyStatus ? 'bg-accent-green' : 'bg-accent-yellow'}`} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Navigation */}
        <LeftSidebar
          resume={resume}
          activeSection={activeSection}
          onSectionSelect={onSectionSelect}
        />

        {/* Center Panel - Resume Preview */}
        <main className="flex-1 overflow-y-auto resume-page-gradient">
          {children}
        </main>

        {/* Right Sidebar - Agent Output */}
        <RightSidebar
          acceptedChanges={acceptedChanges}
          onAcceptChange={onAcceptChange}
          onSendMessage={onSendMessage}
          chatMessages={chatMessages}
          chatLoading={chatLoading}
          hasApiKey={hasApiKey}
          editContext={editContext}
          onApplyEdit={onApplyEdit}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};
