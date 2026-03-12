import React from 'react';
import { ResumePreview } from '../resume/ResumePreview';
import { ParsedResume, TailoredData, AcceptedChanges, EditContext, SectionType } from '../../types';

interface CenterPanelProps {
  resume: ParsedResume;
  tailoredData: TailoredData;
  acceptedChanges: AcceptedChanges;
  activeSection: string | null;
  onEditContent: (sectionType: SectionType, entryId: string | null, bulletIndex: number | null, content: string) => void;
  onStartEdit?: (context: EditContext) => void;
  onAskAI?: (prompt: string, context: EditContext) => void;
  aiSuggestion?: string;
  aiExplanation?: string;
  onAcceptSuggestion?: (suggestion: string) => void;
  editContext?: EditContext | null;
  onUndo?: (key: string, currentValue: string) => void;
  onRedo?: (key: string) => void;
  canUndo?: (key: string) => boolean;
  canRedo?: (key: string) => boolean;
}

export const CenterPanel: React.FC<CenterPanelProps> = ({
  resume,
  tailoredData,
  acceptedChanges,
  activeSection,
  onEditContent,
  onStartEdit,
  onAskAI,
  aiSuggestion,
  aiExplanation,
  onAcceptSuggestion,
  editContext,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  return (
    <div className="h-full overflow-y-auto px-8 py-6">
      <div className="max-w-2xl mx-auto">
        <ResumePreview
          resume={resume}
          tailoredData={tailoredData}
          acceptedChanges={acceptedChanges}
          activeSection={activeSection}
          onEditContent={onEditContent}
          onStartEdit={onStartEdit}
          onAskAI={onAskAI}
          aiSuggestion={aiSuggestion}
          aiExplanation={aiExplanation}
          onAcceptSuggestion={onAcceptSuggestion}
          editContext={editContext}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </div>
    </div>
  );
};
