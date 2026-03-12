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

export type ApplicationStatus = 'none' | 'applied' | 'interviewing' | 'offered' | 'rejected';

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
  createdAt: string;
  updatedAt: string;
}

export interface SessionWithRelations extends TailoringSession {
  resume: StoredResume;
  jobDescription: StoredJobDescription;
}
