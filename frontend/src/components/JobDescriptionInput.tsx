import React, { useState } from 'react';

interface JobDescriptionInputProps {
  onJobDescriptionSubmit: (jobDescription: string) => void;
}

export const JobDescriptionInput: React.FC<JobDescriptionInputProps> = ({
  onJobDescriptionSubmit,
}) => {
  const [jobDescription, setJobDescription] = useState('');

  const handleSubmit = () => {
    if (jobDescription.trim()) {
      onJobDescriptionSubmit(jobDescription);
    }
  };

  return (
    <div className="job-description-input">
      <h2>Job Description</h2>
      <textarea
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        placeholder="Paste the job description here..."
        rows={10}
      />
      <button onClick={handleSubmit} disabled={!jobDescription.trim()}>
        Analyze & Tailor Resume
      </button>
    </div>
  );
};
