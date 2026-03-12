// Canonical section types — the LLM maps every section header to one of these
export type SectionType =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'certifications'
  | 'projects'
  | 'awards'
  | 'volunteer'
  | 'languages'
  | 'contact'
  | 'unknown';

// ─── Contact ──────────────────────────────────────────────────────────────────
export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

// ─── Atomic bullet ────────────────────────────────────────────────────────────
export interface Bullet {
  text: string;
  index: number; // position within parent entry
}

// ─── Entry types (used inside ParsedSections) ─────────────────────────────────
export interface JobEntry {
  id: string; // stable: "job-0", "job-1", …
  company: string;
  title: string;
  location?: string;
  dates?: string;
  bullets: Bullet[];
}

export interface EduEntry {
  id: string; // "edu-0", "edu-1", …
  institution: string;
  degree: string;
  field?: string;
  dates?: string;
  bullets: Bullet[];
}

export interface ProjectEntry {
  id: string; // "proj-0", "proj-1", …
  name: string;
  dates?: string;
  description?: string;
  bullets: Bullet[];
}

export interface CertEntry {
  id: string; // "cert-0", …
  name: string;
  issuer?: string;
  date?: string;
  bullets: Bullet[];
}

export interface AwardEntry {
  id: string; // "award-0", …
  name: string;
  issuer?: string;
  date?: string;
  bullets: Bullet[];
}

export interface GenericEntry {
  id: string;
  name?: string;
  content?: string;
  bullets: Bullet[];
}

// ─── Parsed sections (discriminated union on `type`) ──────────────────────────
export interface SummarySection {
  type: 'summary';
  rawLabel: string;
  confidence: number;
  content: string;
}

export interface ExperienceSection {
  type: 'experience';
  rawLabel: string;
  confidence: number;
  jobs: JobEntry[];
}

export interface EducationSection {
  type: 'education';
  rawLabel: string;
  confidence: number;
  entries: EduEntry[];
}

export interface SkillsSection {
  type: 'skills';
  rawLabel: string;
  confidence: number;
  content: string;
}

export interface ProjectsSection {
  type: 'projects';
  rawLabel: string;
  confidence: number;
  entries: ProjectEntry[];
}

export interface CertificationsSection {
  type: 'certifications';
  rawLabel: string;
  confidence: number;
  entries: CertEntry[];
}

export interface AwardsSection {
  type: 'awards';
  rawLabel: string;
  confidence: number;
  entries: AwardEntry[];
}

export interface GenericSection {
  type: 'volunteer' | 'languages' | 'contact' | 'unknown';
  rawLabel: string;
  confidence: number;
  content?: string;
  entries?: GenericEntry[];
}

export type ParsedSection =
  | SummarySection
  | ExperienceSection
  | EducationSection
  | SkillsSection
  | ProjectsSection
  | CertificationsSection
  | AwardsSection
  | GenericSection;

// ─── Top-level parsed resume ───────────────────────────────────────────────────
export interface ParsedResume {
  contact?: ContactInfo;
  sections: ParsedSection[];
  raw_text?: string;
}

// ─── Per-bullet tailoring ─────────────────────────────────────────────────────
export interface TailoredBullet {
  index: number;
  original: string;
  tailored: string;
  explanation: string;
}

export interface TailoredJobEntry {
  id: string;
  company: string;
  title: string;
  location?: string;
  dates?: string;
  bullets: TailoredBullet[];
}

export interface TailoredSectionEntry {
  id: string;
  bullets: TailoredBullet[];
}

export interface TailoredSection {
  sectionType: SectionType;
  entries: TailoredSectionEntry[];
}

// ─── Full tailoring result ────────────────────────────────────────────────────
export interface TailoredData {
  summary: {
    original: string;
    tailored: string;
    explanation: string;
  };
  skills: {
    original: string;
    tailored: string;
    explanation: string;
  };
  jobs: TailoredJobEntry[];
  /** Tailored bullets for education, projects, certifications, etc. */
  sections: TailoredSection[];
}

// ─── Accepted changes (per section) ───────────────────────────────────────────
export interface AcceptedChanges {
  summary: boolean;
  experience: boolean;
  skills: boolean;
  [sectionType: string]: boolean;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  /** Clean version for sidebar display (hides prompt engineering details) */
  displayContent?: string;
  timestamp: Date;
}

// ─── Inline editing ───────────────────────────────────────────────────────────
/** Identifies which bullet is currently being edited.
 *  Key format for edit history: "{sectionType}:{entryId}:{bulletIndex}"
 *  e.g. "experience:job-0:2", "education:edu-1:0", "projects:proj-0:1"
 */
export interface EditContext {
  sectionType: SectionType;
  entryId: string;    // e.g. "job-0", "edu-1", "proj-0"
  bulletIndex: number;
  originalContent: string;
  isActive: boolean;
}

export interface EditHistoryEntry {
  key: string;
  originalTailored: string;
  currentValue: string;
  timestamp: Date;
}

export interface PanelState {
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  activeSection: string | null;
}
