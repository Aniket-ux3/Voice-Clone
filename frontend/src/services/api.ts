// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7860/api';

// ── Request timeout (ms) ──────────────────────────────────────────────────────
const GENERATE_TIMEOUT_MS = 300_000; // 5 min — CPU voice generation can take 3+ min
const ANALYZE_TIMEOUT_MS  = 120_000; // 2 min — auth analysis is faster
const DEFAULT_TIMEOUT_MS  =  15_000; // 15 s  — health check / emotions / download

// ── User-friendly error mapping ───────────────────────────────────────────────
// Maps raw backend/network error fragments → clean messages shown to the user.
// Patterns are tested in order; the first match wins.
// Keep in sync with _BACKEND_ERROR_MAP in api_server.py.
const ERROR_MAP: Array<[RegExp, string]> = [
  // ── Domain errors (match backend safe_error messages) ──
  [/could not extract voice features/i,        "Could not extract voice features. Please upload a clearer audio sample (10–30 s of speech works best)."],
  [/speaker extraction failed/i,               "Could not extract voice features. Please upload a clearer audio sample (10–30 s of speech works best)."],
  [/audio.*too short|too short.*audio/i,       "The audio clip is too short. Please upload at least 5 seconds of clear speech."],
  [/no speech.*detected|no audio segments/i,  "No speech was detected. Try a recording with clear, continuous speech."],
  [/tts generation failed|failed to synthesize/i, "Failed to synthesize speech. Please try a shorter script (under 200 characters)."],
  [/voice conversion.*failed/i,                "Voice conversion encountered an error. Try re-uploading the reference audio."],
  [/audio post-processing failed|denoising failed/i, "Audio post-processing failed. The voice has been generated but could not be cleaned up."],
  [/watermark/i,                               "Watermark processing failed, but your audio may still be usable — try downloading it."],
  [/ai models are still|model loading failed/i, "The AI models are still loading. Please wait a moment and try again."],
  [/could not read the uploaded|failed to preprocess/i, "Could not read the uploaded audio file. Please try a WAV or MP3 under 50 MB."],
  [/ran out of memory|out of memory/i,         "The server ran out of memory. Please try a shorter script or smaller audio file."],
  [/gpu error|cuda/i,                          "A GPU error occurred. The server is retrying on CPU — please try again in a moment."],
  // ── HTTP status errors ──
  [/server error \(429\)/i,                    "Too many requests. Please wait a few seconds before trying again."],
  [/server error \(5\d\d\)/i,                  "The server encountered an unexpected error. Please try again in a moment."],
  [/server error \(4\d\d\)/i,                  "Request was rejected by the server. Please check your inputs and try again."],
  // ── Network / transport errors ──
  [/api server is not responding/i,            "Cannot reach the server. Check your connection or try again shortly."],
  [/failed to fetch/i,                         "Network error — cannot reach the server. Check your internet connection."],
  [/networkerror/i,                            "Network error — cannot reach the server. Check your internet connection."],
  [/timeout|timed out/i,                       "The request timed out. Voice generation on CPU can take 1–3 minutes — please try again."],
  [/empty response/i,                          "The server returned an empty response. Please try again."],
];

function friendlyError(raw: string): string {
  for (const [pattern, message] of ERROR_MAP) {
    if (pattern.test(raw)) return message;
  }
  // Strip anything that looks like a Python traceback or internal path
  if (/traceback|exception|file "\/|line \d+/i.test(raw)) {
    return "An internal server error occurred. Please try again.";
  }
  // If the raw message is short and doesn't look like a crash dump, show it
  if (raw.length < 150 && !/[<>{}\n]/.test(raw)) return raw;
  return "Something went wrong. Please try again.";
}

// ── Timeout-aware fetch ───────────────────────────────────────────────────────
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Voice generation on CPU can take 1–3 minutes — please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Parse error from a non-ok response ───────────────────────────────────────
async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (text) {
      try {
        const json = JSON.parse(text);
        return friendlyError(json.error || json.message || `Server error (${response.status})`);
      } catch {
        // HTML or plain-text body — strip tags
        const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return friendlyError(stripped || `Server error (${response.status})`);
      }
    }
  } catch {
    // body unreadable
  }
  return friendlyError(`Server error (${response.status})`);
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

export interface HealthCheckResponse {
  status: string;
  /** "cuda" or "cpu" — used to show CPU mode notice in the UI */
  device: "cuda" | "cpu" | string;
  models_loaded: boolean;
}

export interface Emotion {
  id: string;
  label: string;
}

// ── Service class ─────────────────────────────────────────────────────────────
class VoiceAPIService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/health`,
        {},
        DEFAULT_TIMEOUT_MS,
      );
      if (!response.ok) throw new Error('API server is not responding');
      return response.json();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cannot reach the server';
      throw new Error(friendlyError(msg));
    }
  }

  async generateVoice(request: GenerateVoiceRequest): Promise<GenerateVoiceResponse> {
    const formData = new FormData();
    formData.append('audio', request.audio);
    formData.append('text', request.text);
    if (request.emotion) formData.append('emotion', request.emotion);

    let response: Response;
    try {
      response = await fetchWithTimeout(
        `${this.baseUrl}/generate`,
        { method: 'POST', body: formData },
        GENERATE_TIMEOUT_MS,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      throw new Error(friendlyError(msg));
    }

    if (!response.ok) {
      const message = await extractErrorMessage(response);
      throw new Error(message);
    }

    try {
      const text = await response.text();
      if (!text) throw new Error('empty response');
      return JSON.parse(text);
    } catch {
      throw new Error(friendlyError('empty response'));
    }
  }

  getDownloadUrl(audioId: string): string {
    return `${this.baseUrl}/download/${audioId}`;
  }

  async downloadAudio(audioId: string): Promise<Blob> {
    let response: Response;
    try {
      response = await fetchWithTimeout(
        this.getDownloadUrl(audioId),
        {},
        DEFAULT_TIMEOUT_MS,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      throw new Error(friendlyError(msg));
    }
    if (!response.ok) throw new Error('Failed to download audio. The file may have expired.');
    return response.blob();
  }

  async authenticateVoice(audioFile: File): Promise<AuthenticateVoiceResponse> {
    const formData = new FormData();
    formData.append('audio', audioFile);

    let response: Response;
    try {
      response = await fetchWithTimeout(
        `${this.baseUrl}/authenticate`,
        { method: 'POST', body: formData },
        ANALYZE_TIMEOUT_MS,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      throw new Error(friendlyError(msg));
    }

    if (!response.ok) {
      const message = await extractErrorMessage(response);
      throw new Error(message);
    }

    try {
      const text = await response.text();
      if (!text) throw new Error('empty response');
      return JSON.parse(text);
    } catch {
      throw new Error(friendlyError('empty response'));
    }
  }

  async getEmotions(): Promise<Emotion[]> {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/emotions`,
        {},
        DEFAULT_TIMEOUT_MS,
      );
      if (!response.ok) throw new Error('Failed to fetch emotions');
      return response.json();
    } catch {
      // Non-critical — return hardcoded fallback silently
      return [
        { id: 'neutral',  label: '😐 Neutral'  },
        { id: 'happy',    label: '😊 Happy'    },
        { id: 'sad',      label: '😢 Sad'      },
        { id: 'angry',    label: '😠 Angry'    },
        { id: 'jolly',    label: '🎉 Jolly'    },
        { id: 'anxious',  label: '😰 Anxious'  },
      ];
    }
  }
}

export const voiceAPI = new VoiceAPIService();
export default VoiceAPIService;
