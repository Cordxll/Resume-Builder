import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { InlineEditPopup } from './InlineEditPopup';
import { EditContext } from '../../types';

interface ResumeSectionCardProps {
  id: string;
  title: string;
  isActive: boolean;
  isTailored?: boolean;
  children: ReactNode;
  onEdit?: (content: string) => void;
  onAskAI?: (prompt: string) => void;
  content?: string;
  aiSuggestion?: string;
  aiExplanation?: string;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  editContext?: EditContext | null;
  onStartSectionEdit?: (context: EditContext) => void;
}

export const ResumeSectionCard: React.FC<ResumeSectionCardProps> = ({
  id,
  title,
  isActive,
  isTailored = false,
  children,
  onEdit,
  onAskAI,
  content,
  aiSuggestion,
  aiExplanation,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  editContext,
  onStartSectionEdit,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isClosingEdit, setIsClosingEdit] = useState(false);
  const [editedContent, setEditedContent] = useState(content || '');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionOnEditStartRef = useRef<string | undefined>(undefined);
  const lastAppliedSuggestionRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isEditing && textareaRef.current && !isTyping) {
      textareaRef.current.focus();
      // Auto-resize
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editedContent, isTyping]);

  // Snapshot suggestion when editing starts/stops
  useEffect(() => {
    if (isEditing) {
      suggestionOnEditStartRef.current = aiSuggestion;
      lastAppliedSuggestionRef.current = aiSuggestion;
    } else {
      suggestionOnEditStartRef.current = undefined;
      lastAppliedSuggestionRef.current = undefined;
      setIsTyping(false);
      if (typingRef.current) clearTimeout(typingRef.current);
    }
    // Only run when isEditing changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // Typewriter effect — only when a NEW suggestion arrives AFTER editing started
  useEffect(() => {
    if (
      !isEditing ||
      !aiSuggestion ||
      aiSuggestion === suggestionOnEditStartRef.current ||
      aiSuggestion === lastAppliedSuggestionRef.current
    ) {
      return;
    }

    lastAppliedSuggestionRef.current = aiSuggestion;
    setIsTyping(true);
    let charIndex = 0;
    const fullText = aiSuggestion;

    setEditedContent('');

    const typeNextChar = () => {
      charIndex++;
      setEditedContent(fullText.slice(0, charIndex));
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
      if (charIndex < fullText.length) {
        const speed = 12 + Math.random() * 18;
        typingRef.current = setTimeout(typeNextChar, speed);
      } else {
        setIsTyping(false);
      }
    };

    typingRef.current = setTimeout(typeNextChar, 200);

    return () => {
      if (typingRef.current) clearTimeout(typingRef.current);
    };
  }, [aiSuggestion, isEditing]);

  // If closing and there's no popup to animate, close immediately
  useEffect(() => {
    if (isClosingEdit && !onAskAI) {
      setIsEditing(false);
      setIsClosingEdit(false);
    }
  }, [isClosingEdit, onAskAI]);

  // Auto-close when another section starts editing
  useEffect(() => {
    if (isEditing && editContext?.isActive && editContext.sectionType !== id) {
      setEditedContent(content || '');
      setIsEditing(false);
      setIsClosingEdit(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editContext]);

  const handleStartEdit = () => {
    setEditedContent(content || '');
    setIsClosingEdit(false);
    setIsEditing(true);
    // Notify parent so other edits can close
    onStartSectionEdit?.({
      sectionType: id as import('../../types').SectionType,
      entryId: '',
      bulletIndex: -1,
      originalContent: content || '',
      isActive: true,
    });
  };

  const handleSave = () => {
    if (onEdit && editedContent.trim() !== content) {
      onEdit(editedContent.trim());
    }
    // Trigger close animation
    setIsClosingEdit(true);
  };

  const handleCancel = () => {
    setEditedContent(content || '');
    // Trigger close animation
    setIsClosingEdit(true);
  };

  const handleAnimationComplete = () => {
    setIsEditing(false);
    setIsClosingEdit(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && e.metaKey) {
      handleSave();
    }
  };

  const handleAskAI = (prompt: string) => {
    onAskAI?.(prompt);
  };

  return (
    <div
      id={id}
      className={`
        py-4 border-b border-dark-border transition-colors
        ${isActive ? 'bg-accent-blue/5' : ''}
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
          {isTailored && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium text-accent-green">
              TAILORED
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canRedo && onRedo && !isEditing && (
            <button
              onClick={onRedo}
              className="text-accent-green hover:text-accent-green/80 transition-colors text-xs flex items-center gap-1"
              aria-label={`Redo ${title} changes`}
              title="Restore edited version"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
              </svg>
              Redo
            </button>
          )}
          {canUndo && onUndo && !isEditing && (
            <button
              onClick={onUndo}
              className="text-accent-yellow hover:text-accent-yellow/80 transition-colors text-xs flex items-center gap-1"
              aria-label={`Undo ${title} changes`}
              title="Revert to original"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Undo
            </button>
          )}
          {onEdit && content && !isEditing && (
            <button
              onClick={handleStartEdit}
              className="text-text-muted hover:text-accent-blue transition-colors text-xs"
              aria-label={`Edit ${title}`}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {isEditing && onEdit ? (
        <div>
          {/* Inline editable text */}
          <textarea
            ref={textareaRef}
            value={editedContent}
            onChange={(e) => {
              if (isTyping) return;
              setEditedContent(e.target.value);
              // Auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={handleKeyDown}
            className={`w-full bg-transparent text-sm text-text-secondary leading-relaxed focus:outline-none resize-none border-b-2 pb-1 transition-colors duration-300 ${
              isTyping ? 'border-accent-green text-accent-green/90' : 'border-accent-blue'
            }`}
            rows={1}
            readOnly={isTyping}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-text-muted">⌘+Enter to save · Esc to cancel</span>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
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
          
          {/* AI Chat Bubble */}
          {onAskAI && (
            <InlineEditPopup
              onAskAI={handleAskAI}
              onClose={handleCancel}
              isClosing={isClosingEdit}
              onAnimationComplete={handleAnimationComplete}
              aiExplanation={aiExplanation}
              isTyping={isTyping}
            />
          )}
        </div>
      ) : (
        <div className="text-sm text-text-secondary leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
};
