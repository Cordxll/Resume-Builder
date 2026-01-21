import axios from 'axios';
import { ParsedResume, TailoredData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = {
  async parseResume(file?: File, text?: string): Promise<ParsedResume> {
    const formData = new FormData();
    
    if (file) {
      formData.append('file', file);
    }
    if (text) {
      formData.append('text', text);
    }
    
    const response = await axios.post(`${API_BASE_URL}/api/parse-resume`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  async tailorResume(resumeText: string, jobDescription: string): Promise<TailoredData> {
    const response = await axios.post(`${API_BASE_URL}/api/tailor-resume`, {
      resume_text: resumeText,
      job_description: jobDescription,
    });
    
    return response.data;
  },

  async exportDocx(
    originalSections: any,
    tailoredSections: any,
    acceptedChanges: any
  ): Promise<Blob> {
    const response = await axios.post(
      `${API_BASE_URL}/api/export-docx`,
      {
        original_sections: originalSections,
        tailored_sections: tailoredSections,
        accepted_changes: acceptedChanges,
      },
      {
        responseType: 'blob',
      }
    );
    
    return response.data;
  },
};
