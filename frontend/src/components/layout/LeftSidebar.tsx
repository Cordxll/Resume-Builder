import React from 'react';
import { ParsedResume } from '../../types';

interface LeftSidebarProps {
  resume: ParsedResume;
  activeSection: string | null;
  onSectionSelect: (section: string) => void;
}

interface SectionItem {
  id: string;
  label: string;
  available: boolean;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  resume,
  activeSection,
  onSectionSelect,
}) => {
  // Build the set of section types present in the parsed resume
  const sectionTypeSet = new Set((resume.sections || []).map(s => s.type));

  const sections: SectionItem[] = [
    { id: 'contact', label: 'Contact', available: !!resume.contact },
    { id: 'summary', label: 'Summary', available: sectionTypeSet.has('summary') },
    { id: 'experience', label: 'Experience', available: sectionTypeSet.has('experience') },
    { id: 'skills', label: 'Skills', available: sectionTypeSet.has('skills') },
    { id: 'education', label: 'Education', available: sectionTypeSet.has('education') },
    { id: 'certifications', label: 'Certifications', available: sectionTypeSet.has('certifications') },
    { id: 'projects', label: 'Projects', available: sectionTypeSet.has('projects') },
  ];

  const availableSections = sections.filter(s => s.available);

  return (
    <aside className="w-48 border-r border-dark-border flex flex-col">
      <div className="py-4">
        <h2 className="px-4 text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
          Sections
        </h2>
        <nav>
          {availableSections.map((section) => (
            <button
              key={section.id}
              onClick={() => onSectionSelect(section.id)}
              className={`
                w-full text-left px-4 py-2.5 text-sm transition-colors
                border-l-2
                ${activeSection === section.id
                  ? 'text-accent-blue border-accent-blue bg-accent-blue/5'
                  : 'text-text-secondary hover:text-text-primary border-transparent hover:bg-dark-hover/50'
                }
              `}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
};
