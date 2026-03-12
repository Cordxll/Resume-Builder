import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { ParsedResume, TailoredData, AcceptedChanges, ChatMessage, EditContext, SectionType } from '../types';
import { StoredResume, StoredJobDescription, TailoringSession, ApplicationStatus } from '../types/storage';
import { resumeDB, jobDescriptionDB, sessionDB, currentSessionStorage } from '../services/db';

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// State shape
interface AppState {
  currentView: 'upload' | 'workspace' | 'tracker';
  currentSessionId: string | null;

  // Current session data
  resume: ParsedResume | null;
  resumeText: string;
  jobDescription: string;
  tailoredData: TailoredData | null;
  acceptedChanges: AcceptedChanges;
  chatMessages: ChatMessage[];

  // UI state
  activeSection: string | null;
  chatLoading: boolean;
  loading: boolean;
  exportError: string | null;
  
  // Edit context for inline editing and chat integration
  editContext: EditContext | null;
  
  // Edit history for undo/redo functionality
  editHistory: Map<string, { originalTailored: string; editedValue?: string; isUndone?: boolean; timestamp: Date }>;

  // Persistence tracking
  isDirty: boolean;
  isRestoring: boolean;
}

const initialState: AppState = {
  currentView: 'upload',
  currentSessionId: null,
  resume: null,
  resumeText: '',
  jobDescription: '',
  tailoredData: null,
  acceptedChanges: {
    summary: true,
    experience: true,
    skills: true,
  },
  chatMessages: [],
  activeSection: null,
  chatLoading: false,
  loading: false,
  exportError: null,
  editContext: null,
  editHistory: new Map(),
  isDirty: false,
  isRestoring: false,
};

