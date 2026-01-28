import React, { useState } from 'react';
import { api } from '../services/api';
import { ParsedResume } from '../types';

interface ResumeUploadProps {
  onResumeLoaded: (resume: ParsedResume) => void;
}

export const ResumeUpload: React.FC<ResumeUploadProps> = ({ onResumeLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [textInput, setTextInput] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api.parseResume(file);
      onResumeLoaded(result);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to parse resume');
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) {
      setError('Please enter resume text');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.parseResume(undefined, textInput);
      onResumeLoaded(result);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to parse resume');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="resume-upload">
      <h2>Upload Your Resume</h2>
      
      <div className="input-mode-selector">
        <button
          className={inputMode === 'file' ? 'active' : ''}
          onClick={() => setInputMode('file')}
        >
          Upload File
        </button>
        <button
          className={inputMode === 'text' ? 'active' : ''}
          onClick={() => setInputMode('text')}
        >
          Paste Text
        </button>
      </div>

      {inputMode === 'file' ? (
        <div className="file-upload">
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileUpload}
            disabled={loading}
          />
          <p className="help-text">Supported formats: PDF, DOCX</p>
        </div>
      ) : (
        <div className="text-upload">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste your resume text here..."
            rows={10}
            disabled={loading}
          />
          <button onClick={handleTextSubmit} disabled={loading || !textInput.trim()}>
            {loading ? 'Processing...' : 'Submit Resume'}
          </button>
        </div>
      )}

      {loading && <p className="loading">Processing your resume...</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
};
