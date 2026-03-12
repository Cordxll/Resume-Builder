import { useCallback } from 'react';
import { UploadPage } from './components/UploadPage';
import { AppShell } from './components/layout/AppShell';
import { CenterPanel } from './components/layout/CenterPanel';
import TrackerView from './components/tracker/TrackerView';
import { AppProvider, useAppContext } from './context/AppContext';
import { api } from './services/api';
import { hasAnyApiKey } from './services/storage';
import { ChatMessage, EditContext, SectionType, TailoredData } from './types';
import { extractSuggestion, extractExplanation } from './utils/extractSuggestion';
import { useTheme } from './hooks/useTheme';

/**
 * Build a human-readable initial explanation from the tailoring data.
 */
function getInitialExplanation(
  data: TailoredData | null,
  context: EditContext | null | undefined
): string | undefined {
  if (!data || !context?.isActive) return undefined;

  const sectionType = context.sectionType;

  if (sectionType === 'summary' && data.summary?.explanation) {
    return data.summary.explanation;
  }
  if (sectionType === 'skills' && data.skills?.explanation) {
    return data.skills.explanation;
  }

  return undefined;
}

function AppContent() {
  // Initialize theme (applies dark/light class to <html>)
  useTheme();

  const {
    state,
    startNewSession,
    navigateToUpload,
    updateTailoredData,
    toggleAcceptedChange,
    setActiveSection,
    addChatMessage,
    setChatLoading,
    setLoading,
    setExportError,
    setEditContext,
    applyEditFromChat,
    trackEdit,
    undoEdit,
    redoEdit,
    canUndo,
    canRedo,
  } = useAppContext();

  const {
    currentView,
    resume,
    resumeText,
    jobDescription,
    tailoredData,
    acceptedChanges,
    chatMessages,
    activeSection,
    chatLoading,
    loading,
    exportError,
    isRestoring,
    editContext,
  } = state;

  const apiKeyAvailable = hasAnyApiKey();

  const handleTailoringComplete = useCallback(
    async (
      resumeData: typeof resume,
      tailored: typeof tailoredData,
      originalResumeText?: string,
      originalJobDescription?: string
    ) => {
      if (!resumeData || !tailored) return;
      await startNewSession(
        resumeData,
        originalResumeText || resumeData.raw_text || '',
        originalJobDescription || '',
        tailored
      );
    },
    [startNewSession]
  );

  const handleSectionSelect = useCallback((section: string) => {
    setActiveSection(section);
    const element = document.getElementById(section);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [setActiveSection]);

  const handleSendMessage = useCallback(async (message: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    addChatMessage(userMsg);
    setChatLoading(true);

    try {
      const response = await api.sendChatMessage(
        message,
        resumeText,
        jobDescription,
        tailoredData,
        [...chatMessages, userMsg]
      );

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: response,
        timestamp: new Date(),
      };
      addChatMessage(agentMsg);
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'agent',
        content: 'Something went wrong. Please check your API key in Settings and try again.',
        timestamp: new Date(),
      };
      addChatMessage(errorMsg);
    } finally {
      setChatLoading(false);
    }
  }, [resumeText, jobDescription, tailoredData, chatMessages, addChatMessage, setChatLoading]);

  const handleEditContent = useCallback(
    (sectionType: SectionType, entryId: string | null, bulletIndex: number | null, content: string) => {
      if (!tailoredData) return;

      const newData = JSON.parse(JSON.stringify(tailoredData)) as TailoredData;
      let editKey = '';
      let originalValue = '';

      if (sectionType === 'summary') {
        editKey = 'summary';
        originalValue = tailoredData.summary.tailored;
        newData.summary.tailored = content;
      } else if (sectionType === 'skills') {
        editKey = 'skills';
        originalValue = tailoredData.skills.tailored;
        newData.skills.tailored = content;
      } else if (sectionType === 'experience' && entryId !== null && bulletIndex !== null) {
        editKey = `experience:${entryId}:${bulletIndex}`;
        const job = newData.jobs.find(j => j.id === entryId);
        if (job) {
          const bullet = job.bullets.find(b => b.index === bulletIndex);
          if (bullet) {
            originalValue = bullet.tailored;
            bullet.tailored = content;
          }
        }
      } else if (entryId !== null && bulletIndex !== null) {
        // Other sections: education, projects, certifications, etc.
        editKey = `${sectionType}:${entryId}:${bulletIndex}`;
        const section = newData.sections.find(s => s.sectionType === sectionType);
        if (section) {
          const entry = section.entries.find(e => e.id === entryId);
          if (entry) {
            const bullet = entry.bullets.find(b => b.index === bulletIndex);
            if (bullet) {
              originalValue = bullet.tailored;
              bullet.tailored = content;
            }
          }
        }
      }

      // Track the edit only if content actually changed
      if (editKey && originalValue && content !== originalValue) {
        trackEdit(editKey, originalValue);
      }

      updateTailoredData(newData);
    },
    [tailoredData, updateTailoredData, trackEdit]
  );

  // Handle starting inline edit - sets context for chat integration
  const handleStartEdit = useCallback((context: EditContext) => {
    setEditContext(context.isActive ? context : null);
  }, [setEditContext]);

  // Handle AI request from inline edit popup
  const handleAskAIForEdit = useCallback(async (prompt: string, context: EditContext) => {
    // Set the edit context so chat knows what we're editing
    setEditContext(context);

    // Create a structured prompt that requests a parseable response format
    const contextualPrompt = `I need you to improve this resume bullet point.

CURRENT TEXT:
"${context.originalContent}"

REQUEST: ${prompt}

IMPORTANT: Respond in this exact format:

IMPROVED:
"[Your improved bullet point here - single line, no line breaks]"

WHY:
[Brief 1-2 sentence explanation of changes]

Only provide ONE improved version. The text inside quotes after "IMPROVED:" will be directly applied to my resume.`;

    // Clean display version for the chat sidebar (hides prompt engineering)
    const shortPreview = context.originalContent.length > 60
      ? context.originalContent.slice(0, 60) + '...'
      : context.originalContent;
    const displayContent = `${prompt}\n\nEditing: "${shortPreview}"`;

    // Send through normal chat flow - the AI response can then be applied
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: contextualPrompt,
      displayContent,
      timestamp: new Date(),
    };
    addChatMessage(userMsg);
    setChatLoading(true);

    try {
      const response = await api.sendChatMessage(
        contextualPrompt,
        resumeText,
        jobDescription,
        tailoredData,
        [...chatMessages, userMsg]
      );

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: response,
        timestamp: new Date(),
      };
      addChatMessage(agentMsg);
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'agent',
        content: 'Something went wrong. Please check your API key and try again.',
        timestamp: new Date(),
      };
      addChatMessage(errorMsg);
    } finally {
      setChatLoading(false);
    }
  }, [resumeText, jobDescription, tailoredData, chatMessages, addChatMessage, setChatLoading, setEditContext]);

  const handleExport = useCallback(async () => {
    if (!resume || !tailoredData) return;

    setLoading(true);
    setExportError(null);

    try {
      const blob = await api.exportDocx(resume, tailoredData, acceptedChanges);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tailored_resume.docx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      setExportError('Failed to export resume. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [resume, tailoredData, acceptedChanges, setLoading, setExportError]);

  // Show loading state while restoring session
  if (isRestoring) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-accent-blue" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-text-secondary">Restoring your session...</p>
        </div>
      </div>
    );
  }

  if (currentView === 'tracker') {
    return <TrackerView onBack={() => navigateToUpload()} />;
  }

  if (currentView === 'upload') {
    return <UploadPage onTailoringComplete={handleTailoringComplete} />;
  }

  if (!resume || !tailoredData) {
    return null;
  }

  return (
    <>
      <AppShell
        resume={resume}
        acceptedChanges={acceptedChanges}
        onAcceptChange={toggleAcceptedChange}
        activeSection={activeSection}
        onSectionSelect={handleSectionSelect}
        onSendMessage={handleSendMessage}
        chatMessages={chatMessages}
        chatLoading={chatLoading}
        hasApiKey={apiKeyAvailable}
        onExport={handleExport}
        onBack={navigateToUpload}
        loading={loading}
        editContext={editContext}
        onApplyEdit={applyEditFromChat}
      >
        <CenterPanel
          resume={resume}
          tailoredData={tailoredData}
          acceptedChanges={acceptedChanges}
          activeSection={activeSection}
          onEditContent={handleEditContent}
          onStartEdit={handleStartEdit}
          onAskAI={handleAskAIForEdit}
          editContext={editContext}
          aiSuggestion={
            // Show latest AI message as suggestion when actively editing
            // Extract just the suggested content, not the full explanation
            editContext?.isActive && chatMessages.length > 0
              ? extractSuggestion(chatMessages.filter(m => m.role === 'agent').slice(-1)[0]?.content || '') || undefined
              : undefined
          }
          aiExplanation={
            editContext?.isActive
              ? (
                  // First try: extract from the latest AI chat response
                  (chatMessages.length > 0 && extractExplanation(chatMessages.filter(m => m.role === 'agent').slice(-1)[0]?.content || ''))
                  // Fallback: show the initial tailoring rationale (skip for experience — ResumePreview handles per-bullet)
                  || (editContext.sectionType !== 'experience' ? getInitialExplanation(tailoredData, editContext) : undefined)
                  || undefined
                )
              : undefined
          }
          onAcceptSuggestion={() => {
            // When user accepts, clear the edit context
            setEditContext(null);
          }}
          onUndo={undoEdit}
          onRedo={redoEdit}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </AppShell>

      {/* Export Error Toast */}
      {exportError && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-accent-red text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <span>{exportError}</span>
            <button
              onClick={() => setExportError(null)}
              className="text-white/80 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