// Action types
type Action =
  | { type: 'SET_VIEW'; payload: 'upload' | 'workspace' | 'tracker' }
  | { type: 'START_SESSION'; payload: { sessionId: string; resume: ParsedResume; resumeText: string; jobDescription: string; tailoredData: TailoredData; chatMessages: ChatMessage[] } }
  | { type: 'RESTORE_SESSION'; payload: { sessionId: string; resume: ParsedResume; resumeText: string; jobDescription: string; tailoredData: TailoredData; acceptedChanges: AcceptedChanges; chatMessages: ChatMessage[]; editHistory?: Map<string, { originalTailored: string; editedValue?: string; isUndone?: boolean; timestamp: Date }> } }
  | { type: 'CLEAR_SESSION' }
  | { type: 'SET_TAILORED_DATA'; payload: TailoredData }
  | { type: 'TOGGLE_ACCEPTED_CHANGE'; payload: keyof AcceptedChanges }
  | { type: 'SET_ACTIVE_SECTION'; payload: string | null }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_CHAT_LOADING'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_EXPORT_ERROR'; payload: string | null }
  | { type: 'SET_EDIT_CONTEXT'; payload: EditContext | null }
  | { type: 'TRACK_EDIT'; payload: { key: string; originalTailored: string } }
  | { type: 'UNDO_EDIT'; payload: { key: string; currentValue: string } }
  | { type: 'REDO_EDIT'; payload: string }
  | { type: 'MARK_CLEAN' }
  | { type: 'SET_RESTORING'; payload: boolean };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };

    case 'START_SESSION':
      return {
        ...state,
        currentView: 'workspace',
        currentSessionId: action.payload.sessionId,
        resume: action.payload.resume,
        resumeText: action.payload.resumeText,
        jobDescription: action.payload.jobDescription,
        tailoredData: action.payload.tailoredData,
        chatMessages: action.payload.chatMessages,
        acceptedChanges: { summary: true, experience: true, skills: true },
        activeSection: null,
        editHistory: new Map(),
        isDirty: true,
      };

    case 'RESTORE_SESSION':
      return {
        ...state,
        currentView: 'workspace',
        currentSessionId: action.payload.sessionId,
        resume: action.payload.resume,
        resumeText: action.payload.resumeText,
        jobDescription: action.payload.jobDescription,
        tailoredData: action.payload.tailoredData,
        acceptedChanges: action.payload.acceptedChanges,
        chatMessages: action.payload.chatMessages,
        activeSection: null,
        editHistory: action.payload.editHistory || new Map(),
        isDirty: false,
        isRestoring: false,
      };

    case 'CLEAR_SESSION':
      return {
        ...initialState,
        currentView: 'upload',
      };

    case 'SET_TAILORED_DATA':
      return { ...state, tailoredData: action.payload, isDirty: true };

    case 'TOGGLE_ACCEPTED_CHANGE':
      return {
        ...state,
        acceptedChanges: {
          ...state.acceptedChanges,
          [action.payload]: !state.acceptedChanges[action.payload],
        },
        isDirty: true,
      };

    case 'SET_ACTIVE_SECTION':
      return { ...state, activeSection: action.payload };

    case 'ADD_CHAT_MESSAGE':
      return {
        ...state,
        chatMessages: [...state.chatMessages, action.payload],
        isDirty: true,
      };

    case 'SET_CHAT_LOADING':
      return { ...state, chatLoading: action.payload };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_EXPORT_ERROR':
      return { ...state, exportError: action.payload };

    case 'SET_EDIT_CONTEXT':
      return { ...state, editContext: action.payload };

    case 'TRACK_EDIT': {
      // Only track if not already tracked (first edit wins)
      if (state.editHistory.has(action.payload.key)) {
        return state;
      }
      const newHistory = new Map(state.editHistory);
      newHistory.set(action.payload.key, {
        originalTailored: action.payload.originalTailored,
        timestamp: new Date(),
      });
      return { ...state, editHistory: newHistory, isDirty: true };
    }

    case 'UNDO_EDIT': {
      const entry = state.editHistory.get(action.payload.key);
      if (!entry || !state.tailoredData) return state;
      const newData = JSON.parse(JSON.stringify(state.tailoredData));
      const key = action.payload.key;

      if (key === 'summary') {
        newData.summary.tailored = entry.originalTailored;
      } else if (key === 'skills') {
        newData.skills.tailored = entry.originalTailored;
      } else {
        // Format: "{sectionType}:{entryId}:{bulletIndex}"
        const colonIdx = key.indexOf(':');
        const rest = key.slice(colonIdx + 1);
        const lastColon = rest.lastIndexOf(':');
        const entryId = rest.slice(0, lastColon);
        const bulletIndex = parseInt(rest.slice(lastColon + 1), 10);
        const sectionType = key.slice(0, colonIdx) as SectionType;

        if (sectionType === 'experience') {
          const job = newData.jobs.find((j: any) => j.id === entryId);
          if (job) {
            const bullet = job.bullets.find((b: any) => b.index === bulletIndex);
            if (bullet) bullet.tailored = entry.originalTailored;
          }
        } else {
          const section = newData.sections.find((s: any) => s.sectionType === sectionType);
          if (section) {
            const sectionEntry = section.entries.find((e: any) => e.id === entryId);
            if (sectionEntry) {
              const bullet = sectionEntry.bullets.find((b: any) => b.index === bulletIndex);
              if (bullet) bullet.tailored = entry.originalTailored;
            }
          }
        }
      }

      const newHistory = new Map(state.editHistory);
      newHistory.set(key, { ...entry, editedValue: action.payload.currentValue, isUndone: true });
      return { ...state, tailoredData: newData, editHistory: newHistory, isDirty: true };
    }

    case 'REDO_EDIT': {
      const entry = state.editHistory.get(action.payload);
      if (!entry || !entry.editedValue || !state.tailoredData) return state;

      // Restore the edited content
      const newData = JSON.parse(JSON.stringify(state.tailoredData));
      const key = action.payload;

      if (key === 'summary') {
        newData.summary.tailored = entry.editedValue;
      } else if (key === 'skills') {
        newData.skills.tailored = entry.editedValue;
      } else {
        // Format: "{sectionType}:{entryId}:{bulletIndex}"
        const colonIdx = key.indexOf(':');
        const rest = key.slice(colonIdx + 1);
        const lastColon = rest.lastIndexOf(':');
        const entryId = rest.slice(0, lastColon);
        const bulletIndex = parseInt(rest.slice(lastColon + 1), 10);
        const sectionType = key.slice(0, colonIdx) as SectionType;

        if (sectionType === 'experience') {
          const job = newData.jobs.find((j: any) => j.id === entryId);
          if (job) {
            const bullet = job.bullets.find((b: any) => b.index === bulletIndex);
            if (bullet) bullet.tailored = entry.editedValue;
          }
        } else {
          const section = newData.sections.find((s: any) => s.sectionType === sectionType);
          if (section) {
            const sectionEntry = section.entries.find((e: any) => e.id === entryId);
            if (sectionEntry) {
              const bullet = sectionEntry.bullets.find((b: any) => b.index === bulletIndex);
              if (bullet) bullet.tailored = entry.editedValue;
            }
          }
        }
      }

      // Update history entry to mark as not undone (redo applied)
      const newHistory = new Map(state.editHistory);
      newHistory.set(key, {
        ...entry,
        isUndone: false,
      });

      return { ...state, tailoredData: newData, editHistory: newHistory, isDirty: true };
    }

    case 'MARK_CLEAN':
      return { ...state, isDirty: false };

    case 'SET_RESTORING':
      return { ...state, isRestoring: action.payload };

    default:
      return state;
  }
}

