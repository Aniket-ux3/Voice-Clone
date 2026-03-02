import { useRef, useState, useEffect } from "react";
import {
  RotateCcw, Sparkles, Upload, FileText, Smile, Wand2,
  Download, CheckCircle2, Circle, Loader2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import AudioUploader from "./AudioUploader";
import EmotionSelector from "./EmotionSelector";
import AudioPlayer from "./AudioPlayer";
import QuickTip from "./QuickTip";
import { voiceAPI } from "@/services/api";
import { useVoiceStudio } from "@/hooks/useVoiceStudio";

// ── Stage labels shown during processing ─────────────────────────────────────
const PROCESSING_STAGES = [
  "Extracting voice features...",
  "Generating base speech...",
  "Applying voice characteristics...",
  "Embedding watermark...",
  "Finalizing output...",
];

// ── Step config ───────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Voice Sample", icon: Upload },
  { id: 2, label: "Script",       icon: FileText },
  { id: 3, label: "Emotion",      icon: Smile },
  { id: 4, label: "Output",       icon: Download },
] as const;

// ── Stepper header ────────────────────────────────────────────────────────────
const Stepper = ({ currentStep }: { currentStep: number }) => (
  <div className="flex items-center justify-between mb-10 px-2">
    {STEPS.map(({ id, label, icon: Icon }, idx) => {
      const done    = currentStep > id;
      const active  = currentStep === id;
      const pending = currentStep < id;
      return (
        <div key={id} className="flex items-center flex-1 last:flex-none">
          {/* Node */}
          <div className="flex flex-col items-center gap-1.5 relative">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                done
                  ? "border-primary bg-primary text-foreground"
                  : active
                  ? "border-primary gradient-bg text-foreground glow"
                  : "border-muted-foreground/20 bg-muted/20 text-muted-foreground/40"
              }`}
            >
              {done ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Icon className={`w-4 h-4 ${pending ? "opacity-40" : ""}`} />
              )}
            </div>
            <span
              className={`text-[10px] font-medium tracking-wide whitespace-nowrap transition-colors duration-300 ${
                done || active ? "text-foreground/70" : "text-muted-foreground/30"
              }`}
            >
              {label}
            </span>
          </div>
          {/* Connector */}
          {idx < STEPS.length - 1 && (
            <div className="flex-1 mx-2 mb-5">
              <div className="h-px w-full bg-muted/20 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-700 gradient-bg"
                  style={{ width: currentStep > id ? "100%" : "0%" }}
                />
              </div>
            </div>
          )}
        </div>
      );
    })}
  </div>
);

// ── Processing overlay ────────────────────────────────────────────────────────
const ProcessingOverlay = ({
  stage,
  stageIndex,
  total,
}: {
  stage: string;
  stageIndex: number;
  total: number;
}) => (
  <div className="flex flex-col items-center justify-center py-16 animate-fade-in-up">
    {/* Spinning conic ring */}
    <div className="relative w-28 h-28 mb-8">
      <div className="absolute inset-0 rounded-full animate-spin-slow"
        style={{
          background: "conic-gradient(from 0deg, hsl(var(--gradient-start)), hsl(var(--gradient-mid)), hsl(var(--gradient-end)), hsl(var(--gradient-start)))",
          WebkitMask: "radial-gradient(farthest-side, transparent 62%, black 63%)",
          mask: "radial-gradient(farthest-side, transparent 62%, black 63%)",
        }}
      />
      <div className="absolute inset-3 rounded-full bg-background flex items-center justify-center">
        <Wand2 className="w-8 h-8 text-primary animate-float" />
      </div>
    </div>

    {/* Stage text */}
    <p className="text-base font-semibold text-foreground mb-2">{stage}</p>
    <p className="text-xs text-muted-foreground mb-6">
      Step {stageIndex + 1} of {total}
    </p>

    {/* Segmented progress bar */}
    <div className="flex gap-1.5 w-56">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-500 ${
            i < stageIndex ? "gradient-bg" : i === stageIndex ? "gradient-bg opacity-60 animate-pulse" : "bg-muted/30"
          }`}
        />
      ))}
    </div>

    {/* Animated waveform */}
    <div className="flex items-end gap-0.5 h-6 mt-8">
      {Array.from({ length: 28 }).map((_, i) => (
        <div
          key={i}
          className="w-1 rounded-full waveform-bar animate-wave"
          style={{ height: "100%", animationDelay: `${i * 0.07}s` }}
        />
      ))}
    </div>
  </div>
);

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyOutputState = () => (
  <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in-up">
    <div className="relative mb-6">
      <div className="w-20 h-20 rounded-2xl bg-muted/20 border border-white/5 flex items-center justify-center">
        <Wand2 className="w-8 h-8 text-muted-foreground/30" />
      </div>
      <Circle className="absolute -top-1.5 -right-1.5 w-5 h-5 text-muted-foreground/20" strokeDasharray="3 3" />
    </div>
    <p className="text-sm font-medium text-muted-foreground/60 mb-1">No output yet</p>
    <p className="text-xs text-muted-foreground/30 max-w-[180px]">
      Complete the steps on the left to generate a voice clone
    </p>
  </div>
);

