import axios from 'axios';
import { AcceptedChanges, ParsedResume, TailoredData, ChatMessage } from '../types';
import { getStoredApiKey, setServerApiKeyStatus } from './storage';
import { usageTracker } from './usageTracker';
import { validateParsedResume, validateTailoredData } from '../utils/validateApiResponse';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Helper to get headers with API key if available
const getHeaders = () => {
  const apiKey = getStoredApiKey();
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['X-OpenAI-API-Key'] = apiKey;
  }
  return headers;
};

export const api = {
  async parseResume(file?: File, text?: string): Promise<ParsedResume> {
    const formData = new FormData();

    if (file) {
      formData.append('file', file);
    }
    if (text) {
      formData.append('text', text);
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/parse-resume`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getHeaders(),
        },
      });

      usageTracker.trackCall('parse-resume', true);

      // Validate the raw response before any normalization so guards are reachable.
      const raw = response.data;
      validateParsedResume(raw, 'parse-resume');

      // Map the backend response to the ParsedResume interface.
      // Guard against the response being nested: { sections: { contact, sections[], raw_text } }
      const parsed =
        Array.isArray(raw.sections) ? raw
        : (raw.sections && typeof raw.sections === 'object' ? raw.sections : raw);

      return {
        contact: parsed.contact,
        sections: Array.isArray(parsed.sections) ? parsed.sections : [],
        raw_text: parsed.raw_text || raw.raw_text,
      };
    } catch (error) {
      usageTracker.trackCall('parse-resume', false);
      throw error;
    }
  },

  async tailorResume(resumeText: string, jobDescription: string): Promise<TailoredData> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/tailor-resume`,
        {
          resume_text: resumeText,
          job_description: jobDescription,
        },
        {
          headers: getHeaders(),
        }
      );

      usageTracker.trackCall('tailor-resume', true);
      return validateTailoredData(response.data);
    } catch (error) {
      usageTracker.trackCall('tailor-resume', false);
      throw error;
    }
  },

  async exportDocx(
    resume: ParsedResume,
    tailoredData: TailoredData,
    acceptedChanges: AcceptedChanges
  ): Promise<Blob> {
    const response = await axios.post(
      `${API_BASE_URL}/api/export-docx`,
      {
        resume,
        tailored_data: tailoredData,
        accepted_changes: acceptedChanges,
      },
      {
        responseType: 'blob',
      }
    );

    return response.data;
  },

  async sendChatMessage(
    message: string,
    resumeText: string,
    jobDescription: string,
    tailoredData?: TailoredData | null,
    chatHistory?: ChatMessage[]
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/chat`,
        {
          message,
          resume_text: resumeText,
          job_description: jobDescription,
          tailored_data: tailoredData || undefined,
          chat_history: chatHistory?.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
        },
        {
          headers: getHeaders(),
        }
      );

      usageTracker.trackCall('chat', true);
      return response.data.response;
    } catch (error) {
      usageTracker.trackCall('chat', false);
      throw error;
    }
  },

  async scrapeJob(url: string): Promise<{ text: string; title?: string; company?: string }> {
    const response = await axios.post(
      `${API_BASE_URL}/api/scrape-job`,
      { url },
      { headers: getHeaders() }
    );
    return response.data;
  },

  async getConfig(): Promise<{ hasServerApiKey: boolean }> {
    const response = await axios.get(`${API_BASE_URL}/api/config`);
    // Update local storage with server key status
    setServerApiKeyStatus(response.data.hasServerApiKey);
    return response.data;
  },

  async checkHealth(): Promise<{ connected: boolean; error?: string }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/health`, {
        headers: getHeaders(),
      });
      if (response.data.connected) {
        usageTracker.trackCall('health', true);
      }
      return response.data;
    } catch {
      return { connected: false, error: 'Cannot reach server' };
    }
  },
};
