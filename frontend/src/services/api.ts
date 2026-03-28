// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7860/api';

export interface GenerateVoiceRequest {
  audio: File;
  text: string;
  emotion?: string;
}

export interface GenerateVoiceResponse {
  success: boolean;
  audio_id: string;
  message: string;
}

export interface AuthenticateVoiceResponse {
  success: boolean;
  is_original: boolean;
  confidence: number;
  probability: number;
}

export interface Emotion {
  id: string;
  label: string;
}

class VoiceAPIService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if the API server is healthy
   */
  async healthCheck(): Promise<{ status: string; device: string; models_loaded: boolean }> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error('API server is not responding');
    }
    return response.json();
  }

  /**
   * Generate synthetic voice from reference audio and text
   */
  async generateVoice(request: GenerateVoiceRequest): Promise<GenerateVoiceResponse> {
    const formData = new FormData();
    formData.append('audio', request.audio);
    formData.append('text', request.text);
    if (request.emotion) {
      formData.append('emotion', request.emotion);
    }

    const response = await fetch(`${this.baseUrl}/generate`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `Server error (${response.status})`;
      try {
        const text = await response.text();
        if (text) {
          const error = JSON.parse(text);
          errorMessage = error.error || errorMessage;
        }
      } catch {
        // non-JSON error body (e.g. HTML traceback in Flask debug mode)
      }
      throw new Error(errorMessage);
    }

    const responseText = await response.text();
    if (!responseText) {
      throw new Error('Server returned an empty response');
    }
    return JSON.parse(responseText);
  }

  /**
   * Get the download URL for a generated audio file
   */
  getDownloadUrl(audioId: string): string {
    return `${this.baseUrl}/download/${audioId}`;
  }

  /**
   * Download generated audio file
   */
  async downloadAudio(audioId: string): Promise<Blob> {
    const response = await fetch(this.getDownloadUrl(audioId));
    
    if (!response.ok) {
      throw new Error('Failed to download audio');
    }

    return response.blob();
  }

  /**
   * Authenticate whether audio is AI-generated or original
   */
  async authenticateVoice(audioFile: File): Promise<AuthenticateVoiceResponse> {
    const formData = new FormData();
    formData.append('audio', audioFile);

    const response = await fetch(`${this.baseUrl}/authenticate`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `Server error (${response.status})`;
      try {
        const text = await response.text();
        if (text) {
          const error = JSON.parse(text);
          errorMessage = error.error || errorMessage;
        }
      } catch {
        // non-JSON error body
      }
      throw new Error(errorMessage);
    }

    const responseText = await response.text();
    if (!responseText) {
      throw new Error('Server returned an empty response');
    }
    return JSON.parse(responseText);
  }

  /**
   * Get available emotion styles
   */
  async getEmotions(): Promise<Emotion[]> {
    const response = await fetch(`${this.baseUrl}/emotions`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch emotions');
    }

    return response.json();
  }
}

// Export singleton instance
export const voiceAPI = new VoiceAPIService();

// Export class for testing
export default VoiceAPIService;