// Exported session format for import/export
export interface ExportedSession {
  version: 1;
  exportedAt: string;
  resume: StoredResume;
  jobDescription: StoredJobDescription;
  session: TailoringSession;
}

// Session summary for listing
export interface SessionSummary {
  id: string;
  resumeName: string;
  jobTitle: string;
  jobCompany?: string;
  status: 'active' | 'completed';
  applicationStatus: ApplicationStatus;
  appliedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Resume summary for listing saved resumes
export interface SavedResumeSummary {
  id: string;
  name: string;
  uploadedAt: string;
  sessionCount: number;
}

// Job description summary for listing saved JDs
export interface SavedJobDescriptionSummary {
  id: string;
  title: string;
  company?: string;
  url?: string;
  createdAt: string;
  sessionCount: number;
}

// Context types
interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;

  // Action helpers
  startNewSession: (resume: ParsedResume, resumeText: string, jobDescription: string, tailoredData: TailoredData, resumeName?: string) => Promise<void>;
  startSessionWithExistingResume: (resumeId: string, jobDescription: string, tailoredData: TailoredData, jobDescriptionId?: string) => Promise<void>;
  navigateToUpload: (keepSession?: boolean) => void;
  navigateToTracker: () => void;
  resumeSession: (sessionId: string) => Promise<boolean>;
  getSavedSessions: () => Promise<SessionSummary[]>;
  getSavedResumes: () => Promise<SavedResumeSummary[]>;
  getSavedJobDescriptions: () => Promise<SavedJobDescriptionSummary[]>;
  getResumeById: (resumeId: string) => Promise<StoredResume | null>;
  getJobDescriptionById: (id: string) => Promise<StoredJobDescription | null>;
  saveResumeOnly: (resume: ParsedResume, resumeText: string, fileName: string) => Promise<string>;
  saveJobDescriptionOnly: (title: string, content: string, url?: string, company?: string) => Promise<string>;
  deleteJobDescription: (id: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateApplicationStatus: (sessionId: string, status: ApplicationStatus) => Promise<void>;
  exportSession: () => Promise<ExportedSession | null>;
  importSession: (data: ExportedSession) => Promise<boolean>;
  updateTailoredData: (tailoredData: TailoredData) => void;
  toggleAcceptedChange: (section: keyof AcceptedChanges) => void;
  setActiveSection: (section: string | null) => void;
  addChatMessage: (message: ChatMessage) => void;
  setChatLoading: (loading: boolean) => void;
  setLoading: (loading: boolean) => void;
  setExportError: (error: string | null) => void;
  setEditContext: (context: EditContext | null) => void;
  applyEditFromChat: (newContent: string) => void;
  trackEdit: (key: string, originalTailored: string) => void;
  undoEdit: (key: string, currentValue: string) => void;
  redoEdit: (key: string) => void;
  canUndo: (key: string) => boolean;
  canRedo: (key: string) => boolean;
  hasActiveSession: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

// Build initial chat message from tailored data
function buildInitialMessage(tailored: TailoredData): string {
  const parts: string[] = [];
  parts.push("Here's a summary of the changes I've made to your resume:\n");

  if (tailored.summary?.explanation) {
    parts.push('**Summary**');
    parts.push(`- ${tailored.summary.explanation}`);
    parts.push('');
  }

  const jobChanges = tailored.jobs?.flatMap(job =>
    job.bullets.filter(b => b.tailored !== b.original).map(b => b.explanation)
  ) ?? [];
  if (jobChanges.length > 0) {
    parts.push('**Experience**');
    jobChanges.slice(0, 5).forEach(c => parts.push(`- ${c}`));
    parts.push('');
  }

  if (tailored.skills?.explanation) {
    parts.push('**Skills**');
    parts.push(`- ${tailored.skills.explanation}`);
    parts.push('');
  }

  parts.push('You can ask me to refine any section, explain a change, or suggest further improvements.');
  return parts.join('\n');
}

// Extract job title from job description
// Tries to find "Title at/@ Company" pattern, falls back to first line
function extractJobTitle(content: string): string {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return 'Untitled Job';

  const firstLine = lines[0];

  // If the first line looks like a title (short, no sentence structure)
  // and the second line looks like a company name, combine them
  if (lines.length >= 2 && firstLine.length <= 60 && !firstLine.includes('.')) {
    const secondLine = lines[1];
    // Common patterns: "Company Name", "at Company", "@ Company"
    if (secondLine.length <= 40 && !secondLine.includes('.')) {
      const cleaned = secondLine.replace(/^(at|@)\s+/i, '');
      const combined = `${firstLine} @ ${cleaned}`;
      if (combined.length <= 60) return combined;
    }
  }

  if (firstLine.length <= 50) return firstLine;
  return firstLine.substring(0, 47) + '...';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save with debounce
  useEffect(() => {
    if (!state.isDirty || !state.currentSessionId || !state.tailoredData) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const existingSession = await sessionDB.get(state.currentSessionId!);
        if (existingSession) {
          const updatedSession: TailoringSession = {
            ...existingSession,
            tailoredData: state.tailoredData!,
            acceptedChanges: state.acceptedChanges,
            chatHistory: state.chatMessages,
            updatedAt: new Date().toISOString(),
          };
          await sessionDB.save(updatedSession);
          dispatch({ type: 'MARK_CLEAN' });
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 3000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state.isDirty, state.currentSessionId, state.tailoredData, state.acceptedChanges, state.chatMessages]);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const savedSessionId = currentSessionStorage.get();
      if (!savedSessionId) return;

      dispatch({ type: 'SET_RESTORING', payload: true });

      try {
        const sessionWithRelations = await sessionDB.getWithRelations(savedSessionId);
        if (sessionWithRelations) {
          dispatch({
            type: 'RESTORE_SESSION',
            payload: {
              sessionId: sessionWithRelations.id,
              resume: sessionWithRelations.resume.parsedData,
              resumeText: sessionWithRelations.resume.rawText,
              jobDescription: sessionWithRelations.jobDescription.content,
              tailoredData: sessionWithRelations.tailoredData,
              acceptedChanges: sessionWithRelations.acceptedChanges,
              chatMessages: sessionWithRelations.chatHistory,
            },
          });
        } else {
          // Session not found, clear the reference
          currentSessionStorage.clear();
          dispatch({ type: 'SET_RESTORING', payload: false });
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        currentSessionStorage.clear();
        dispatch({ type: 'SET_RESTORING', payload: false });
      }
    };

    restoreSession();
  }, []);

  const startNewSession = useCallback(async (
    resume: ParsedResume,
    resumeText: string,
    jobDescriptionContent: string,
    tailoredData: TailoredData,
    resumeName?: string
  ) => {
    const resumeId = generateId();
    const jobDescriptionId = generateId();
    const sessionId = generateId();

    // Create stored resume
    const storedResume: StoredResume = {
      id: resumeId,
      name: resumeName || 'Uploaded Resume',
      rawText: resumeText,
      parsedData: resume,
      uploadedAt: new Date().toISOString(),
    };

    // Create stored job description
    const storedJobDescription: StoredJobDescription = {
      id: jobDescriptionId,
      title: extractJobTitle(jobDescriptionContent),
      content: jobDescriptionContent,
      createdAt: new Date().toISOString(),
    };

    // Create initial chat message
    const initialMessage: ChatMessage = {
      id: 'initial',
      role: 'agent',
      content: buildInitialMessage(tailoredData),
      timestamp: new Date(),
    };

    // Create session
    const session: TailoringSession = {
      id: sessionId,
      resumeId,
      jobDescriptionId,
      tailoredData,
      acceptedChanges: { summary: true, experience: true, skills: true },
      chatHistory: [initialMessage],
      status: 'active',
      applicationStatus: 'none',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to IndexedDB
    await Promise.all([
      resumeDB.save(storedResume),
      jobDescriptionDB.save(storedJobDescription),
      sessionDB.save(session),
    ]);

    // Save current session ID to localStorage
    currentSessionStorage.set(sessionId);

    // Update state
    dispatch({
      type: 'START_SESSION',
      payload: {
        sessionId,
        resume,
        resumeText,
        jobDescription: jobDescriptionContent,
        tailoredData,
        chatMessages: [initialMessage],
      },
    });
  }, []);

  // Navigate to upload - optionally keep session in background
  const navigateToUpload = useCallback((keepSession: boolean = true) => {
    if (keepSession && state.currentSessionId) {
      // Just change view, keep session saved
      dispatch({ type: 'SET_VIEW', payload: 'upload' });
    } else {
      // Clear everything
      currentSessionStorage.clear();
      dispatch({ type: 'CLEAR_SESSION' });
    }
  }, [state.currentSessionId]);

  // Navigate to tracker view
  const navigateToTracker = useCallback(() => {
    dispatch({ type: 'SET_VIEW', payload: 'tracker' });
  }, []);

  // Resume an existing session
  const resumeSession = useCallback(async (sessionId: string): Promise<boolean> => {
    dispatch({ type: 'SET_RESTORING', payload: true });

    try {
      const sessionWithRelations = await sessionDB.getWithRelations(sessionId);
      if (sessionWithRelations) {
        currentSessionStorage.set(sessionId);
        dispatch({
          type: 'RESTORE_SESSION',
          payload: {
            sessionId: sessionWithRelations.id,
            resume: sessionWithRelations.resume.parsedData,
            resumeText: sessionWithRelations.resume.rawText,
            jobDescription: sessionWithRelations.jobDescription.content,
            tailoredData: sessionWithRelations.tailoredData,
            acceptedChanges: sessionWithRelations.acceptedChanges,
            chatMessages: sessionWithRelations.chatHistory,
          },
        });
        return true;
      }
    } catch (error) {
      console.error('Failed to resume session:', error);
    }

    dispatch({ type: 'SET_RESTORING', payload: false });
    return false;
  }, []);

  // Get list of saved sessions
  const getSavedSessions = useCallback(async (): Promise<SessionSummary[]> => {
    try {
      const sessionsWithRelations = await sessionDB.getAllWithRelations();
      return sessionsWithRelations.map((s) => ({
        id: s.id,
        resumeName: s.resume.name,
        jobTitle: s.jobDescription.title,
        jobCompany: s.jobDescription.company,
        status: s.status,
        applicationStatus: s.applicationStatus || 'none',
        appliedAt: s.appliedAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return [];
    }
  }, []);

  // Get list of saved resumes (with session counts)
  const getSavedResumes = useCallback(async (): Promise<SavedResumeSummary[]> => {
    try {
      const resumes = await resumeDB.getAll();
      const sessions = await sessionDB.getAll();

      return resumes.map((r) => ({
        id: r.id,
        name: r.name,
        uploadedAt: r.uploadedAt,
        sessionCount: sessions.filter((s) => s.resumeId === r.id).length,
      })).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    } catch (error) {
      console.error('Failed to get resumes:', error);
      return [];
    }
  }, []);

  // Get a resume by ID
  const getResumeById = useCallback(async (resumeId: string): Promise<StoredResume | null> => {
    try {
      return await resumeDB.get(resumeId);
    } catch (error) {
      console.error('Failed to get resume:', error);
      return null;
    }
  }, []);

  // Save a parsed resume to IndexedDB without creating a session
  const saveResumeOnly = useCallback(async (
    resume: ParsedResume,
    resumeText: string,
    fileName: string
  ): Promise<string> => {
    const resumeId = generateId();
    const storedResume: StoredResume = {
      id: resumeId,
      name: fileName,
      rawText: resumeText,
      parsedData: resume,
      uploadedAt: new Date().toISOString(),
    };
    await resumeDB.save(storedResume);
    return resumeId;
  }, []);

  // Start a new session with an existing resume (skip parsing)
  // If jobDescriptionId is provided, reuse that existing JD instead of creating a new one.
  const startSessionWithExistingResume = useCallback(async (
    resumeId: string,
    jobDescriptionContent: string,
    tailoredData: TailoredData,
    existingJobDescriptionId?: string
  ) => {
    const existingResume = await resumeDB.get(resumeId);
    if (!existingResume) {
      throw new Error('Resume not found');
    }

    const sessionId = generateId();
    let jobDescriptionId: string;

    if (existingJobDescriptionId) {
      // Reuse existing job description
      jobDescriptionId = existingJobDescriptionId;
    } else {
      // Create a new stored job description
      jobDescriptionId = generateId();
      const storedJobDescription: StoredJobDescription = {
        id: jobDescriptionId,
        title: extractJobTitle(jobDescriptionContent),
        content: jobDescriptionContent,
        createdAt: new Date().toISOString(),
      };
      await jobDescriptionDB.save(storedJobDescription);
    }

    // Create initial chat message
    const initialMessage: ChatMessage = {
      id: 'initial',
      role: 'agent',
      content: buildInitialMessage(tailoredData),
      timestamp: new Date(),
    };

    // Create session (reuses existing resume)
    const session: TailoringSession = {
      id: sessionId,
      resumeId: existingResume.id,
      jobDescriptionId,
      tailoredData,
      acceptedChanges: { summary: true, experience: true, skills: true },
      chatHistory: [initialMessage],
      status: 'active',
      applicationStatus: 'none',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save session to IndexedDB
    await sessionDB.save(session);

    // Save current session ID to localStorage
    currentSessionStorage.set(sessionId);

    // Update state
    dispatch({
      type: 'START_SESSION',
      payload: {
        sessionId,
        resume: existingResume.parsedData,
        resumeText: existingResume.rawText,
        jobDescription: jobDescriptionContent,
        tailoredData,
        chatMessages: [initialMessage],
      },
    });
  }, []);

  // Get a job description by ID
  const getJobDescriptionById = useCallback(async (id: string): Promise<StoredJobDescription | null> => {
    try {
      return await jobDescriptionDB.get(id);
    } catch (error) {
      console.error('Failed to get job description:', error);
      return null;
    }
  }, []);

  // Save a job description to IndexedDB without creating a session
  const saveJobDescriptionOnly = useCallback(async (
    title: string,
    content: string,
    url?: string,
    company?: string
  ): Promise<string> => {
    const id = generateId();
    const storedJD: StoredJobDescription = {
      id,
      title,
      content,
      url,
      company,
      createdAt: new Date().toISOString(),
    };
    await jobDescriptionDB.save(storedJD);
    return id;
  }, []);

  // Get list of saved job descriptions (with session counts)
  const getSavedJobDescriptions = useCallback(async (): Promise<SavedJobDescriptionSummary[]> => {
    try {
      const jobDescriptions = await jobDescriptionDB.getAll();
      const sessions = await sessionDB.getAll();

      return jobDescriptions.map((jd) => ({
        id: jd.id,
        title: jd.title,
        company: jd.company,
        url: jd.url,
        createdAt: jd.createdAt,
        sessionCount: sessions.filter((s) => s.jobDescriptionId === jd.id).length,
      })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Failed to get job descriptions:', error);
      return [];
    }
  }, []);

  // Delete a job description if not used by any session
  const deleteJobDescription = useCallback(async (id: string): Promise<void> => {
    try {
      const sessions = await sessionDB.getAll();
      const isUsed = sessions.some((s) => s.jobDescriptionId === id);
      if (isUsed) {
        throw new Error('Cannot delete job description that is used by a session');
      }
      await jobDescriptionDB.delete(id);
    } catch (error) {
      console.error('Failed to delete job description:', error);
      throw error;
    }
  }, []);

  // Update application status for a session
  const updateApplicationStatus = useCallback(async (
    sessionId: string,
    status: ApplicationStatus
  ): Promise<void> => {
    try {
      const session = await sessionDB.get(sessionId);
      if (!session) throw new Error('Session not found');

      const updatedSession: TailoringSession = {
        ...session,
        applicationStatus: status,
        appliedAt: status === 'applied' && !session.appliedAt
          ? new Date().toISOString()
          : session.appliedAt,
        updatedAt: new Date().toISOString(),
      };
      await sessionDB.save(updatedSession);
    } catch (error) {
      console.error('Failed to update application status:', error);
      throw error;
    }
  }, []);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    try {
      const session = await sessionDB.get(sessionId);
      if (session) {
        await sessionDB.delete(sessionId);
        // Also delete orphaned resume and job description if not used elsewhere
        const otherSessions = await sessionDB.getAll();
        const resumeUsed = otherSessions.some((s) => s.id !== sessionId && s.resumeId === session.resumeId);
        const jobUsed = otherSessions.some((s) => s.id !== sessionId && s.jobDescriptionId === session.jobDescriptionId);
        if (!resumeUsed) await resumeDB.delete(session.resumeId);
        if (!jobUsed) await jobDescriptionDB.delete(session.jobDescriptionId);
      }

      // If deleting current session, clear it
      if (state.currentSessionId === sessionId) {
        currentSessionStorage.clear();
        dispatch({ type: 'CLEAR_SESSION' });
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }, [state.currentSessionId]);

  // Export current session as JSON
  const exportSession = useCallback(async (): Promise<ExportedSession | null> => {
    if (!state.currentSessionId) return null;

    try {
      const session = await sessionDB.get(state.currentSessionId);
      if (!session) return null;

      const resume = await resumeDB.get(session.resumeId);
      const jobDescription = await jobDescriptionDB.get(session.jobDescriptionId);

      if (!resume || !jobDescription) return null;

      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        resume,
        jobDescription,
        session,
      };
    } catch (error) {
      console.error('Failed to export session:', error);
      return null;
    }
  }, [state.currentSessionId]);

  // Import a session from JSON
  const importSession = useCallback(async (data: ExportedSession): Promise<boolean> => {
    try {
      if (data.version !== 1) {
        console.error('Unsupported session version');
        return false;
      }

      // Generate new IDs to avoid conflicts
      const newResumeId = generateId();
      const newJobDescriptionId = generateId();
      const newSessionId = generateId();

      const newResume: StoredResume = {
        ...data.resume,
        id: newResumeId,
        uploadedAt: new Date().toISOString(),
      };

      const newJobDescription: StoredJobDescription = {
        ...data.jobDescription,
        id: newJobDescriptionId,
        createdAt: new Date().toISOString(),
      };

      const newSession: TailoringSession = {
        ...data.session,
        id: newSessionId,
        resumeId: newResumeId,
        jobDescriptionId: newJobDescriptionId,
        applicationStatus: data.session.applicationStatus || 'none',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await Promise.all([
        resumeDB.save(newResume),
        jobDescriptionDB.save(newJobDescription),
        sessionDB.save(newSession),
      ]);

      // Resume the imported session
      return await resumeSession(newSessionId);
    } catch (error) {
      console.error('Failed to import session:', error);
      return false;
    }
  }, [resumeSession]);

  const updateTailoredData = useCallback((tailoredData: TailoredData) => {
    dispatch({ type: 'SET_TAILORED_DATA', payload: tailoredData });
  }, []);

  const toggleAcceptedChange = useCallback((section: keyof AcceptedChanges) => {
    dispatch({ type: 'TOGGLE_ACCEPTED_CHANGE', payload: section });
  }, []);

  const setActiveSection = useCallback((section: string | null) => {
    dispatch({ type: 'SET_ACTIVE_SECTION', payload: section });
  }, []);

  const addChatMessage = useCallback((message: ChatMessage) => {
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: message });
  }, []);

  const setChatLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_CHAT_LOADING', payload: loading });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setExportError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_EXPORT_ERROR', payload: error });
  }, []);

  const setEditContext = useCallback((context: EditContext | null) => {
    dispatch({ type: 'SET_EDIT_CONTEXT', payload: context });
  }, []);

  // Apply edit from chat - uses the current edit context to update the correct content
  const applyEditFromChat = useCallback((newContent: string) => {
    if (!state.editContext || !state.tailoredData) return;

    const { sectionType, entryId, bulletIndex } = state.editContext;
    const newData = JSON.parse(JSON.stringify(state.tailoredData)) as TailoredData;

    if (sectionType === 'summary') {
      newData.summary.tailored = newContent;
    } else if (sectionType === 'skills') {
      newData.skills.tailored = newContent;
    } else if (sectionType === 'experience') {
      const job = newData.jobs.find((j: any) => j.id === entryId);
      if (job) {
        const bullet = job.bullets.find((b: any) => b.index === bulletIndex);
        if (bullet) bullet.tailored = newContent;
      }
    } else {
      const section = newData.sections.find((s: any) => s.sectionType === sectionType);
      if (section) {
        const entry = section.entries.find((e: any) => e.id === entryId);
        if (entry) {
          const bullet = entry.bullets.find((b: any) => b.index === bulletIndex);
          if (bullet) bullet.tailored = newContent;
        }
      }
    }

    dispatch({ type: 'SET_TAILORED_DATA', payload: newData });
    dispatch({ type: 'SET_EDIT_CONTEXT', payload: null });
  }, [state.editContext, state.tailoredData]);

  // Track an edit for undo functionality
  const trackEdit = useCallback((key: string, originalTailored: string) => {
    dispatch({ type: 'TRACK_EDIT', payload: { key, originalTailored } });
  }, []);

  // Undo an edit - restore the original tailored content
  const undoEdit = useCallback((key: string, currentValue: string) => {
    dispatch({ type: 'UNDO_EDIT', payload: { key, currentValue } });
  }, []);

  // Redo an edit - restore the edited content
  const redoEdit = useCallback((key: string) => {
    dispatch({ type: 'REDO_EDIT', payload: key });
  }, []);

  // Check if undo is available for a key (has entry and not already undone)
  const canUndo = useCallback((key: string) => {
    const entry = state.editHistory.get(key);
    return entry !== undefined && !entry.isUndone;
  }, [state.editHistory]);

  // Check if redo is available for a key (has entry and is undone)
  const canRedo = useCallback((key: string) => {
    const entry = state.editHistory.get(key);
    return entry !== undefined && entry.isUndone === true;
  }, [state.editHistory]);

  const hasActiveSession = state.currentSessionId !== null && state.tailoredData !== null;

  const value: AppContextValue = {
    state,
    dispatch,
    startNewSession,
    startSessionWithExistingResume,
    navigateToUpload,
    navigateToTracker,
    resumeSession,
    getSavedSessions,
    getSavedResumes,
    getSavedJobDescriptions,
    getResumeById,
    getJobDescriptionById,
    saveResumeOnly,
    saveJobDescriptionOnly,
    deleteJobDescription,
    deleteSession,
    updateApplicationStatus,
    exportSession,
    importSession,
    updateTailoredData,
    toggleAcceptedChange,
    setActiveSection,
    addChatMessage,
    setChatLoading,
    setLoading,
    setExportError,
    setEditContext,
    applyEditFromChat,
    trackEdit,
    undoEdit,
    redoEdit,
    canUndo,
    canRedo,
    hasActiveSession,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
