export interface ResumeSection {
  content: string;
  bullets?: string[];
}

export interface ParsedResume {
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
  };
  summary?: ResumeSection;
  experience?: ResumeSection;
  education?: ResumeSection;
  skills?: ResumeSection;
  certifications?: ResumeSection;
  projects?: ResumeSection;
  raw_text?: string;
}

export interface TailoredData {
  original: {
    summary: string;
    experience: string[];
    skills: string;
  };
  tailored: {
    summary: string;
    experience: string[];
    skills: string;
  };
  changes: {
    summary: string[];
    experience: string[];
    skills: string[];
  };
}

export interface AcceptedChanges {
  summary: boolean;
  experience: boolean;
  skills: boolean;
}
