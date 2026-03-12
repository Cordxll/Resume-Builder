import React, { useState, useRef, useEffect } from 'react';
import { AcceptedChanges, ChatMessage, EditContext } from '../../types';
import { extractSuggestion, formatAgentEditResponse, formatUserEditMessage } from '../../utils/extractSuggestion';

interface RightSidebarProps {
  acceptedChanges: AcceptedChanges;
  onAcceptChange: (section: keyof AcceptedChanges) => void;
  onSendMessage: (message: string) => void;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  hasApiKey: boolean;
  editContext?: EditContext | null;
  onApplyEdit?: (newContent: string) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  acceptedChanges,
  onAcceptChange,
  onSendMessage,
  chatMessages,
  chatLoading,
  hasApiKey,
  editContext,
  onApplyEdit,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setQuickActionsOpen(false);
      }
    };
    if (quickActionsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [quickActionsOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || chatLoading) return;
    onSendMessage(trimmed);
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <aside className="w-[340px] flex flex-col overflow-hidden">
      {/* Apply Changes - minimal toggle */}
      <div className="px-4 pt-3">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Apply Changes
          <svg
            className={`w-3 h-3 transition-transform ${settingsOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {settingsOpen && (
          <div className="mt-2 mb-1 space-y-2.5">
            {(['summary', 'experience', 'skills'] as const).map((section) => (
              <div key={section} className="flex items-center justify-between">
                <span className="text-xs text-text-secondary capitalize">{section}</span>
                <button
                  onClick={() => onAcceptChange(section)}
                  className={`
                    relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                    ${acceptedChanges[section] ? 'bg-accent-green' : 'bg-dark-border'}
                  `}
                  role="switch"
                  aria-checked={acceptedChanges[section]}
                >
                  <span
                    className={`
                      inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
                      ${acceptedChanges[section] ? 'translate-x-[18px]' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Context Banner */}
      {editContext?.isActive && (
        <div className="mx-4 mt-3 px-3 py-2 bg-accent-blue/10 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-accent-blue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-accent-blue">Editing {editContext.sectionType}</p>
              <p className="text-[10px] text-text-muted truncate">{editContext.originalContent}</p>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {chatMessages.map((msg, msgIndex) => {
          // Extract suggested content from AI responses for potential apply action
          const suggestedContent = msg.role === 'agent' && editContext?.isActive
            ? extractSuggestion(msg.content)
            : null;

          // Get clean display text
          const displayText = msg.role === 'user'
            ? (msg.displayContent || formatUserEditMessage(msg.content))
            : formatAgentEditResponse(msg.content);

          return (
            <div key={msg.id}>
              {msg.role === 'user' ? (
                /* User messages - blue-tinted card style matching agent messages */
                <div className="flex justify-end">
                  <div className="max-w-[90%] p-3 bg-accent-blue/10 border border-accent-blue/20 rounded-xl">
                    <div className="text-xs text-text-secondary leading-relaxed">
                      <span className="whitespace-pre-wrap">{displayText}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Agent messages - info card style matching InlineEditPopup */
                <div className="max-w-full">
                  <div className="p-3 bg-accent-blue/8 border border-accent-blue/15 rounded-xl">
                    <div className="flex items-start gap-2.5">
                      <svg className="w-4 h-4 text-accent-blue flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1 min-w-0 text-xs text-text-secondary leading-relaxed">
                        {displayText.split('\n').map((line, i) => {
                          const parts = line.split(/(\*\*[^*]+\*\*)/g);
                          return (
                            <React.Fragment key={i}>
                              {i > 0 && <br />}
                              {parts.map((part, j) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                  return (
                                    <span key={j} className="font-semibold text-text-primary">
                                      {part.slice(2, -2)}
                                    </span>
                                  );
                                }
                                return <span key={j}>{part}</span>;
                              })}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Apply button for AI suggestions when editing */}
                  {suggestedContent && onApplyEdit && msgIndex === chatMessages.length - 1 && (
                    <div className="mt-2 ml-6">
                      <button
                        onClick={() => onApplyEdit(suggestedContent)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-accent-green/15 text-accent-green rounded-full border border-accent-green/25 hover:bg-accent-green/25 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Apply suggestion
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading indicator */}
        {chatLoading && (
          <div className="p-3 bg-accent-blue/8 border border-accent-blue/15 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-bounce" />
              </div>
              <span className="text-[10px] text-text-muted">AI is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* No API Key Notice */}
      {!hasApiKey && (
        <div className="mx-4 mb-2 p-2.5 bg-accent-yellow/10 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-3.5 h-3.5 text-accent-yellow mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-text-muted">
              Add an OpenAI API key in Settings for AI-powered responses.
            </p>
          </div>
        </div>
      )}

      {/* Chat Input - pill-shaped bar matching InlineEditPopup style */}
      <div className="px-3 pb-4 pt-2">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-dark-elevated border border-dark-border rounded-full overflow-hidden">
          {/* AI Icon */}
          <div className="flex-shrink-0">
            <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your resume..."
            disabled={chatLoading}
            className="flex-1 min-w-0 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none disabled:opacity-50"
          />

          {/* Send button with right-click for quick actions */}
          <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button
              onClick={handleSend}
              onContextMenu={(e) => {
                e.preventDefault();
                setQuickActionsOpen(!quickActionsOpen);
              }}
              disabled={chatLoading}
              title="Right-click for quick actions"
              className="p-1.5 rounded-full bg-accent-blue text-dark-bg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-opacity-90 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7-7 7" />
              </svg>
            </button>

            {/* Quick actions dropdown */}
            {quickActionsOpen && (
              <div className="absolute bottom-full right-0 mb-2 py-1 bg-dark-elevated border border-dark-border rounded-lg shadow-lg min-w-[140px] z-10">
                {[
                  { label: 'Impactful', prompt: 'Make more impactful' },
                  { label: 'Add Metrics', prompt: 'Add metrics' },
                  { label: 'Shorter', prompt: 'Make shorter' },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={() => {
                      setInputValue(action.prompt);
                      setQuickActionsOpen(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:text-text-primary hover:bg-dark-surface transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