// ── Status chip ───────────────────────────────────────────────────────────────
const StatusChip = ({
  state,
}: {
  state: "idle" | "processing" | "complete" | "error";
}) => {
  const map = {
    idle:       { label: "Idle",       cls: "bg-muted/30 text-muted-foreground border-white/10" },
    processing: { label: "Processing", cls: "bg-primary/15 text-primary border-primary/30 animate-pulse" },
    complete:   { label: "Complete",   cls: "bg-success/15 text-success border-success/30" },
    error:      { label: "Error",      cls: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  const { label, cls } = map[state];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        state === "processing" ? "bg-primary animate-pulse" :
        state === "complete"   ? "bg-success" :
        state === "error"      ? "bg-destructive" :
        "bg-muted-foreground"
      }`} />
      {label}
    </span>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const VoiceGeneration = () => {
  const { generation, setGeneration, resetGeneration } = useVoiceStudio();
  const { toast } = useToast();

  const [audioFile, setAudioFile]     = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStageIdx, setProcessingStageIdx] = useState(0);
  const currentObjectUrlRef = useRef<string | null>(null);
  const stageTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derive the current workflow step (1-4) for the stepper
  const currentStep = (() => {
    if (generation.generatedAudioUrl) return 4;
    if (generation.emotion !== "neutral" || generation.text.trim()) return 3;
    if (generation.text.trim().length > 0) return 2;
    if (audioFile || generation.audioFileName) return 1;
    return 1;
  })();

  const outputStatus: "idle" | "processing" | "complete" | "error" =
    isProcessing ? "processing" : generation.generatedAudioUrl ? "complete" : "idle";

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentObjectUrlRef.current && currentObjectUrlRef.current !== generation.audioFileUrl) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      }
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cycle through stage labels during processing
  useEffect(() => {
    if (isProcessing) {
      setProcessingStageIdx(0);
      stageTimerRef.current = setInterval(() => {
        setProcessingStageIdx((prev) =>
          prev < PROCESSING_STAGES.length - 1 ? prev + 1 : prev,
        );
      }, 2200);
    } else {
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      setProcessingStageIdx(0);
    }
    return () => {
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    };
  }, [isProcessing]);

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
      setGeneration({ audioFileUrl: url, audioFileName: file.name, generatedAudioUrl: null, audioId: null });
    } else {
      setGeneration({ audioFileUrl: null, audioFileName: null, generatedAudioUrl: null, audioId: null });
    }
  };

  const handleGenerate = async () => {
    if (!audioFile || !generation.text.trim()) return;
    setIsProcessing(true);
    setGeneration({ generatedAudioUrl: null, audioId: null });
    try {
      const response = await voiceAPI.generateVoice({
        audio: audioFile,
        text: generation.text,
        emotion: generation.emotion,
      });
      const downloadUrl = voiceAPI.getDownloadUrl(response.audio_id);
      setGeneration({ audioId: response.audio_id, generatedAudioUrl: downloadUrl });
      toast({ title: "Voice generated!", description: "Your voice clone is ready." });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!generation.audioId) return;
    try {
      const blob = await voiceAPI.downloadAudio(generation.audioId);
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = "generated_voice.wav";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: "Audio file saved." });
    } catch {
      toast({ title: "Download Failed", description: "Could not download file.", variant: "destructive" });
    }
  };

  const handleReset = () => {
    if (currentObjectUrlRef.current) { URL.revokeObjectURL(currentObjectUrlRef.current); currentObjectUrlRef.current = null; }
    setAudioFile(null);
    resetGeneration();
  };

  const canGenerate      = !!audioFile && generation.text.trim().length > 0;
  const isRestoredSession = !audioFile && !!generation.audioFileName;

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Stepper ──────────────────────────────────────────────────────── */}
      <div className="glass-card px-8 pt-7 pb-2">
        <Stepper currentStep={currentStep} />
      </div>

      {/* ── Two-column work area ─────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-[1fr_1fr] gap-6">

        {/* ── Left: inputs ─────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Step 1 — Upload */}
          <div className={`glass-card p-6 transition-all duration-300 ${currentStep === 1 ? "gradient-border" : ""}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center">
                  <span className="text-[10px] font-bold text-foreground">1</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">Voice Sample</h3>
                <QuickTip tip="Upload 10–30 seconds of clear speech. WAV gives the best embedding accuracy." />
              </div>
              {(audioFile || generation.audioFileName) && (
                <CheckCircle2 className="w-4 h-4 text-success" />
              )}
            </div>
            <AudioUploader
              file={audioFile}
              onFileSelect={handleFileSelect}
              inputId="audio-upload-generation"
              label={
                isRestoredSession
                  ? `Re-upload "${generation.audioFileName}"`
                  : "Upload Voice Sample"
              }
            />
            {isRestoredSession && (
              <p className="mt-3 text-xs text-warning/70 text-center">
                Previous file <span className="font-medium">{generation.audioFileName}</span> — re-upload to generate again.
              </p>
            )}
          </div>

          {/* Step 2 — Script */}
          <div className={`glass-card p-6 transition-all duration-300 ${currentStep === 2 ? "gradient-border" : ""}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center">
                  <span className="text-[10px] font-bold text-foreground">2</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">Script</h3>
                <QuickTip tip="Under 200 characters produces the most natural output. Use punctuation for natural rhythm." />
              </div>
              {generation.text.trim().length > 0 && (
                <CheckCircle2 className="w-4 h-4 text-success" />
              )}
            </div>
            <Textarea
              value={generation.text}
              onChange={(e) => setGeneration({ text: e.target.value })}
              placeholder="Enter the text you want the cloned voice to speak..."
              className="min-h-[110px] bg-muted/20 border-white/8 resize-none focus:border-primary/50 text-sm"
            />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-xs ${generation.text.length > 400 ? "text-warning" : "text-muted-foreground"}`}>
                {generation.text.length} chars
              </span>
              {generation.text.length > 400 && (
                <span className="text-xs text-warning flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Long scripts may slow generation
                </span>
              )}
            </div>
          </div>

          {/* Step 3 — Emotion */}
          <div className={`glass-card p-6 transition-all duration-300 ${currentStep === 3 ? "gradient-border" : ""}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center">
                <span className="text-[10px] font-bold text-foreground">3</span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">Emotion</h3>
              <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full border border-white/5">
                Optional
              </span>
              <QuickTip tip="Emotion shapes tone and pacing. Neutral is a safe default for most use cases." />
            </div>
            <EmotionSelector
              selected={generation.emotion}
              onSelect={(emotion) => setGeneration({ emotion })}
            />
          </div>

          {/* Step 4 — Action buttons */}
          <div className="space-y-2.5">
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || isProcessing}
              className="w-full h-14 text-base font-semibold gradient-bg hover:opacity-90 transition-all glow disabled:opacity-40 disabled:glow-none disabled:cursor-not-allowed relative overflow-hidden group"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2 group-hover:animate-pulse" />
                  Generate Voice
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="w-full h-10 border-white/8 hover:bg-muted/30 text-muted-foreground hover:text-foreground text-sm transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset Generation
            </Button>
          </div>
        </div>

        {/* ── Right: output ────────────────────────────────────────────── */}
        <div className="glass-card p-6 flex flex-col min-h-[480px]">
          {/* Output header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center">
              <span className="text-[10px] font-bold text-foreground">4</span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">Output</h3>
            </div>
            <StatusChip state={outputStatus} />
          </div>

          <div className="flex-1 flex items-center justify-center">
            {isProcessing ? (
              <ProcessingOverlay
                stage={PROCESSING_STAGES[processingStageIdx]}
                stageIndex={processingStageIdx}
                total={PROCESSING_STAGES.length}
              />
            ) : generation.generatedAudioUrl ? (
              <div className="w-full space-y-5 animate-scale-in">
                {/* Success banner */}
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-success/8 border border-success/20">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-success">Voice generated successfully</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      AudioSeal watermark embedded · Ready to download
                    </p>
                  </div>
                </div>
                {/* Player */}
                <AudioPlayer
                  audioUrl={generation.generatedAudioUrl}
                  onRegenerate={handleGenerate}
                />
                {/* Download */}
                <Button
                  onClick={handleDownload}
                  className="w-full h-11 border border-white/10 bg-white/5 hover:bg-white/10 text-foreground text-sm transition-all"
                  variant="outline"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download WAV
                </Button>
              </div>
            ) : (
              <EmptyOutputState />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceGeneration;
