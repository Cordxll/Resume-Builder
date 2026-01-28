import React, { useState } from 'react';
import { api } from '../services/api';
import { ParsedResume, TailoredData } from '../types';

interface CombinedUploadProps {
  onTailoringComplete: (resume: ParsedResume, tailoredData: TailoredData) => void;
}

export const CombinedUpload: React.FC<CombinedUploadProps> = ({ onTailoringComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!file && !jobDescription) {
      setError('Please upload a resume and paste a job description');
      return;
    }
    if (!file) {
      setError('Please upload a resume');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Please paste a job description');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Parse resume
      const resumeResult = await api.parseResume(file);
      
      // Tailor resume based on job description
      const tailoredResult = await api.tailorResume(resumeResult.raw_text || '', jobDescription);
      
      // Navigate to results page
      onTailoringComplete(resumeResult, tailoredResult);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to process resume. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-4">
            Resume Tailor
          </h1>
          <p className="text-xl text-gray-600">
            Transform your resume to emphasize impact, ownership, and results
          </p>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8">
          {/* Resume Upload Section */}
          <div>
            <label className="block mb-3">
              <span className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Upload Your Resume
              </span>
              <span className="text-sm text-gray-500 mt-1 block">PDF or DOCX format</span>
            </label>
            
            <div className="relative">
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
                className={`
                  flex items-center justify-center w-full px-6 py-8 border-2 border-dashed rounded-xl
                  transition-all duration-200 cursor-pointer
                  ${file 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-gray-300 hover:border-primary-400 bg-gray-50 hover:bg-primary-50'
                  }
                  ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <div className="text-center">
                  {file ? (
                    <>
                      <svg className="w-12 h-12 mx-auto text-primary-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-primary-700 font-medium">{file.name}</p>
                      <p className="text-sm text-gray-500 mt-1">Click to change file</p>
                    </>
                  ) : (
                    <>
                      <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-gray-700 font-medium mb-1">Drop your resume here or click to browse</p>
                      <p className="text-sm text-gray-500">Supports PDF and DOCX files</p>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Job Description Section */}
          <div>
            <label htmlFor="job-description" className="block mb-3">
              <span className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Paste Job Description
              </span>
              <span className="text-sm text-gray-500 mt-1 block">The role you're targeting</span>
            </label>
            
            <textarea
              id="job-description"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              disabled={loading}
              placeholder="Paste the complete job description here, including requirements, responsibilities, and qualifications..."
              className="w-full h-64 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={loading || !file || !jobDescription.trim()}
            className={`
              w-full py-4 px-6 rounded-xl font-semibold text-lg
              transition-all duration-200 flex items-center justify-center gap-3
              ${loading || !file || !jobDescription.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary-600 to-secondary-600 text-white hover:from-primary-700 hover:to-secondary-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
              }
            `}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing Your Resume...
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
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white/60 backdrop-blur rounded-xl p-6 border border-gray-200">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Impact First</h3>
            <p className="text-sm text-gray-600">Emphasize business outcomes and quantifiable results</p>
          </div>
          
          <div className="bg-white/60 backdrop-blur rounded-xl p-6 border border-gray-200">
            <div className="w-10 h-10 bg-secondary-100 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Strong Ownership</h3>
            <p className="text-sm text-gray-600">Use powerful action verbs: built, led, shipped, improved</p>
          </div>
          
          <div className="bg-white/60 backdrop-blur rounded-xl p-6 border border-gray-200">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Human Readable</h3>
            <p className="text-sm text-gray-600">Clear, scannable content that recruiters love</p>
          </div>
        </div>
      </div>
    </div>
  );
};
