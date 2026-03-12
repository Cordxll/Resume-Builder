import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  getStoredApiKey,
  setStoredApiKey,
  hasServerApiKey,
  hasAnyApiKey
} from '../services/storage';
import { usageTracker } from '../services/usageTracker';
import { useTheme } from '../hooks/useTheme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export { getStoredApiKey, setStoredApiKey, hasServerApiKey, hasAnyApiKey };

export const checkServerApiKey = async (): Promise<boolean> => {
  try {
    const config = await api.getConfig();
    return config.hasServerApiKey;
  } catch {
    return false;
  }
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverKeyConfigured, setServerKeyConfigured] = useState(false);
  const [connectionTest, setConnectionTest] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState(usageTracker.getSummary());
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (isOpen) {
      setApiKey(getStoredApiKey());
      setSaved(false);
      setConnectionTest('idle');
      setConnectionError(null);
      setUsageStats(usageTracker.getSummary());
      // Check server key status
      checkServerApiKey().then(setServerKeyConfigured);
    }
  }, [isOpen]);

  const handleResetUsage = () => {
    usageTracker.resetStats();
    setUsageStats(usageTracker.getSummary());
  };

  const handleTestConnection = async () => {
    setConnectionTest('testing');
    setConnectionError(null);
    try {
      const result = await api.checkHealth();
      if (result.connected) {
        setConnectionTest('success');
      } else {
        setConnectionTest('error');
        setConnectionError(result.error || 'Connection failed');
      }
    } catch (err) {
      setConnectionTest('error');
      setConnectionError('Failed to test connection');
    }
  };

  const handleSave = () => {
    setStoredApiKey(apiKey);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  const handleClear = () => {
    setApiKey('');
    setStoredApiKey('');
    setSaved(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-dark-surface border border-dark-border rounded-2xl w-full max-w-3xl shadow-xl max-h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Server Key Status */}
          {serverKeyConfigured && (
            <div className="flex items-start gap-3 p-3 bg-accent-green/10 border border-accent-green/30 rounded-lg">
              <svg className="w-5 h-5 text-accent-green flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-text-secondary">
                <span className="font-medium text-accent-green">Server API key active.</span>{' '}
                The server has a key configured. You can use the app as-is, or add your own below to override it.
              </p>
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Appearance - Theme Toggle */}
            <div className="md:col-span-2 flex items-center justify-between p-4 bg-dark-elevated border border-dark-border rounded-lg">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <svg className="w-5 h-5 text-accent-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-accent-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
                <div>
                  <p className="text-sm font-medium text-text-primary">Appearance</p>
                  <p className="text-xs text-text-muted">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                  theme === 'dark' ? 'bg-accent-blue' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                    theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {/* Left Column - API Key */}
            <div className="space-y-4">
              <div>
                <label htmlFor="api-key" className="block mb-2">
                  <span className="text-sm font-medium text-text-primary">API Key</span>
                  {serverKeyConfigured && <span className="text-xs text-text-muted ml-2">(optional)</span>}
                </label>
                <p className="text-xs text-text-muted mb-3">
                  Stored locally in your browser, never sent to our servers.
                </p>
                <div className="relative">
                  <input
                    id="api-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key..."
                    className="w-full px-4 py-3 pr-12 bg-dark-elevated border border-dark-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showKey ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Test Connection */}
              <div className="space-y-2">
                <button
                  onClick={handleTestConnection}
                  disabled={connectionTest === 'testing'}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    connectionTest === 'success'
                      ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                      : connectionTest === 'error'
                        ? 'bg-accent-red/20 text-accent-red border border-accent-red/30'
                        : 'bg-dark-elevated border border-dark-border text-text-secondary hover:text-text-primary hover:border-accent-blue'
                  }`}
                >
                  {connectionTest === 'testing' ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Testing...
                    </>
                  ) : connectionTest === 'success' ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Connected
                    </>
                  ) : connectionTest === 'error' ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Failed
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Test Connection
                    </>
                  )}
                </button>
                {connectionError && (
                  <p className="text-xs text-accent-red px-1">{connectionError}</p>
                )}
              </div>

              {/* Get API Key Info */}
              <div className="flex items-start gap-3 p-3 bg-accent-blue/10 border border-accent-blue/30 rounded-lg">
                <svg className="w-4 h-4 text-accent-blue flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-text-secondary">
                  Get a free key from{' '}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline">Google AI Studio</a>
                  {' '}or{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline">OpenAI</a>
                </p>
              </div>
            </div>

            {/* Right Column - Usage Stats */}
            <div className="p-4 bg-dark-elevated border border-dark-border rounded-lg space-y-3 h-fit">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-sm font-medium text-text-primary">Usage & Cost</span>
                </div>
                <button onClick={handleResetUsage} className="text-xs text-text-muted hover:text-accent-red transition-colors">Reset</button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-dark-hover rounded-lg p-2.5">
                  <p className="text-xs text-text-muted">Today</p>
                  <p className="text-base font-semibold text-text-primary">{usageStats.today.calls} <span className="text-xs font-normal text-text-muted">calls</span></p>
                  <p className="text-xs text-accent-green">~{usageStats.today.cost}</p>
                </div>
                <div className="bg-dark-hover rounded-lg p-2.5">
                  <p className="text-xs text-text-muted">All Time</p>
                  <p className="text-base font-semibold text-text-primary">{usageStats.total.calls} <span className="text-xs font-normal text-text-muted">calls</span></p>
                  <p className="text-xs text-accent-green">~{usageStats.total.cost}</p>
                </div>
              </div>

              {usageStats.byEndpoint.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {usageStats.byEndpoint.map(({ name, calls }) => (
                    <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-dark-surface rounded text-xs">
                      <span className="text-text-secondary">{name}:</span>
                      <span className="text-text-primary font-medium">{calls}</span>
                    </span>
                  ))}
                </div>
              )}

              {usageStats.total.calls > 0 && (
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {usageStats.costByModel.map(({ name, totalCost }) => (
                    <div key={name} className="flex justify-between px-2 py-1 bg-dark-surface rounded">
                      <span className="text-text-secondary truncate">{name}</span>
                      <span className="text-text-primary font-medium">{totalCost}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <a href="https://aistudio.google.com/app/plan_information" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-dark-hover rounded text-xs text-accent-blue hover:underline">
                  Gemini Dashboard
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
                <a href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-dark-hover rounded text-xs text-accent-blue hover:underline">
                  OpenAI Dashboard
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-dark-border">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm text-text-muted hover:text-accent-red transition-colors"
          >
            Clear Key
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                saved
                  ? 'bg-accent-green text-dark-bg'
                  : 'bg-accent-blue text-dark-bg hover:bg-opacity-90'
              }`}
            >
              {saved ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved!
                </span>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
