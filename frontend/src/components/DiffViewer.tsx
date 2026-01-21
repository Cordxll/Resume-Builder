import React from 'react';
import { TailoredData, AcceptedChanges } from '../types';

interface DiffViewerProps {
  tailoredData: TailoredData;
  acceptedChanges: AcceptedChanges;
  onToggleChange: (section: keyof AcceptedChanges) => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  tailoredData,
  acceptedChanges,
  onToggleChange,
}) => {
  const renderDiff = (
    sectionName: string,
    original: string | string[],
    tailored: string | string[],
    changes: string[],
    isAccepted: boolean,
    onToggle: () => void
  ) => {
    const originalText = Array.isArray(original) ? original.join('\n') : original;
    const tailoredText = Array.isArray(tailored) ? tailored.join('\n') : tailored;

    return (
      <div className={`diff-section ${isAccepted ? 'accepted' : ''}`}>
        <div className="diff-header">
          <h3>{sectionName}</h3>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isAccepted}
              onChange={onToggle}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="diff-content">
          <div className="diff-column original">
            <h4>Original</h4>
            <div className="content-box">
              {Array.isArray(original) ? (
                <ul>
                  {original.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>{original || 'N/A'}</p>
              )}
            </div>
          </div>

          <div className="diff-column tailored">
            <h4>Tailored (ATS-Optimized)</h4>
            <div className="content-box">
              {Array.isArray(tailored) ? (
                <ul>
                  {tailored.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>{tailored || 'N/A'}</p>
              )}
            </div>
          </div>
        </div>

        {changes.length > 0 && (
          <div className="changes-summary">
            <h4>Changes Made:</h4>
            <ul>
              {changes.map((change, idx) => (
                <li key={idx}>{change}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="diff-viewer">
      <h2>Resume Comparison - Accept or Reject Changes</h2>
      <p className="help-text">
        Toggle the switches to accept or reject tailored suggestions for each section.
      </p>

      {renderDiff(
        'Professional Summary',
        tailoredData.original.summary,
        tailoredData.tailored.summary,
        tailoredData.changes.summary,
        acceptedChanges.summary,
        () => onToggleChange('summary')
      )}

      {renderDiff(
        'Experience',
        tailoredData.original.experience,
        tailoredData.tailored.experience,
        tailoredData.changes.experience,
        acceptedChanges.experience,
        () => onToggleChange('experience')
      )}

      {renderDiff(
        'Skills',
        tailoredData.original.skills,
        tailoredData.tailored.skills,
        tailoredData.changes.skills,
        acceptedChanges.skills,
        () => onToggleChange('skills')
      )}
    </div>
  );
};
