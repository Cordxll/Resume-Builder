import React, { useState, useEffect, useRef } from 'react';

interface InlineEditPopupProps {
  onAskAI: (prompt: string) => void;
  onClose: () => void;
  isClosing?: boolean;
  onAnimationComplete?: () => void;
  aiExplanation?: string;
  isTyping?: boolean;
}

export const InlineEditPopup: React.FC<InlineEditPopupProps> = ({
  onAskAI,
  onClose,
  isClosing: externalIsClosing = false,
  onAnimationComplete,
  aiExplanation,
  isTyping = false,
}) => {
  const [aiPrompt, setAiPrompt] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Initialize with aiExplanation if available on mount — shows instantly (no typewriter)
  // Typewriter animation only triggers when aiExplanation CHANGES after mount
  const [displayedExplanation, setDisplayedExplanation] = useState(aiExplanation || '');
  const [isExplanationTyping, setIsExplanationTyping] = useState(false);
  const explanationTypingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevExplanationRef = useRef<string | undefined>(aiExplanation);

  useEffect(() => {
    // Trigger animation after mount
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
    inputRef.current?.focus();
  }, []);

  // Handle external closing trigger
  useEffect(() => {
    if (externalIsClosing && !isClosing) {
      setIsClosing(true);
      setIsVisible(false);
      setTimeout(() => {
        onAnimationComplete?.();
      }, 500);
    }
  }, [externalIsClosing, isClosing, onAnimationComplete]);

  const handleClose = () => {
    if (isClosing) return;
    // Trigger reverse animation
    setIsClosing(true);
    setIsVisible(false);
    // Wait for animation to complete before actually closing
    setTimeout(() => {
      // If parent is managing close via onAnimationComplete, use that
      if (onAnimationComplete) {
        onAnimationComplete();
      } else {
        onClose();
      }
    }, 500);
  };

  const handleAskAI = () => {
    if (aiPrompt.trim()) {
      onAskAI(aiPrompt.trim());
      setAiPrompt('');
    }
  };

  // Line-by-line reveal for explanation text
  useEffect(() => {
    if (aiExplanation && aiExplanation !== prevExplanationRef.current) {
      prevExplanationRef.current = aiExplanation;
      setIsExplanationTyping(true);
      setDisplayedExplanation('');

      // Split into sentences/lines for line-by-line reveal
      const lines = aiExplanation
        .split(/(?<=[.!?])\s+/)
        .filter(l => l.trim().length > 0);
      
      let lineIndex = 0;

      const showNextLine = () => {
        lineIndex++;
        setDisplayedExplanation(lines.slice(0, lineIndex).join(' '));
        if (lineIndex < lines.length) {
          explanationTypingRef.current = setTimeout(showNextLine, 400 + Math.random() * 200);
        } else {
          setIsExplanationTyping(false);
        }
      };

      // Start after a small delay
      explanationTypingRef.current = setTimeout(showNextLine, 300);
    } else if (!aiExplanation) {
      setDisplayedExplanation('');
      prevExplanationRef.current = undefined;
    }

    return () => {
      if (explanationTypingRef.current) clearTimeout(explanationTypingRef.current);
    };
  }, [aiExplanation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter' && aiPrompt.trim()) {
      handleAskAI();
    }
  };

  return (
    <div 
      className={`
        transition-all duration-500 ease-out overflow-hidden
        ${isVisible ? 'opacity-100 max-h-60 mt-3 mb-2' : 'opacity-0 max-h-0 mt-0 mb-0'}
      `}
    >
      {/* AI Explanation or Typing Indicator */}
      {(aiExplanation || isTyping) && (
        <div className="mb-2 p-2.5 bg-accent-blue/10 border border-accent-blue/20 rounded-lg animate-fade-in">
          {isTyping && !aiExplanation ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-bounce" />
              </div>
              <span className="text-[10px] text-text-muted">AI is writing...</span>
            </div>
          ) : aiExplanation ? (
            <div className="flex items-start gap-2">
              <svg className="w-3.5 h-3.5 text-accent-blue flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-text-secondary leading-relaxed flex-1">
                {displayedExplanation}
                {isExplanationTyping && (
                  <span className="inline-block w-0.5 h-3 bg-accent-blue ml-0.5 animate-pulse align-middle" />
                )}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* AI Chat Bubble - styled like a search bar */}
      <div className="relative">
        <div className="flex items-center gap-3 px-4 py-3 bg-dark-elevated border border-dark-border rounded-full shadow-lg">
          {/* AI Icon */}
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          
          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none"
            placeholder="Ask AI to improve this bullet..."
          />
          
          {/* Quick suggestions */}
          <div className="hidden sm:flex items-center gap-1.5">
            {['Impactful', 'Metrics', 'Shorter'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setAiPrompt(suggestion === 'Impactful' ? 'Make more impactful' : suggestion === 'Metrics' ? 'Add metrics' : 'Make shorter');
                  inputRef.current?.focus();
                }}
                className="px-2 py-0.5 text-[10px] text-text-muted hover:text-text-secondary bg-dark-surface rounded-full border border-dark-border hover:border-accent-blue/50 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
          
          {/* Send button */}
          <button
            onClick={handleAskAI}
            disabled={!aiPrompt.trim()}
            className="flex-shrink-0 p-1.5 rounded-full bg-accent-blue text-dark-bg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-opacity-90 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 12h14" />
            </svg>
          </button>
          
          {/* Close button */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
