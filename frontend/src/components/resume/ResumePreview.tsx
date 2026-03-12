import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ResumeSectionCard } from './ResumeSectionCard';
import { InlineEditPopup } from './InlineEditPopup';
import {
  ParsedResume,
  TailoredData,
  AcceptedChanges,
  EditContext,
  SectionType,
  ExperienceSection,
  EducationSection,
  ProjectsSection,
  CertificationsSection,
  AwardsSection,
  GenericSection,
} from '../../types';

interface ResumePreviewProps {
  resume: ParsedResume;
  tailoredData: TailoredData;
  acceptedChanges: AcceptedChanges;
  activeSection: string | null;
  onEditContent: (sectionType: SectionType, entryId: string | null, bulletIndex: number | null, content: string) => void;
  onStartEdit?: (context: EditContext) => void;
  onAskAI?: (prompt: string, context: EditContext) => void;
  aiSuggestion?: string;
  aiExplanation?: string;
  onAcceptSuggestion?: (suggestion: string) => void;
  editContext?: EditContext | null;
  onUndo?: (key: string, currentValue: string) => void;
  onRedo?: (key: string) => void;
  canUndo?: (key: string) => boolean;
  canRedo?: (key: string) => boolean;
}

// Track which bullet is being edited
interface EditingState {
  sectionType: SectionType;
  entryId: string;
  bulletIndex: number;
  editedText: string;
}

