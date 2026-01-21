import React, { useState } from 'react';
import { ResumeUpload } from './components/ResumeUpload';
import { JobDescriptionInput } from './components/JobDescriptionInput';
import { DiffViewer } from './components/DiffViewer';
import { api } from './services/api';
import { ParsedResume, TailoredData, AcceptedChanges } from './types';
import './App.css';

function App() {
  const [resume, setResume] = useState<ParsedResume | null>(null);
  const [tailoredData, setTailoredData] = useState<TailoredData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedChanges, setAcceptedChanges] = useState<AcceptedChanges>({
    summary: true,
    experience: true,
    skills: true,
  });

  const handleResumeLoaded = (parsedResume: ParsedResume) => {
    setResume(parsedResume);
    setTailoredData(null);
    setError(null);
  };

  const handleJobDescriptionSubmit = async (jobDescription: string) => {
    if (!resume || !resume.raw_text) {
      setError('Please upload a resume first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.tailorResume(resume.raw_text, jobDescription);
      setTailoredData(result);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to tailor resume');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChange = (section: keyof AcceptedChanges) => {
    setAcceptedChanges((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleExport = async () => {
    if (!tailoredData) return;

    setLoading(true);
    setError(null);

    try {
      const originalSections = {
        contact: resume?.contact || {},
        summary: tailoredData.original.summary,
        experience: tailoredData.original.experience,
        skills: tailoredData.original.skills,
        education: resume?.education || {},
        certifications: resume?.certifications || {},
      };

      const tailoredSections = {
        summary: tailoredData.tailored.summary,
        experience: tailoredData.tailored.experience,
        skills: tailoredData.tailored.skills,
      };

      const blob = await api.exportDocx(
        originalSections,
        tailoredSections,
        acceptedChanges
      );

      // Download the file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tailored_resume.docx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to export resume');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header>
        <h1>Resume Builder - ATS-Friendly Tailoring</h1>
        <p>Upload your resume and job description to get ATS-optimized suggestions</p>
      </header>

      <main>
        <div className="input-section">
          <ResumeUpload onResumeLoaded={handleResumeLoaded} />
          
          {resume && (
            <div className="resume-loaded">
              <p className="success">✓ Resume loaded successfully</p>
            </div>
          )}

          {resume && (
            <JobDescriptionInput onJobDescriptionSubmit={handleJobDescriptionSubmit} />
          )}
        </div>

        {loading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Processing... This may take a few moments.</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        {tailoredData && !loading && (
          <>
            <DiffViewer
              tailoredData={tailoredData}
              acceptedChanges={acceptedChanges}
              onToggleChange={handleToggleChange}
            />

            <div className="export-section">
              <button className="export-button" onClick={handleExport}>
                Export as DOCX
              </button>
            </div>
          </>
        )}
      </main>

      <footer>
        <p>Built with FastAPI + React + TypeScript</p>
      </footer>
    </div>
  );
}

export default App;
