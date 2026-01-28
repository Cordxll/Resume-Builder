import React, { useState } from 'react';
import { TailoredData, ParsedResume, AcceptedChanges } from '../types';
import { api } from '../services/api';

interface TailoredResumeViewProps {
  resume: ParsedResume;
  tailoredData: TailoredData;
  onBack: () => void;
}

export const TailoredResumeView: React.FC<TailoredResumeViewProps> = ({
  resume,
  tailoredData,
  onBack,
}) => {
  const [editMode, setEditMode] = useState<{ section: string; index?: number } | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'agent'; content: string }>>([
    { role: 'agent', content: 'Hi! I can help you refine your tailored resume. What would you like to update?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [localTailoredData, setLocalTailoredData] = useState(tailoredData);
  const [acceptedChanges, setAcceptedChanges] = useState<AcceptedChanges>({
    summary: true,
    experience: true,
    skills: true,
  });
  const [loading, setLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleEdit = (section: string, index?: number) => {
    setEditMode({ section, index });
    
    if (section === 'summary') {
      setEditedContent(localTailoredData.tailored.summary);
    } else if (section === 'experience' && index !== undefined) {
      setEditedContent(localTailoredData.tailored.experience[index]);
    } else if (section === 'skills') {
      setEditedContent(localTailoredData.tailored.skills);
    }
  };

  const handleSaveEdit = () => {
    if (!editMode) return;

    const newData = { ...localTailoredData };
    
    if (editMode.section === 'summary') {
      newData.tailored.summary = editedContent;
    } else if (editMode.section === 'experience' && editMode.index !== undefined) {
      newData.tailored.experience[editMode.index] = editedContent;
    } else if (editMode.section === 'skills') {
      newData.tailored.skills = editedContent;
    }

    setLocalTailoredData(newData);
    setEditMode(null);
    setEditedContent('');
  };

  const handleCancelEdit = () => {
    setEditMode(null);
    setEditedContent('');
  };

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;

    // Add user message
    setChatMessages([...chatMessages, { role: 'user', content: chatInput }]);
    
    // Simulate agent response (in real implementation, this would call an API)
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        role: 'agent',
        content: "I understand you'd like to make that change. You can click the edit button next to any section to modify it directly. Would you like me to suggest specific improvements?"
      }]);
    }, 1000);

    setChatInput('');
  };

  const handleExport = async () => {
    setLoading(true);
    setExportError(null);
    try {
      const originalSections = {
        contact: resume?.contact || {},
        summary: localTailoredData.original.summary,
        experience: localTailoredData.original.experience,
        skills: localTailoredData.original.skills,
        education: resume?.education || {},
        certifications: resume?.certifications || {},
      };

      const tailoredSections = {
        summary: localTailoredData.tailored.summary,
        experience: localTailoredData.tailored.experience,
        skills: localTailoredData.tailored.skills,
      };

      const blob = await api.exportDocx(
        originalSections,
        tailoredSections,
        acceptedChanges
      );

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
  };

  const renderSection = (
    title: string,
    sectionKey: 'summary' | 'experience' | 'skills',
    content: string | string[],
    changes: string[]
  ) => {
    const isArray = Array.isArray(content);
    const isAccepted = acceptedChanges[sectionKey];

    return (
      <div className={`bg-white rounded-xl shadow-md p-6 border-2 transition-all ${isAccepted ? 'border-green-300' : 'border-gray-200'}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              {title}
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={isAccepted}
                  onChange={() => setAcceptedChanges(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
                  className="sr-only peer"
                  aria-label={`Accept changes for ${title}`}
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                <span className="ml-2 text-sm font-medium text-gray-700">
                  {isAccepted ? 'Accepted' : 'Accept'}
                </span>
              </label>
            </h3>
          </div>
        </div>

        {/* Content Display */}
        <div className="space-y-4">
          {isArray ? (
            <ul className="space-y-3">
              {(content as string[]).map((item, index) => (
                <li key={index} className="flex items-start gap-3 group">
                  <span className="text-primary-600 mt-1">•</span>
                  {editMode?.section === sectionKey && editMode?.index === index ? (
                    <div className="flex-1 space-y-2">
                      <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="w-full px-3 py-2 border border-primary-500 rounded-lg focus:ring-2 focus:ring-primary-500"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-gray-800 leading-relaxed">{item}</span>
                      <button
                        onClick={() => handleEdit(sectionKey, index)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-primary-600 hover:text-primary-700"
                        aria-label={`Edit bullet point ${index + 1}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="group">
              {editMode?.section === sectionKey ? (
                <div className="space-y-2">
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full px-3 py-2 border border-primary-500 rounded-lg focus:ring-2 focus:ring-primary-500"
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <p className="text-gray-800 leading-relaxed">{content as string}</p>
                  <button
                    onClick={() => handleEdit(sectionKey)}
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-primary-600 hover:text-primary-700"
                    aria-label={`Edit ${title}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Change Explanations */}
        {changes.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Why These Changes?
            </h4>
            <ul className="space-y-2">
              {changes.map((change, idx) => (
                <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Upload
          </button>
          
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
            Your Tailored Resume
          </h1>

          <button
            onClick={handleExport}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-lg hover:from-primary-700 hover:to-secondary-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {loading ? 'Exporting...' : 'Export DOCX'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {exportError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-red-800 text-sm font-medium">{exportError}</p>
              <button
                onClick={() => setExportError(null)}
                className="text-red-600 hover:text-red-700 text-sm underline mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {renderSection(
            'Professional Summary',
            'summary',
            localTailoredData.tailored.summary,
            localTailoredData.changes.summary
          )}

          {renderSection(
            'Experience',
            'experience',
            localTailoredData.tailored.experience,
            localTailoredData.changes.experience
          )}

          {renderSection(
            'Skills',
            'skills',
            localTailoredData.tailored.skills,
            localTailoredData.changes.skills
          )}
        </div>
      </div>

      {/* Chat Agent Button */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-20"
        aria-label={showChat ? 'Close chat assistant' : 'Open chat assistant'}
      >
        {showChat ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {showChat && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-20">
          <div className="bg-gradient-to-r from-primary-600 to-secondary-600 text-white px-4 py-3 rounded-t-xl">
            <h3 className="font-semibold">Resume Assistant</h3>
            <p className="text-xs opacity-90">Ask me to help refine your resume</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2 rounded-lg ${
                  msg.role === 'user' 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                placeholder="Ask for improvements..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
              <button
                onClick={handleChatSubmit}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                aria-label="Send message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