// Editable bullet component with inline text editing
const EditableBullet: React.FC<{
  bullet: string;
  isEditing: boolean;
  editedText: string;
  onStartEdit: () => void;
  onTextChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onAskAI: (prompt: string) => void;
  aiSuggestion?: string;
  aiExplanation?: string;
  onAcceptSuggestion?: (suggestion: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}> = ({ bullet, isEditing, editedText, onStartEdit, onTextChange, onSave, onCancel, onAskAI, aiSuggestion, aiExplanation, canUndo, canRedo, onUndo, onRedo }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [preEditText, setPreEditText] = useState<string | null>(null);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the suggestion value that was present when editing began
  const suggestionOnEditStartRef = useRef<string | undefined>(undefined);
  const lastAppliedSuggestionRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isEditing && textareaRef.current && !isTyping) {
      textareaRef.current.focus();
      // Auto-resize
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
    // Reset closing state when starting to edit
    if (isEditing) {
      setIsClosing(false);
    }
  }, [isEditing, editedText, isTyping]);

  // Snapshot suggestion when editing starts/stops
  useEffect(() => {
    if (isEditing) {
      suggestionOnEditStartRef.current = aiSuggestion;
      lastAppliedSuggestionRef.current = aiSuggestion;
    } else {
      suggestionOnEditStartRef.current = undefined;
      lastAppliedSuggestionRef.current = undefined;
      setPreEditText(null);
      setIsTyping(false);
      if (typingRef.current) clearTimeout(typingRef.current);
    }
    // Only run when isEditing changes, not when aiSuggestion changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // Typewriter effect — only when a NEW suggestion arrives AFTER editing started
  useEffect(() => {
    if (
      !isEditing ||
      !aiSuggestion ||
      // Skip if this is the same suggestion that was present when editing started
      aiSuggestion === suggestionOnEditStartRef.current ||
      // Skip if we already applied this exact suggestion
      aiSuggestion === lastAppliedSuggestionRef.current
    ) {
      return;
    }

    lastAppliedSuggestionRef.current = aiSuggestion;
    // Save the current text before AI replaces it
    if (!preEditText) {
      setPreEditText(editedText);
    }
    setIsTyping(true);
    let charIndex = 0;
    const fullText = aiSuggestion;

    // Clear existing text first
    onTextChange('');

    const typeNextChar = () => {
      charIndex++;
      onTextChange(fullText.slice(0, charIndex));
      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
      if (charIndex < fullText.length) {
        // Vary speed slightly for natural feel
        const speed = 12 + Math.random() * 18;
        typingRef.current = setTimeout(typeNextChar, speed);
      } else {
        setIsTyping(false);
      }
    };

    // Small delay before starting
    typingRef.current = setTimeout(typeNextChar, 200);

    return () => {
      if (typingRef.current) clearTimeout(typingRef.current);
    };
  }, [aiSuggestion, isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    setIsClosing(true);
  };

  const handleAnimationComplete = () => {
    setIsClosing(false);
    onCancel();
  };

  const handleSave = () => {
    onSave();
    setIsClosing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter' && e.metaKey) {
      handleSave();
    }
  };

  return (
    <li className="relative">
      <div className="flex items-start gap-2 group">
        <span className="text-accent-blue mt-1.5 text-[10px] flex-shrink-0">●</span>

        {isEditing ? (
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={editedText}
              onChange={(e) => {
                if (isTyping) return; // Don't allow manual edits during typewriter
                onTextChange(e.target.value);
                // Auto-resize
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={handleKeyDown}
              className={`w-full bg-transparent text-sm text-text-primary leading-relaxed focus:outline-none resize-none border-b-2 pb-1 transition-colors duration-300 ${
                isTyping ? 'border-accent-green text-accent-green/90' : 'border-accent-blue'
              }`}
              rows={1}
              readOnly={isTyping}
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-text-muted">⌘+Enter to save · Esc to cancel</span>
              <div className="flex gap-2">
                <button
                  onClick={handleClose}
                  className="px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-2 py-0.5 text-[10px] bg-accent-blue text-dark-bg rounded hover:bg-opacity-90 transition-all font-medium"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <span className="leading-relaxed flex-1 text-sm">{bullet}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {canRedo && onRedo && (
                <button
                  onClick={onRedo}
                  className="opacity-0 group-hover:opacity-100 p-1 text-accent-green hover:text-accent-green/80 transition-all"
                  aria-label="Redo changes"
                  title="Restore edited version"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                  </svg>
                </button>
              )}
              {canUndo && onUndo && (
                <button
                  onClick={onUndo}
                  className="opacity-0 group-hover:opacity-100 p-1 text-accent-yellow hover:text-accent-yellow/80 transition-all"
                  aria-label="Undo changes"
                  title="Revert to original"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
              )}
              <button
                onClick={onStartEdit}
                className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-accent-blue transition-all"
                aria-label="Edit bullet"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* AI Chat Bubble - slides in below when editing */}
      {isEditing && (
        <InlineEditPopup
          onAskAI={onAskAI}
          onClose={handleClose}
          isClosing={isClosing}
          onAnimationComplete={handleAnimationComplete}
          aiExplanation={aiExplanation}
          isTyping={isTyping}
        />
      )}
    </li>
  );
};

export const ResumePreview: React.FC<ResumePreviewProps> = ({
  resume,
  tailoredData,
  acceptedChanges,
  activeSection,
  onEditContent,
  onStartEdit,
  onAskAI,
  aiSuggestion,
  aiExplanation,
  editContext,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  const [editingState, setEditingState] = useState<EditingState | null>(null);

  // Per-bullet AI response tracking: which bullet last asked AI, and cached responses
  const lastAIRequestRef = useRef<{ sectionType: SectionType; entryId: string; bulletIndex: number } | null>(null);
  const bulletAICacheRef = useRef<Map<string, { explanation?: string }>>(new Map());

  // Cache AI explanations when they arrive for a specific bullet
  const prevAIExplanationRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (aiExplanation && aiExplanation !== prevAIExplanationRef.current && lastAIRequestRef.current) {
      const { sectionType, entryId, bulletIndex } = lastAIRequestRef.current;
      const key = `${sectionType}:${entryId}:${bulletIndex}`;
      bulletAICacheRef.current.set(key, { explanation: aiExplanation });
    }
    prevAIExplanationRef.current = aiExplanation;
  }, [aiExplanation]);

  // Check if the global AI response belongs to a specific bullet
  const aiResponseBelongsToBullet = useCallback(
    (sectionType: SectionType, entryId: string, bulletIndex: number): boolean => {
      return (
        lastAIRequestRef.current?.sectionType === sectionType &&
        lastAIRequestRef.current?.entryId === entryId &&
        lastAIRequestRef.current?.bulletIndex === bulletIndex
      );
    },
    []
  );

  // Update edited text
  const handleTextChange = (text: string) => {
    if (editingState) {
      setEditingState({ ...editingState, editedText: text });
    }
  };

  // Start editing a bullet point
  const handleStartBulletEdit = (
    sectionType: SectionType,
    entryId: string,
    bulletIndex: number,
    content: string
  ) => {
    const context: EditContext = {
      sectionType,
      entryId,
      bulletIndex,
      originalContent: content,
      isActive: true,
    };
    setEditingState({ sectionType, entryId, bulletIndex, editedText: content });
    onStartEdit?.(context);
  };

  // Save edited bullet
  const handleSaveBullet = (sectionType: SectionType, entryId: string, bulletIndex: number) => {
    if (editingState && editingState.editedText.trim()) {
      onEditContent(sectionType, entryId, bulletIndex, editingState.editedText.trim());
    }
    // Don't clear editingState here - let the animation complete first
  };

  // Called after animation completes to close the editing UI
  const handleEditComplete = () => {
    setEditingState(null);
    onStartEdit?.({
      sectionType: 'unknown',
      entryId: '',
      bulletIndex: -1,
      originalContent: '',
      isActive: false,
    });
  };

  // Ask AI for help with current edit
  const handleAskAI = (
    prompt: string,
    sectionType: SectionType,
    entryId: string,
    bulletIndex: number,
    content: string
  ) => {
    lastAIRequestRef.current = { sectionType, entryId, bulletIndex };

    // Use the current edited text (including AI suggestions) rather than the stale original
    const currentContent =
      editingState?.sectionType === sectionType &&
      editingState?.entryId === entryId &&
      editingState?.bulletIndex === bulletIndex &&
      editingState?.editedText
        ? editingState.editedText
        : content;

    const context: EditContext = {
      sectionType,
      entryId,
      bulletIndex,
      originalContent: currentContent,
      isActive: true,
    };
    onAskAI?.(prompt, context);
  };

  // Check if a specific bullet is being edited
  const isBulletEditing = (sectionType: SectionType, entryId: string, bulletIndex: number) => {
    return (
      editingState?.sectionType === sectionType &&
      editingState?.entryId === entryId &&
      editingState?.bulletIndex === bulletIndex
    );
  };

  // Auto-close bullet edit when a section-level edit starts
  useEffect(() => {
    if (editingState && editContext?.isActive && editContext.sectionType !== editingState.sectionType) {
      setEditingState(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editContext]);

  // ─── Contact ────────────────────────────────────────────────────────────────
  const contactSection = resume.contact;
  const hasContact = !!(contactSection && (contactSection.name || contactSection.email));

  // ─── Build rendered sections from resume.sections ───────────────────────────
  const renderedSections = (resume.sections || []).map((section) => {
    const accepted = acceptedChanges[section.type] ?? false;

    // ── Summary ──────────────────────────────────────────────────────────────
    if (section.type === 'summary') {
      const displayText = accepted
        ? (tailoredData.summary?.tailored ?? section.content)
        : section.content;
      const summaryText = String(displayText || '');
      const summaryExplanation = tailoredData.summary?.explanation;

      if (!summaryText.trim()) return null;

      return (
        <ResumeSectionCard
          key="summary"
          id="summary"
          title={section.rawLabel || 'Summary'}
          isActive={activeSection === 'summary'}
          isTailored={accepted}
          onEdit={(content) => onEditContent('summary', null, null, content)}
          onAskAI={(prompt) =>
            onAskAI?.(prompt, {
              sectionType: 'summary',
              entryId: '',
              bulletIndex: -1,
              originalContent: summaryText,
              isActive: true,
            })
          }
          content={summaryText}
          aiSuggestion={editContext?.sectionType === 'summary' ? aiSuggestion : undefined}
          aiExplanation={
            (editContext?.sectionType === 'summary' && aiExplanation) || summaryExplanation
          }
          canUndo={canUndo?.('summary')}
          canRedo={canRedo?.('summary')}
          onUndo={() => onUndo?.('summary', summaryText)}
          onRedo={() => onRedo?.('summary')}
          editContext={editContext}
          onStartSectionEdit={onStartEdit}
        >
          <p className="leading-relaxed">{summaryText}</p>
        </ResumeSectionCard>
      );
    }

    // ── Skills ───────────────────────────────────────────────────────────────
    if (section.type === 'skills') {
      const displayText = accepted
        ? (tailoredData.skills?.tailored ?? section.content)
        : section.content;
      const skillsText = String(displayText || '');
      const skillsExplanation = tailoredData.skills?.explanation;

      if (!skillsText.trim()) return null;

      return (
        <ResumeSectionCard
          key="skills"
          id="skills"
          title={section.rawLabel || 'Skills'}
          isActive={activeSection === 'skills'}
          isTailored={accepted}
          onEdit={(content) => onEditContent('skills', null, null, content)}
          onAskAI={(prompt) =>
            onAskAI?.(prompt, {
              sectionType: 'skills',
              entryId: '',
              bulletIndex: -1,
              originalContent: skillsText,
              isActive: true,
            })
          }
          content={skillsText}
          aiSuggestion={editContext?.sectionType === 'skills' ? aiSuggestion : undefined}
          aiExplanation={
            (editContext?.sectionType === 'skills' && aiExplanation) || skillsExplanation
          }
          canUndo={canUndo?.('skills')}
          canRedo={canRedo?.('skills')}
          onUndo={() => onUndo?.('skills', skillsText)}
          onRedo={() => onRedo?.('skills')}
          editContext={editContext}
          onStartSectionEdit={onStartEdit}
        >
          <p className="leading-relaxed">{skillsText}</p>
        </ResumeSectionCard>
      );
    }

    // ── Experience ───────────────────────────────────────────────────────────
    if (section.type === 'experience') {
      const expSection = section as ExperienceSection;
      if (!expSection.jobs || expSection.jobs.length === 0) return null;

      return (
        <ResumeSectionCard
          key="experience"
          id="experience"
          title={section.rawLabel || 'Experience'}
          isActive={activeSection === 'experience'}
          isTailored={accepted}
        >
          <div className="space-y-6">
            {expSection.jobs.map((job, jobIdx) => {
              const tailoredJob = tailoredData.jobs?.find(j => j.id === job.id);

              return (
                <div key={job.id} className={jobIdx > 0 ? 'pt-4 border-t border-dark-border' : ''}>
                  {/* Job Header */}
                  <div className="mb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-text-primary">{job.company}</h4>
                        {job.title && (
                          <p className="text-sm text-text-secondary">{job.title}</p>
                        )}
                      </div>
                      <div className="text-right text-sm text-text-muted">
                        {job.dates && <div>{job.dates}</div>}
                        {job.location && <div>{job.location}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Job Bullets */}
                  {job.bullets && job.bullets.length > 0 && (
                    <ul className="space-y-3">
                      {job.bullets.map((bullet) => {
                        const tailoredBullet = accepted && tailoredJob
                          ? tailoredJob.bullets.find(b => b.index === bullet.index)
                          : undefined;
                        const displayText = tailoredBullet ? tailoredBullet.tailored : bullet.text;
                        const bulletExplanation = tailoredBullet?.explanation;
                        const editKey = `experience:${job.id}:${bullet.index}`;
                        const cachedExplanation = bulletAICacheRef.current.get(editKey)?.explanation;
                        const isEditingThis = isBulletEditing('experience', job.id, bullet.index);
                        const aiIsForThisBullet =
                          isEditingThis && aiResponseBelongsToBullet('experience', job.id, bullet.index);

                        return (
                          <EditableBullet
                            key={bullet.index}
                            bullet={displayText}
                            isEditing={isEditingThis}
                            editedText={editingState?.editedText ?? displayText}
                            onStartEdit={() =>
                              handleStartBulletEdit('experience', job.id, bullet.index, displayText)
                            }
                            onTextChange={handleTextChange}
                            onSave={() => handleSaveBullet('experience', job.id, bullet.index)}
                            onCancel={handleEditComplete}
                            onAskAI={(prompt) =>
                              handleAskAI(prompt, 'experience', job.id, bullet.index, displayText)
                            }
                            aiSuggestion={aiIsForThisBullet ? aiSuggestion : undefined}
                            aiExplanation={
                              (aiIsForThisBullet && aiExplanation) ||
                              cachedExplanation ||
                              bulletExplanation
                            }
                            canUndo={canUndo?.(editKey)}
                            canRedo={canRedo?.(editKey)}
                            onUndo={() => onUndo?.(editKey, displayText)}
                            onRedo={() => onRedo?.(editKey)}
                          />
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </ResumeSectionCard>
      );
    }

    // ── Education ────────────────────────────────────────────────────────────
    if (section.type === 'education') {
      const eduSection = section as EducationSection;
      if (!eduSection.entries || eduSection.entries.length === 0) return null;

      const tailoredSection = tailoredData.sections?.find(s => s.sectionType === 'education');

      return (
        <ResumeSectionCard
          key="education"
          id="education"
          title={section.rawLabel || 'Education'}
          isActive={activeSection === 'education'}
          isTailored={accepted}
        >
          <div className="space-y-4">
            {eduSection.entries.map((entry, entryIdx) => {
              const tailoredEntry = accepted && tailoredSection
                ? tailoredSection.entries.find(e => e.id === entry.id)
                : undefined;

              return (
                <div key={entry.id} className={entryIdx > 0 ? 'pt-3 border-t border-dark-border' : ''}>
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h4 className="font-medium text-text-primary">{entry.institution}</h4>
                      {(entry.degree || entry.field) && (
                        <p className="text-sm text-text-secondary">
                          {entry.degree}{entry.field ? `, ${entry.field}` : ''}
                        </p>
                      )}
                    </div>
                    {entry.dates && (
                      <div className="text-sm text-text-muted">{entry.dates}</div>
                    )}
                  </div>
                  {entry.bullets && entry.bullets.length > 0 && (
                    <ul className="space-y-2 mt-2">
                      {entry.bullets.map((bullet) => {
                        const tailoredBullet = tailoredEntry
                          ? tailoredEntry.bullets.find(b => b.index === bullet.index)
                          : undefined;
                        const displayText = tailoredBullet ? tailoredBullet.tailored : bullet.text;
                        const editKey = `education:${entry.id}:${bullet.index}`;
                        const cachedExplanation = bulletAICacheRef.current.get(editKey)?.explanation;
                        const isEditingThis = isBulletEditing('education', entry.id, bullet.index);
                        const aiIsForThisBullet =
                          isEditingThis && aiResponseBelongsToBullet('education', entry.id, bullet.index);

                        return (
                          <EditableBullet
                            key={bullet.index}
                            bullet={displayText}
                            isEditing={isEditingThis}
                            editedText={editingState?.editedText ?? displayText}
                            onStartEdit={() =>
                              handleStartBulletEdit('education', entry.id, bullet.index, displayText)
                            }
                            onTextChange={handleTextChange}
                            onSave={() => handleSaveBullet('education', entry.id, bullet.index)}
                            onCancel={handleEditComplete}
                            onAskAI={(prompt) =>
                              handleAskAI(prompt, 'education', entry.id, bullet.index, displayText)
                            }
                            aiSuggestion={aiIsForThisBullet ? aiSuggestion : undefined}
                            aiExplanation={
                              (aiIsForThisBullet && aiExplanation) ||
                              cachedExplanation ||
                              tailoredBullet?.explanation
                            }
                            canUndo={canUndo?.(editKey)}
                            canRedo={canRedo?.(editKey)}
                            onUndo={() => onUndo?.(editKey, displayText)}
                            onRedo={() => onRedo?.(editKey)}
                          />
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </ResumeSectionCard>
      );
    }

    // ── Projects ─────────────────────────────────────────────────────────────
    if (section.type === 'projects') {
      const projSection = section as ProjectsSection;
      if (!projSection.entries || projSection.entries.length === 0) return null;

      const tailoredSection = tailoredData.sections?.find(s => s.sectionType === 'projects');

      return (
        <ResumeSectionCard
          key="projects"
          id="projects"
          title={section.rawLabel || 'Projects'}
          isActive={activeSection === 'projects'}
          isTailored={accepted}
        >
          <div className="space-y-4">
            {projSection.entries.map((entry, entryIdx) => {
              const tailoredEntry = accepted && tailoredSection
                ? tailoredSection.entries.find(e => e.id === entry.id)
                : undefined;

              return (
                <div key={entry.id} className={entryIdx > 0 ? 'pt-3 border-t border-dark-border' : ''}>
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-medium text-text-primary">{entry.name}</h4>
                    {entry.dates && (
                      <div className="text-sm text-text-muted">{entry.dates}</div>
                    )}
                  </div>
                  {entry.description && (
                    <p className="text-sm text-text-secondary mb-2">{entry.description}</p>
                  )}
                  {entry.bullets && entry.bullets.length > 0 && (
                    <ul className="space-y-2">
                      {entry.bullets.map((bullet) => {
                        const tailoredBullet = tailoredEntry
                          ? tailoredEntry.bullets.find(b => b.index === bullet.index)
                          : undefined;
                        const displayText = tailoredBullet ? tailoredBullet.tailored : bullet.text;
                        const editKey = `projects:${entry.id}:${bullet.index}`;
                        const cachedExplanation = bulletAICacheRef.current.get(editKey)?.explanation;
                        const isEditingThis = isBulletEditing('projects', entry.id, bullet.index);
                        const aiIsForThisBullet =
                          isEditingThis && aiResponseBelongsToBullet('projects', entry.id, bullet.index);

                        return (
                          <EditableBullet
                            key={bullet.index}
                            bullet={displayText}
                            isEditing={isEditingThis}
                            editedText={editingState?.editedText ?? displayText}
                            onStartEdit={() =>
                              handleStartBulletEdit('projects', entry.id, bullet.index, displayText)
                            }
                            onTextChange={handleTextChange}
                            onSave={() => handleSaveBullet('projects', entry.id, bullet.index)}
                            onCancel={handleEditComplete}
                            onAskAI={(prompt) =>
                              handleAskAI(prompt, 'projects', entry.id, bullet.index, displayText)
                            }
                            aiSuggestion={aiIsForThisBullet ? aiSuggestion : undefined}
                            aiExplanation={
                              (aiIsForThisBullet && aiExplanation) ||
                              cachedExplanation ||
                              tailoredBullet?.explanation
                            }
                            canUndo={canUndo?.(editKey)}
                            canRedo={canRedo?.(editKey)}
                            onUndo={() => onUndo?.(editKey, displayText)}
                            onRedo={() => onRedo?.(editKey)}
                          />
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </ResumeSectionCard>
      );
    }

    // ── Certifications ───────────────────────────────────────────────────────
    if (section.type === 'certifications') {
      const certSection = section as CertificationsSection;
      if (!certSection.entries || certSection.entries.length === 0) return null;

      const tailoredSection = tailoredData.sections?.find(s => s.sectionType === 'certifications');

      return (
        <ResumeSectionCard
          key="certifications"
          id="certifications"
          title={section.rawLabel || 'Certifications'}
          isActive={activeSection === 'certifications'}
          isTailored={accepted}
        >
          <div className="space-y-3">
            {certSection.entries.map((entry, entryIdx) => {
              const tailoredEntry = accepted && tailoredSection
                ? tailoredSection.entries.find(e => e.id === entry.id)
                : undefined;

              return (
                <div key={entry.id} className={entryIdx > 0 ? 'pt-2 border-t border-dark-border' : ''}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-text-primary text-sm">{entry.name}</p>
                      {entry.issuer && (
                        <p className="text-xs text-text-secondary">{entry.issuer}</p>
                      )}
                    </div>
                    {entry.date && (
                      <div className="text-xs text-text-muted">{entry.date}</div>
                    )}
                  </div>
                  {entry.bullets && entry.bullets.length > 0 && (
                    <ul className="space-y-2 mt-2">
                      {entry.bullets.map((bullet) => {
                        const tailoredBullet = tailoredEntry
                          ? tailoredEntry.bullets.find(b => b.index === bullet.index)
                          : undefined;
                        const displayText = tailoredBullet ? tailoredBullet.tailored : bullet.text;
                        const editKey = `certifications:${entry.id}:${bullet.index}`;
                        const cachedExplanation = bulletAICacheRef.current.get(editKey)?.explanation;
                        const isEditingThis = isBulletEditing('certifications', entry.id, bullet.index);
                        const aiIsForThisBullet =
                          isEditingThis &&
                          aiResponseBelongsToBullet('certifications', entry.id, bullet.index);

                        return (
                          <EditableBullet
                            key={bullet.index}
                            bullet={displayText}
                            isEditing={isEditingThis}
                            editedText={editingState?.editedText ?? displayText}
                            onStartEdit={() =>
                              handleStartBulletEdit(
                                'certifications',
                                entry.id,
                                bullet.index,
                                displayText
                              )
                            }
                            onTextChange={handleTextChange}
                            onSave={() =>
                              handleSaveBullet('certifications', entry.id, bullet.index)
                            }
                            onCancel={handleEditComplete}
                            onAskAI={(prompt) =>
                              handleAskAI(
                                prompt,
                                'certifications',
                                entry.id,
                                bullet.index,
                                displayText
                              )
                            }
                            aiSuggestion={aiIsForThisBullet ? aiSuggestion : undefined}
                            aiExplanation={
                              (aiIsForThisBullet && aiExplanation) ||
                              cachedExplanation ||
                              tailoredBullet?.explanation
                            }
                            canUndo={canUndo?.(editKey)}
                            canRedo={canRedo?.(editKey)}
                            onUndo={() => onUndo?.(editKey, displayText)}
                            onRedo={() => onRedo?.(editKey)}
                          />
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </ResumeSectionCard>
      );
    }

    // ── Awards ───────────────────────────────────────────────────────────────
    if (section.type === 'awards') {
      const awardsSection = section as AwardsSection;
      if (!awardsSection.entries || awardsSection.entries.length === 0) return null;

      const tailoredSection = tailoredData.sections?.find(s => s.sectionType === 'awards');

      return (
        <ResumeSectionCard
          key="awards"
          id="awards"
          title={section.rawLabel || 'Awards'}
          isActive={activeSection === 'awards'}
          isTailored={accepted}
        >
          <div className="space-y-3">
            {awardsSection.entries.map((entry, entryIdx) => {
              const tailoredEntry = accepted && tailoredSection
                ? tailoredSection.entries.find(e => e.id === entry.id)
                : undefined;

              return (
                <div key={entry.id} className={entryIdx > 0 ? 'pt-2 border-t border-dark-border' : ''}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-text-primary text-sm">{entry.name}</p>
                      {entry.issuer && (
                        <p className="text-xs text-text-secondary">{entry.issuer}</p>
                      )}
                    </div>
                    {entry.date && (
                      <div className="text-xs text-text-muted">{entry.date}</div>
                    )}
                  </div>
                  {entry.bullets && entry.bullets.length > 0 && (
                    <ul className="space-y-2 mt-2">
                      {entry.bullets.map((bullet) => {
                        const tailoredBullet = tailoredEntry
                          ? tailoredEntry.bullets.find(b => b.index === bullet.index)
                          : undefined;
                        const displayText = tailoredBullet ? tailoredBullet.tailored : bullet.text;
                        const editKey = `awards:${entry.id}:${bullet.index}`;
                        const cachedExplanation = bulletAICacheRef.current.get(editKey)?.explanation;
                        const isEditingThis = isBulletEditing('awards', entry.id, bullet.index);
                        const aiIsForThisBullet =
                          isEditingThis && aiResponseBelongsToBullet('awards', entry.id, bullet.index);

                        return (
                          <EditableBullet
                            key={bullet.index}
                            bullet={displayText}
                            isEditing={isEditingThis}
                            editedText={editingState?.editedText ?? displayText}
                            onStartEdit={() =>
                              handleStartBulletEdit('awards', entry.id, bullet.index, displayText)
                            }
                            onTextChange={handleTextChange}
                            onSave={() => handleSaveBullet('awards', entry.id, bullet.index)}
                            onCancel={handleEditComplete}
                            onAskAI={(prompt) =>
                              handleAskAI(prompt, 'awards', entry.id, bullet.index, displayText)
                            }
                            aiSuggestion={aiIsForThisBullet ? aiSuggestion : undefined}
                            aiExplanation={
                              (aiIsForThisBullet && aiExplanation) ||
                              cachedExplanation ||
                              tailoredBullet?.explanation
                            }
                            canUndo={canUndo?.(editKey)}
                            canRedo={canRedo?.(editKey)}
                            onUndo={() => onUndo?.(editKey, displayText)}
                            onRedo={() => onRedo?.(editKey)}
                          />
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </ResumeSectionCard>
      );
    }

    // ── Generic sections (volunteer, languages, contact, unknown) ────────────
    if (
      section.type === 'volunteer' ||
      section.type === 'languages' ||
      section.type === 'contact' ||
      section.type === 'unknown'
    ) {
      const genSection = section as GenericSection;
      const hasGenericContent =
        (genSection.content && genSection.content.trim()) ||
        (genSection.entries && genSection.entries.length > 0);
      if (!hasGenericContent) return null;

      const sectionId = section.type === 'contact' ? 'contact-section' : section.type;

      return (
        <ResumeSectionCard
          key={sectionId}
          id={sectionId}
          title={section.rawLabel || section.type}
          isActive={activeSection === sectionId}
        >
          {genSection.content ? (
            <p className="leading-relaxed">{genSection.content}</p>
          ) : (
            <div className="space-y-2">
              {genSection.entries?.map((entry) => (
                <div key={entry.id}>
                  {entry.name && (
                    <p className="font-medium text-text-primary text-sm">{entry.name}</p>
                  )}
                  {entry.content && (
                    <p className="text-sm text-text-secondary">{entry.content}</p>
                  )}
                  {entry.bullets && entry.bullets.length > 0 && (
                    <ul className="space-y-1 mt-1">
                      {entry.bullets.map((b) => (
                        <li key={b.index} className="flex items-start gap-2">
                          <span className="text-accent-blue mt-1.5 text-[10px] flex-shrink-0">●</span>
                          <span className="text-sm leading-relaxed">{b.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </ResumeSectionCard>
      );
    }

    return null;
  });

  const hasAnySections = (resume.sections || []).length > 0;

  return (
    <div className="space-y-1">
      {/* Contact Section */}
      {hasContact && (
        <ResumeSectionCard
          id="contact"
          title="Contact Information"
          isActive={activeSection === 'contact'}
        >
          <div>
            {contactSection?.name && (
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                {contactSection.name}
              </h3>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              {contactSection?.email && (
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {contactSection.email}
                </span>
              )}
              {contactSection?.phone && (
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {contactSection.phone}
                </span>
              )}
              {contactSection?.linkedin && (
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  {contactSection.linkedin}
                </span>
              )}
            </div>
          </div>
        </ResumeSectionCard>
      )}

      {/* Render sections in order */}
      {renderedSections}

      {/* Show message if nothing to display */}
      {!hasContact && !hasAnySections && (
        <div className="text-center py-12 text-text-muted">
          <p>No resume content to display.</p>
          <p className="text-sm mt-2">Try uploading a different file format.</p>
        </div>
      )}
    </div>
  );
};
