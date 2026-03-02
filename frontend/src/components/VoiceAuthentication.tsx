import { useRef, useState } from "react";
import {
  RotateCcw, Shield, Search, CheckCircle2, AlertTriangle,
  Loader2, Fingerprint, Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import AudioUploader from "./AudioUploader";
import AnalysisResult from "./AnalysisResult";
import QuickTip from "./QuickTip";
import { voiceAPI } from "@/services/api";
import { useVoiceStudio } from "@/hooks/useVoiceStudio";

// ── Stage labels ──────────────────────────────────────────────────────────────
const ANALYSIS_STAGES = [
  "Extracting audio features...",
  "Analyzing spectral patterns...",
  "Checking watermarks...",
  "Comparing voice signatures...",
  "Determining authenticity...",
];

// ── Scanning animation shown during analysis ──────────────────────────────────
const ScanningOverlay = ({
  stage,
  stageIndex,
  total,
}: {
  stage: string;
  stageIndex: number;
  total: number;
}) => (
  <div className="flex flex-col items-center justify-center py-12 animate-fade-in-up">
    {/* Shield with scanning line */}
    <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
      {/* Rotating outer ring */}
      <div
        className="absolute inset-0 rounded-full animate-spin-slow"
        style={{
          background:
            "conic-gradient(from 0deg, hsl(var(--primary)) 0%, transparent 60%, hsl(var(--secondary)) 100%)",
          WebkitMask:
            "radial-gradient(farthest-side, transparent 62%, black 63%)",
          mask: "radial-gradient(farthest-side, transparent 62%, black 63%)",
        }}
      />
      {/* Pulsing inner circle */}
      <div className="absolute inset-4 rounded-full bg-primary/10 border border-primary/20 animate-pulse" />
      {/* Icon */}
      <div className="relative z-10 w-12 h-12 rounded-full gradient-bg flex items-center justify-center glow">
        <Fingerprint className="w-6 h-6 text-foreground" />
      </div>
    </div>

    <p className="text-sm font-semibold text-foreground mb-1">{stage}</p>
    <p className="text-xs text-muted-foreground mb-6">
      Step {stageIndex + 1} of {total}
    </p>

    {/* Segmented bar */}
    <div className="flex gap-1.5 w-48">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-500 ${
            i < stageIndex
              ? "gradient-bg"
              : i === stageIndex
              ? "gradient-bg opacity-50 animate-pulse"
              : "bg-muted/30"
          }`}
        />
      ))}
    </div>
  </div>
);

// ── How it works info cards ───────────────────────────────────────────────────
const InfoCards = () => (
  <div className="grid sm:grid-cols-2 gap-4 mt-8">
    <div className="glass-card p-5 group hover:border-success/20 transition-colors duration-300">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-success/15 border border-success/20 flex items-center justify-center group-hover:bg-success/20 transition-colors">
          <CheckCircle2 className="w-4 h-4 text-success" />
        </div>
        <h4 className="font-semibold text-sm text-foreground">Original Voice</h4>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Authentic recordings show natural micro-variations in pitch, tone, and
        breath that AI models cannot perfectly replicate.
      </p>
    </div>
    <div className="glass-card p-5 group hover:border-warning/20 transition-colors duration-300">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-warning/15 border border-warning/20 flex items-center justify-center group-hover:bg-warning/20 transition-colors">
          <AlertTriangle className="w-4 h-4 text-warning" />
        </div>
        <h4 className="font-semibold text-sm text-foreground">Synthetic Voice</h4>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        AI-generated audio carries embedded AudioSeal watermarks and subtle
        spectral patterns our detector identifies with high confidence.
      </p>
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const VoiceAuthentication = () => {
  const { authentication, setAuthentication, resetAuthentication } = useVoiceStudio();
  const { toast } = useToast();

  const [audioFile, setAudioFile]     = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stageIndex, setStageIndex]   = useState(0);
  const currentObjectUrlRef = useRef<string | null>(null);
  const stageTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFileSelect = (file: File | null) => {
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    setAudioFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      currentObjectUrlRef.current = url;
      setAuthentication({ audioFileUrl: url, audioFileName: file.name, result: null });
    } else {
      setAuthentication({ audioFileUrl: null, audioFileName: null, result: null });
    }
  };

  const handleAnalyze = async () => {
    if (!audioFile) return;
    setIsAnalyzing(true);
    setStageIndex(0);
    setAuthentication({ result: null });

    // Cycle through stage labels
    stageTimerRef.current = setInterval(() => {
      setStageIndex((prev) =>
        prev < ANALYSIS_STAGES.length - 1 ? prev + 1 : prev,
      );
    }, 2000);

    try {
      const response = await voiceAPI.authenticateVoice(audioFile);
      setAuthentication({
        result: { isOriginal: response.is_original, confidence: response.confidence },
      });
      toast({
        title: "Analysis Complete",
        description: response.is_original
          ? "Voice appears to be original"
          : "Voice appears to be AI-generated",
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      setIsAnalyzing(false);
      setStageIndex(0);
    }
  };

  const handleReset = () => {
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    setAudioFile(null);
    resetAuthentication();
  };

  const isRestoredSession = !audioFile && !!authentication.audioFileName;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">

      {/* ── Main card ──────────────────────────────────────────────────────── */}
      <div className="glass-card p-8">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          {/* Icon */}
          <div className="relative mb-5">
            <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center glow animate-pulse-glow">
              <Shield className="w-7 h-7 text-foreground" />
            </div>
            {/* Corner sparkle */}
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-secondary/30 border border-secondary/40 flex items-center justify-center">
              <Waves className="w-3 h-3 text-secondary" />
            </div>
          </div>

          <h2 className="text-2xl font-bold gradient-text mb-2">Voice Authentication</h2>
          <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
            Detect whether an audio clip is an authentic human voice or
            AI-generated — with confidence scoring and watermark analysis.
          </p>

          {/* Divider */}
          <div className="flex items-center gap-2 mt-5 w-full max-w-xs">
            <div className="flex-1 h-px bg-white/5" />
            <Fingerprint className="w-3.5 h-3.5 text-muted-foreground/30" />
            <div className="flex-1 h-px bg-white/5" />
          </div>
        </div>

        {/* ── Upload + Analyze ─────────────────────────────────────────────── */}
        {!authentication.result && !isAnalyzing && (
          <div className="space-y-5 animate-fade-in-up">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Upload Audio for Analysis
                </h3>
                <QuickTip tip="Best results with 5–60 second clips. Uncompressed WAV or high-quality MP3 yields more accurate detection." />
              </div>
              <AudioUploader
                file={audioFile}
                onFileSelect={handleFileSelect}
                inputId="audio-upload-authentication"
                label={
                  isRestoredSession
                    ? `Re-upload "${authentication.audioFileName}"`
                    : "Upload audio to verify"
                }
              />
              {isRestoredSession && (
                <p className="mt-2.5 text-xs text-warning/70 text-center">
                  Previous file{" "}
                  <span className="font-medium">{authentication.audioFileName}</span>{" "}
                  — re-upload to analyze again.
                </p>
              )}
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!audioFile}
              className="w-full h-14 text-base font-semibold gradient-bg hover:opacity-90 transition-all glow disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Search className="w-4 h-4 mr-2" />
              Analyze Voice
            </Button>
          </div>
        )}

        {/* ── Scanning animation ───────────────────────────────────────────── */}
        {isAnalyzing && (
          <ScanningOverlay
            stage={ANALYSIS_STAGES[stageIndex]}
            stageIndex={stageIndex}
            total={ANALYSIS_STAGES.length}
          />
        )}

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {authentication.result && !isAnalyzing && (
          <div className="animate-scale-in">
            <AnalysisResult
              isOriginal={authentication.result.isOriginal}
              confidence={authentication.result.confidence}
            />
            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full mt-6 h-11 border-white/10 hover:bg-muted/30 text-sm"
            >
              Analyze Another Audio
            </Button>
          </div>
        )}

        {/* ── Reset — always available when not scanning ───────────────────── */}
        {!isAnalyzing && (
          <Button
            variant="ghost"
            onClick={handleReset}
            className="w-full mt-3 h-9 text-muted-foreground hover:text-foreground text-xs transition-all"
          >
            <RotateCcw className="w-3 h-3 mr-1.5" />
            Reset Authentication
          </Button>
        )}
      </div>

      {/* ── Info cards ─────────────────────────────────────────────────────── */}
      <InfoCards />
    </div>
  );
};

export default VoiceAuthentication;
