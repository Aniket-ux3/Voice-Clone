import { useRef, useState } from "react";
import {
  RotateCcw, Shield, Search, CheckCircle2, AlertTriangle,
  Fingerprint, Waves, AlertCircle, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import AudioUploader from "./AudioUploader";
import AnalysisResult from "./AnalysisResult";
import QuickTip from "./QuickTip";
import { voiceAPI } from "@/services/api";
import { useVoiceStudio } from "@/hooks/useVoiceStudio";

const ANALYSIS_STAGES = [
  "Extracting audio features...",
  "Analyzing spectral patterns...",
  "Checking watermarks...",
  "Comparing voice signatures...",
  "Determining authenticity...",
];

const LONG_WAIT_MESSAGES = [
  "Still analyzing — CPU inference takes a bit longer.",
  "Scanning watermark patterns — almost done.",
  "Processing on CPU — this is normal.",
];

const LONG_WAIT_THRESHOLD_MS = 20_000;

const ScanningOverlay = ({ stage, stageIndex, total, longWaitMessage }: {
  stage: string; stageIndex: number; total: number; longWaitMessage?: string;
}) => (
  <div className="flex flex-col items-center justify-center py-8 sm:py-12 animate-fade-in-up">
    <div className="relative w-20 h-20 sm:w-28 sm:h-28 mb-6 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full animate-spin-slow"
        style={{ background: "conic-gradient(from 0deg, hsl(var(--primary)) 0%, transparent 60%, hsl(var(--secondary)) 100%)", WebkitMask: "radial-gradient(farthest-side, transparent 62%, black 63%)", mask: "radial-gradient(farthest-side, transparent 62%, black 63%)" }} />
      <div className="absolute inset-4 rounded-full bg-primary/10 border border-primary/20 animate-pulse" />
      <div className="relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full gradient-bg flex items-center justify-center glow">
        <Fingerprint className="w-5 h-5 sm:w-6 sm:h-6 text-foreground" />
      </div>
    </div>
    <p className="text-sm font-semibold text-foreground mb-1 text-center px-4">{stage}</p>
    <p className="text-xs text-muted-foreground mb-5">Step {stageIndex + 1} of {total}</p>
    <div className="flex gap-1.5 w-40 sm:w-48">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i < stageIndex ? "gradient-bg" : i === stageIndex ? "gradient-bg opacity-50 animate-pulse" : "bg-muted/30"}`} />
      ))}
    </div>
    {longWaitMessage && (
      <div className="mt-5 px-4 py-2.5 rounded-xl bg-primary/8 border border-primary/20 max-w-[260px] animate-fade-in-up">
        <div className="flex items-start gap-2">
          <Cpu className="w-3.5 h-3.5 text-primary/80 shrink-0 mt-0.5" />
          <p className="text-xs text-primary/90 leading-relaxed">{longWaitMessage}</p>
        </div>
      </div>
    )}
  </div>
);

const InfoCards = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-6 sm:mt-8">
    {[
      {
        icon: CheckCircle2, iconCls: "text-success", bgCls: "bg-success/15 border-success/20 group-hover:bg-success/20 group-hover:border-success/30",
        title: "Original Voice",
        desc: "Authentic recordings show natural micro-variations in pitch, tone, and breath that AI models cannot perfectly replicate.",
      },
      {
        icon: AlertTriangle, iconCls: "text-warning", bgCls: "bg-warning/15 border-warning/20 group-hover:bg-warning/20 group-hover:border-warning/30",
        title: "Synthetic Voice",
        desc: "AI-generated audio carries embedded AudioSeal watermarks and subtle spectral patterns our detector identifies with high confidence.",
      },
    ].map(({ icon: Icon, iconCls, bgCls, title, desc }) => (
      <div key={title} className="glass-card p-4 sm:p-5 group transition-colors duration-300">
        <div className="flex items-center gap-3 mb-2 sm:mb-3">
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition-colors ${bgCls}`}>
            <Icon className={`w-4 h-4 ${iconCls}`} />
          </div>
          <h4 className="font-semibold text-xs sm:text-sm text-foreground">{title}</h4>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    ))}
  </div>
);

