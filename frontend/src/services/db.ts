import { StoredResume, StoredJobDescription, TailoringSession, SessionWithRelations } from '../types/storage';

const DB_NAME = 'resume-tailor-db';
const DB_VERSION = 2;

const STORES = {
  RESUMES: 'resumes',
  JOB_DESCRIPTIONS: 'jobDescriptions',
  SESSIONS: 'sessions',
} as const;

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      // On upgrade from v1→v2, wipe all stores (schema changed)
      if (oldVersion < 2) {
        for (const name of Array.from(db.objectStoreNames)) {
          db.deleteObjectStore(name);
        }
      }

      // Create fresh stores
      if (!db.objectStoreNames.contains(STORES.RESUMES)) {
        db.createObjectStore(STORES.RESUMES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.JOB_DESCRIPTIONS)) {
        db.createObjectStore(STORES.JOB_DESCRIPTIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
        const sessionsStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
        sessionsStore.createIndex('resumeId', 'resumeId', { unique: false });
        sessionsStore.createIndex('jobDescriptionId', 'jobDescriptionId', { unique: false });
        sessionsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

// Generic helpers
async function getFromStore<T>(storeName: string, id: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onerror = () => reject(new Error(`Failed to get item from ${storeName}`));
    request.onsuccess = () => resolve(request.result || null);
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(new Error(`Failed to get all items from ${storeName}`));
    request.onsuccess = () => resolve(request.result || []);
  });
}

async function putInStore<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onerror = () => reject(new Error(`Failed to put item in ${storeName}`));
    request.onsuccess = () => resolve();
  });
}

async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onerror = () => reject(new Error(`Failed to delete item from ${storeName}`));
    request.onsuccess = () => resolve();
  });
}

// Resume operations
export const resumeDB = {
  get: (id: string) => getFromStore<StoredResume>(STORES.RESUMES, id),
  getAll: () => getAllFromStore<StoredResume>(STORES.RESUMES),
  save: (resume: StoredResume) => putInStore(STORES.RESUMES, resume),
  delete: (id: string) => deleteFromStore(STORES.RESUMES, id),
};

// Job Description operations
export const jobDescriptionDB = {
  get: (id: string) => getFromStore<StoredJobDescription>(STORES.JOB_DESCRIPTIONS, id),
  getAll: () => getAllFromStore<StoredJobDescription>(STORES.JOB_DESCRIPTIONS),
  save: (jobDescription: StoredJobDescription) => putInStore(STORES.JOB_DESCRIPTIONS, jobDescription),
  delete: (id: string) => deleteFromStore(STORES.JOB_DESCRIPTIONS, id),
};

// Session operations
export const sessionDB = {
  get: (id: string) => getFromStore<TailoringSession>(STORES.SESSIONS, id),
  getAll: () => getAllFromStore<TailoringSession>(STORES.SESSIONS),
  save: (session: TailoringSession) => putInStore(STORES.SESSIONS, session),
  delete: (id: string) => deleteFromStore(STORES.SESSIONS, id),

  async getByResumeId(resumeId: string): Promise<TailoringSession[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.SESSIONS, 'readonly');
      const store = transaction.objectStore(STORES.SESSIONS);
      const index = store.index('resumeId');
      const request = index.getAll(resumeId);

      request.onerror = () => reject(new Error('Failed to get sessions by resumeId'));
      request.onsuccess = () => resolve(request.result || []);
    });
  },

  async getWithRelations(id: string): Promise<SessionWithRelations | null> {
    const session = await sessionDB.get(id);
    if (!session) return null;

    const [resume, jobDescription] = await Promise.all([
      resumeDB.get(session.resumeId),
      jobDescriptionDB.get(session.jobDescriptionId),
    ]);

    if (!resume || !jobDescription) return null;

    return {
      ...session,
      resume,
      jobDescription,
    };
  },

  async getAllWithRelations(): Promise<SessionWithRelations[]> {
    const sessions = await sessionDB.getAll();
    const results: SessionWithRelations[] = [];

    for (const session of sessions) {
      const [resume, jobDescription] = await Promise.all([
        resumeDB.get(session.resumeId),
        jobDescriptionDB.get(session.jobDescriptionId),
      ]);

      if (resume && jobDescription) {
        results.push({
          ...session,
          resume,
          jobDescription,
        });
      }
    }

    // Sort by updatedAt descending
    return results.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },
};

// Current session ID in localStorage
const CURRENT_SESSION_KEY = 'currentSessionId';

export const currentSessionStorage = {
  get: (): string | null => localStorage.getItem(CURRENT_SESSION_KEY),
  set: (id: string) => localStorage.setItem(CURRENT_SESSION_KEY, id),
  clear: () => localStorage.removeItem(CURRENT_SESSION_KEY),
};

// Initialize database on module load
openDB().catch(console.error);
