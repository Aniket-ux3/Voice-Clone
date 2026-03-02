import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceGenerationState {
  audioFileUrl: string | null;
  audioFileName: string | null;
  text: string;
  emotion: string;
  generatedAudioUrl: string | null;
  audioId: string | null;
}

export interface VoiceAuthenticationState {
  audioFileUrl: string | null;
  audioFileName: string | null;
  result: {
    isOriginal: boolean;
    confidence: number;
  } | null;
}

interface VoiceStudioContextType {
  generation: VoiceGenerationState;
  authentication: VoiceAuthenticationState;

  setGeneration: (data: Partial<VoiceGenerationState>) => void;
  setAuthentication: (data: Partial<VoiceAuthenticationState>) => void;

  resetGeneration: () => void;
  resetAuthentication: () => void;
  clearAll: () => void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_GENERATION: VoiceGenerationState = {
  audioFileUrl: null,
  audioFileName: null,
  text: "",
  emotion: "neutral",
  generatedAudioUrl: null,
  audioId: null,
};

const DEFAULT_AUTHENTICATION: VoiceAuthenticationState = {
  audioFileUrl: null,
  audioFileName: null,
  result: null,
};

const SESSION_KEY = "voice_studio_session";

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface PersistedState {
  generation: VoiceGenerationState;
  authentication: VoiceAuthenticationState;
}

function loadFromSession(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function saveToSession(state: PersistedState): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage quota exceeded or unavailable — fail silently
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const VoiceStudioContext = createContext<VoiceStudioContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const VoiceStudioProvider = ({ children }: { children: ReactNode }) => {
  // Initialise from sessionStorage on first mount
  const [generation, setGenerationState] = useState<VoiceGenerationState>(() => {
    const saved = loadFromSession();
    return saved?.generation ?? DEFAULT_GENERATION;
  });

  const [authentication, setAuthenticationState] =
    useState<VoiceAuthenticationState>(() => {
      const saved = loadFromSession();
      return saved?.authentication ?? DEFAULT_AUTHENTICATION;
    });

  // Sync every state change back to sessionStorage
  useEffect(() => {
    saveToSession({ generation, authentication });
  }, [generation, authentication]);

  // ── Setters ─────────────────────────────────────────────────────────────────

  const setGeneration = useCallback((data: Partial<VoiceGenerationState>) => {
    setGenerationState((prev) => ({ ...prev, ...data }));
  }, []);

  const setAuthentication = useCallback(
    (data: Partial<VoiceAuthenticationState>) => {
      setAuthenticationState((prev) => ({ ...prev, ...data }));
    },
    [],
  );

  // ── Resets ──────────────────────────────────────────────────────────────────

  const resetGeneration = useCallback(() => {
    setGenerationState(DEFAULT_GENERATION);
    // sessionStorage is kept; the useEffect above will overwrite generation slice
  }, []);

  const resetAuthentication = useCallback(() => {
    setAuthenticationState(DEFAULT_AUTHENTICATION);
  }, []);

  const clearAll = useCallback(() => {
    setGenerationState(DEFAULT_GENERATION);
    setAuthenticationState(DEFAULT_AUTHENTICATION);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  // ── Value ───────────────────────────────────────────────────────────────────

  const value: VoiceStudioContextType = {
    generation,
    authentication,
    setGeneration,
    setAuthentication,
    resetGeneration,
    resetAuthentication,
    clearAll,
  };

  return (
    <VoiceStudioContext.Provider value={value}>
      {children}
    </VoiceStudioContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useVoiceStudio = (): VoiceStudioContextType => {
  const ctx = useContext(VoiceStudioContext);
  if (!ctx) {
    throw new Error("useVoiceStudio must be used inside <VoiceStudioProvider>");
  }
  return ctx;
};