const VoiceAuthentication = () => {
  const { authentication, setAuthentication, resetAuthentication } = useVoiceStudio();
  const { toast } = useToast();

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [longWaitMsgIdx, setLongWaitMsgIdx] = useState<number | null>(null);

  const currentObjectUrlRef = useRef<string | null>(null);
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longWaitCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFileSelect = (file: File | null) => {
    if (currentObjectUrlRef.current) { URL.revokeObjectURL(currentObjectUrlRef.current); currentObjectUrlRef.current = null; }
    setAudioFile(file);
    setErrorMessage(null);
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
    setErrorMessage(null);
    setLongWaitMsgIdx(null);
    setAuthentication({ result: null });

    stageTimerRef.current = setInterval(() => setStageIndex((p) => p < ANALYSIS_STAGES.length - 1 ? p + 1 : p), 2000);
    longWaitTimerRef.current = setTimeout(() => {
      setLongWaitMsgIdx(0);
      longWaitCycleRef.current = setInterval(() => setLongWaitMsgIdx((p) => p === null ? 0 : (p + 1) % LONG_WAIT_MESSAGES.length), 12_000);
    }, LONG_WAIT_THRESHOLD_MS);

    try {
      const response = await voiceAPI.authenticateVoice(audioFile);
      setAuthentication({ result: { isOriginal: response.is_original, confidence: response.confidence } });
      toast({ title: "Analysis Complete", description: response.is_original ? "Voice appears to be original" : "Voice appears to be AI-generated" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setErrorMessage(msg);
      toast({ title: "Analysis Failed", description: msg, variant: "destructive" });
    } finally {
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      if (longWaitTimerRef.current) clearTimeout(longWaitTimerRef.current);
      if (longWaitCycleRef.current) clearInterval(longWaitCycleRef.current);
      setIsAnalyzing(false);
      setStageIndex(0);
      setLongWaitMsgIdx(null);
    }
  };

  const handleReset = () => {
    if (currentObjectUrlRef.current) { URL.revokeObjectURL(currentObjectUrlRef.current); currentObjectUrlRef.current = null; }
    setAudioFile(null);
    setErrorMessage(null);
    resetAuthentication();
  };

  const isRestoredSession = !audioFile && !!authentication.audioFileName;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-6 animate-fade-in-up">
      <div className="glass-card p-5 sm:p-8">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
          <div className="relative mb-4 sm:mb-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl gradient-bg flex items-center justify-center glow animate-pulse-glow">
              <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-foreground" />
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-secondary/30 border border-secondary/40 flex items-center justify-center">
              <Waves className="w-3 h-3 text-secondary" />
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold gradient-text mb-2">Voice Authentication</h2>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-xs sm:max-w-sm leading-relaxed">
            Detect whether an audio clip is authentic human voice or AI-generated — with confidence scoring and watermark analysis.
          </p>
          <div className="flex items-center gap-2 mt-4 w-full max-w-[240px]">
            <div className="flex-1 h-px bg-white/5" />
            <Fingerprint className="w-3.5 h-3.5 text-muted-foreground/25" />
            <div className="flex-1 h-px bg-white/5" />
          </div>
        </div>

        {/* Upload + Analyze */}
        {!authentication.result && !isAnalyzing && (
          <div className="space-y-4 animate-fade-in-up">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">Upload Audio for Analysis</h3>
                <QuickTip tip="Best results with 5–60 second clips. WAV or high-quality MP3 gives the most accurate detection." />
              </div>
              <AudioUploader file={audioFile} onFileSelect={handleFileSelect} inputId="audio-upload-authentication"
                label={isRestoredSession ? `Re-upload "${authentication.audioFileName}"` : "Upload audio to verify"} />
              {isRestoredSession && (
                <p className="mt-2 text-xs text-warning/70 text-center">
                  Previous file <span className="font-medium">{authentication.audioFileName}</span> — re-upload to analyze.
                </p>
              )}
            </div>

            <Button onClick={handleAnalyze} disabled={!audioFile}
              className="w-full h-12 sm:h-14 text-sm sm:text-base font-semibold gradient-bg hover:opacity-90 transition-all glow disabled:opacity-40 disabled:cursor-not-allowed">
              <Search className="w-4 h-4 mr-2" />Analyze Voice
            </Button>

            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/8 border border-destructive/20 animate-fade-in-up">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-destructive mb-0.5">Analysis failed</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scanning */}
        {isAnalyzing && (
          <ScanningOverlay stage={ANALYSIS_STAGES[stageIndex]} stageIndex={stageIndex} total={ANALYSIS_STAGES.length}
            longWaitMessage={longWaitMsgIdx !== null ? LONG_WAIT_MESSAGES[longWaitMsgIdx] : undefined} />
        )}

        {/* Results */}
        {authentication.result && !isAnalyzing && (
          <div className="animate-scale-in">
            <AnalysisResult isOriginal={authentication.result.isOriginal} confidence={authentication.result.confidence} />
            <Button onClick={handleReset} variant="outline" className="w-full mt-5 h-10 sm:h-11 border-white/10 hover:bg-muted/30 text-xs sm:text-sm">
              Analyze Another Audio
            </Button>
          </div>
        )}

        {!isAnalyzing && (
          <Button variant="ghost" onClick={handleReset} className="w-full mt-2 h-9 text-muted-foreground hover:text-foreground text-xs transition-all">
            <RotateCcw className="w-3 h-3 mr-1.5" />Reset
          </Button>
        )}
      </div>

      <InfoCards />
    </div>
  );
};

export default VoiceAuthentication;
