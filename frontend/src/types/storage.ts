import { ParsedResume, TailoredData, AcceptedChanges, ChatMessage } from './index';

export interface StoredResume {
  id: string;
  name: string;
  rawText: string;
  parsedData: ParsedResume;
  uploadedAt: string;
}

export interface StoredJobDescription {
  id: string;
  title: string;
  company?: string;
  content: string;
  url?: string;
  createdAt: string;
}

export type SessionStatus = 'active' | 'completed';

export type ApplicationStatus =
  | 'saved'        // bookmarked, haven't applied yet
  | 'applied'      // submitted application
  | 'phone-screen' // initial phone/recruiter screen
  | 'interview-1'  // first round interview
  | 'interview-2'  // second round
  | 'interview-3'  // third+ round
  | 'take-home'    // take-home assignment
  | 'offered'      // received offer
  | 'accepted'     // accepted offer
  | 'rejected'     // rejected (by them or by you)
  | 'withdrawn'    // withdrew application
  | 'none';        // not tracking

export interface InterviewRound {
  round: number;
  type: 'phone' | 'technical' | 'behavioral' | 'system-design' | 'hiring-manager' | 'panel' | 'other';
  date?: string;        // ISO date string
  notes?: string;
  interviewerName?: string;
  outcome?: 'passed' | 'failed' | 'pending' | 'cancelled';
}

export interface ApplicationTracking {
  applicationUrl?: string;
  appliedVia?: string;
  contactName?: string;
  contactEmail?: string;
  salary?: string;
  notes?: string;
  interviews: InterviewRound[];
  nextFollowUp?: string;  // ISO date
  tags?: string[];
}

export interface TailoringSession {
  id: string;
  resumeId: string;
  jobDescriptionId: string;
  tailoredData: TailoredData;
  acceptedChanges: AcceptedChanges;
  chatHistory: ChatMessage[];
  status: SessionStatus;
  applicationStatus: ApplicationStatus;
  appliedAt?: string;
  tracking?: ApplicationTracking;
  createdAt: string;
  updatedAt: string;
}

export interface SessionWithRelations extends TailoringSession {
  resume: StoredResume;
  jobDescription: StoredJobDescription;
}
