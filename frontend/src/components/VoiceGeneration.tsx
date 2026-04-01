import { useRef, useState, useEffect } from "react";
import {
  RotateCcw, Sparkles, Upload, FileText, Smile, Wand2,
  Download, CheckCircle2, Circle, Loader2, AlertCircle, Cpu,
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

const PROCESSING_STAGES = [
  "Extracting voice features...",
  "Generating base speech...",
  "Applying voice characteristics...",
  "Embedding watermark...",
  "Finalizing output...",
];

const LONG_WAIT_MESSAGES = [
  "Still working — CPU inference takes 1–2 min. Hang tight!",
  "Almost there — complex scripts take a little longer.",
  "Processing on CPU — this is normal. Stay on the tab.",
  "Taking a bit longer than usual — please don't close this tab.",
];

const LONG_WAIT_THRESHOLD_MS = 30_000;

const STEPS = [
  { id: 1, label: "Sample",  icon: Upload   },
  { id: 2, label: "Script",  icon: FileText },
  { id: 3, label: "Emotion", icon: Smile    },
  { id: 4, label: "Output",  icon: Download },
] as const;

// ── Stepper ───────────────────────────────────────────────────────────────────
//
// Layout fix: the row is  [node] [flex-1 connector] [node] [flex-1 connector] [node] [flex-1 connector] [node]
// The last node must be `shrink-0` with NO surrounding flex-1 wrapper — otherwise
// it gets an equal share of the row width and its circle drifts left, leaving
// empty space to the right of "Output".
//
// Structure used here:
//   • Intermediate steps:  <div flex-1>  <node>  <connector flex-1>  </div>
//   • Last step:           <node shrink-0>   (no flex-1 wrapper, no connector)
//
const Stepper = ({ currentStep }: { currentStep: number }) => (
  <div className="flex items-center w-full overflow-x-auto pb-1 hide-scrollbar">
    {/* Outer row: each intermediate step takes flex-1; last node is shrink-0 */}
    <div className="flex items-center w-full">
      {STEPS.map(({ id, label, icon: Icon }, idx) => {
        const done   = currentStep > id;
        const active = currentStep === id;
        const isLast = idx === STEPS.length - 1;

        const node = (
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                done
                  ? "border-primary bg-primary text-foreground"
                  : active
                  ? "border-primary gradient-bg text-foreground glow"
                  : "border-muted-foreground/20 bg-muted/20 text-muted-foreground/40"
              }`}
            >
              {done
                ? <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                : <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${!active ? "opacity-40" : ""}`} />
              }
            </div>
            <span
              className={`text-[10px] sm:text-xs font-medium whitespace-nowrap transition-colors duration-300 ${
                done || active ? "text-foreground/70" : "text-muted-foreground/30"
              }`}
            >
              {label}
            </span>
          </div>
        );

        if (isLast) {
          // Last node: no flex-1 wrapper, no connector — sits flush at the end
          return <div key={id} className="shrink-0">{node}</div>;
        }

        return (
          // Intermediate node + its trailing connector, together take flex-1
          <div key={id} className="flex items-center flex-1 min-w-0">
            {node}
            {/* Connector stretches from this node to the next */}
            <div className="flex-1 mx-2 sm:mx-3 mb-5">
              <div className="h-px w-full bg-muted/20 relative overflow-hidden rounded-full">
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-700 ease-out gradient-bg rounded-full"
                  style={{ width: currentStep > id ? "100%" : "0%" }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ── Processing overlay ────────────────────────────────────────────────────────
const ProcessingOverlay = ({
  stage, stageIndex, total, longWaitMessage,
}: {
  stage: string; stageIndex: number; total: number; longWaitMessage?: string;
}) => (
  <div className="flex flex-col items-center justify-center py-10 sm:py-12 animate-fade-in-up">
    <div className="relative w-24 h-24 sm:w-32 sm:h-32 mb-6 sm:mb-8">
      <div
        className="absolute inset-0 rounded-full animate-spin-slow"
        style={{
          background: "conic-gradient(from 0deg, hsl(var(--gradient-start)), hsl(var(--gradient-mid)), hsl(var(--gradient-end)), hsl(var(--gradient-start)))",
          WebkitMask: "radial-gradient(farthest-side, transparent 62%, black 63%)",
          mask: "radial-gradient(farthest-side, transparent 62%, black 63%)",
        }}
      />
      <div className="absolute inset-3 rounded-full bg-background flex items-center justify-center">
        <Wand2 className="w-7 h-7 sm:w-9 sm:h-9 text-primary animate-float" />
      </div>
    </div>
    <p className="text-sm sm:text-base font-semibold text-foreground mb-1.5 text-center px-4">{stage}</p>
    <p className="text-xs text-muted-foreground mb-6">Step {stageIndex + 1} of {total}</p>
    <div className="flex gap-1.5 w-48 sm:w-64">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-500 ${
            i < stageIndex ? "gradient-bg" : i === stageIndex ? "gradient-bg opacity-60 animate-pulse" : "bg-muted/30"
          }`}
        />
      ))}
    </div>
    <div className="flex items-end gap-0.5 h-6 mt-8">
      {Array.from({ length: 24 }).map((_, i) => (
        <div key={i} className="w-1 rounded-full waveform-bar animate-wave" style={{ height: "100%", animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
    {longWaitMessage && (
      <div className="mt-6 px-4 py-3 rounded-xl bg-primary/8 border border-primary/20 max-w-xs animate-fade-in-up">
        <div className="flex items-start gap-2">
          <Cpu className="w-3.5 h-3.5 text-primary/80 shrink-0 mt-0.5" />
          <p className="text-xs text-primary/90 leading-relaxed">{longWaitMessage}</p>
        </div>
      </div>
    )}
  </div>
);

// ── Empty output state ────────────────────────────────────────────────────────
const EmptyOutputState = () => (
  <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in-up">
    <div className="relative mb-5">
      <div className="w-20 h-20 rounded-2xl bg-muted/20 border border-white/5 flex items-center justify-center">
        <Wand2 className="w-9 h-9 text-muted-foreground/25" />
      </div>
      <Circle className="absolute -top-1.5 -right-1.5 w-5 h-5 text-muted-foreground/15" strokeDasharray="3 3" />
    </div>
    <p className="text-sm font-medium text-muted-foreground/50 mb-2">No output yet</p>
    <p className="text-xs text-muted-foreground/30 max-w-[200px] leading-relaxed">
      Complete all steps on the left to generate a voice clone
    </p>
  </div>
);

// ── Status chip ───────────────────────────────────────────────────────────────
const StatusChip = ({ state }: { state: "idle" | "processing" | "complete" | "error" }) => {
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
        state === "processing" ? "bg-primary animate-pulse"
        : state === "complete" ? "bg-success"
        : state === "error"    ? "bg-destructive"
        : "bg-muted-foreground"
      }`} />
      {label}
    </span>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const VoiceGeneration = () => {
  const { generation, setGeneration, resetGeneration } = useVoiceStudio();
  const { toast } = useToast();

  const [audioFile, setAudioFile]       = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStageIdx, setProcessingStageIdx] = useState(0);
  const [longWaitMsgIdx, setLongWaitMsgIdx]         = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentObjectUrlRef = useRef<string | null>(null);
  const stageTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const longWaitTimerRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const longWaitCycleRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasFile  = !!(audioFile || generation.audioFileName);
  const hasText  = generation.text.trim().length > 0;
  const hasAudio = !!generation.generatedAudioUrl;

  const currentStep: number = (() => {
    if (hasAudio) return 4;
    if (hasText)  return 3;
    if (hasFile)  return 2;
    return 1;
  })();

  const outputStatus: "idle" | "processing" | "complete" | "error" =
    isProcessing ? "processing" : hasAudio ? "complete" : "idle";

  useEffect(() => {
    return () => {
      if (currentObjectUrlRef.current) URL.revokeObjectURL(currentObjectUrlRef.current);
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isProcessing) {
      setProcessingStageIdx(0);
      setLongWaitMsgIdx(null);
      stageTimerRef.current = setInterval(() => {
        setProcessingStageIdx((p) => p < PROCESSING_STAGES.length - 1 ? p + 1 : p);
      }, 2200);
      longWaitTimerRef.current = setTimeout(() => {
        setLongWaitMsgIdx(0);
        longWaitCycleRef.current = setInterval(() => {
          setLongWaitMsgIdx((p) => p === null ? 0 : (p + 1) % LONG_WAIT_MESSAGES.length);
        }, 15_000);
      }, LONG_WAIT_THRESHOLD_MS);
    } else {
      if (stageTimerRef.current)    clearInterval(stageTimerRef.current);
      if (longWaitTimerRef.current) clearTimeout(longWaitTimerRef.current);
      if (longWaitCycleRef.current) clearInterval(longWaitCycleRef.current);
      setProcessingStageIdx(0);
      setLongWaitMsgIdx(null);
    }
    return () => {
      if (stageTimerRef.current)    clearInterval(stageTimerRef.current);
      if (longWaitTimerRef.current) clearTimeout(longWaitTimerRef.current);
      if (longWaitCycleRef.current) clearInterval(longWaitCycleRef.current);
    };
  }, [isProcessing]);

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
    setErrorMessage(null);
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
      const msg = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setErrorMessage(msg);
      toast({ title: "Generation Failed", description: msg, variant: "destructive" });
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
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    setAudioFile(null);
    setErrorMessage(null);
    resetGeneration();
  };

  const canGenerate       = !!audioFile && generation.text.trim().length > 0;
  const isRestoredSession = !audioFile && !!generation.audioFileName;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in-up">

      {/* ── Stepper ──────────────────────────────────────────────────────── */}
      <div className="glass-card px-5 sm:px-8 pt-5 pb-4">
        <Stepper currentStep={currentStep} />
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:items-stretch">

        {/* Left column: inputs */}
        <div className="space-y-4">

          {/* Step 1 — Upload */}
          <div className={`glass-card p-4 sm:p-6 transition-all duration-300 ${currentStep === 1 ? "gradient-border" : ""}`}>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full gradient-bg flex items-center justify-center shrink-0">
                  <span className="text-[9px] sm:text-[10px] font-bold text-foreground">1</span>
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">Voice Sample</h3>
                <QuickTip tip="Upload 10–30 seconds of clear speech. WAV gives the best accuracy." />
              </div>
              {hasFile && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
            </div>
            <AudioUploader
              file={audioFile}
              onFileSelect={handleFileSelect}
              inputId="audio-upload-generation"
              label={isRestoredSession ? `Re-upload "${generation.audioFileName}"` : "Upload Voice Sample"}
            />
            {isRestoredSession && (
              <p className="mt-2 text-xs text-warning/70 text-center">
                Previous file <span className="font-medium">{generation.audioFileName}</span> — re-upload to generate.
              </p>
            )}
          </div>

          {/* Step 2 — Script */}
          <div className={`glass-card p-4 sm:p-6 transition-all duration-300 ${currentStep === 2 ? "gradient-border" : ""}`}>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full gradient-bg flex items-center justify-center shrink-0">
                  <span className="text-[9px] sm:text-[10px] font-bold text-foreground">2</span>
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">Script</h3>
                <QuickTip tip="Under 200 characters produces the most natural output." />
              </div>
              {hasText && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
            </div>
            <Textarea
              value={generation.text}
              onChange={(e) => setGeneration({ text: e.target.value })}
              placeholder="Enter the text you want the cloned voice to speak..."
              className="min-h-[90px] sm:min-h-[120px] bg-muted/20 border-white/8 resize-none focus:border-primary/50 text-sm"
            />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-xs ${generation.text.length > 400 ? "text-warning" : "text-muted-foreground"}`}>
                {generation.text.length} chars
              </span>
              {generation.text.length > 400 && (
                <span className="text-xs text-warning flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />Long scripts may be slow
                </span>
              )}
            </div>
          </div>

          {/* Step 3 — Emotion */}
          <div className={`glass-card p-4 sm:p-6 transition-all duration-300 ${currentStep === 3 ? "gradient-border" : ""}`}>
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full gradient-bg flex items-center justify-center shrink-0">
                <span className="text-[9px] sm:text-[10px] font-bold text-foreground">3</span>
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-foreground">Emotion</h3>
              <span className="text-[9px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-full border border-white/5">
                Optional
              </span>
              <QuickTip tip="Neutral is a safe default for most use cases." />
            </div>
            <EmotionSelector selected={generation.emotion} onSelect={(emotion) => setGeneration({ emotion })} />
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || isProcessing}
              className="w-full h-12 sm:h-14 text-sm sm:text-base font-semibold gradient-bg hover:opacity-90 transition-all glow disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              {isProcessing
                ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>)
                : (<><Sparkles className="w-4 h-4 mr-2 group-hover:animate-pulse" />Generate Voice</>)}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="w-full h-9 sm:h-10 border-white/8 hover:bg-muted/30 text-muted-foreground hover:text-foreground text-xs sm:text-sm transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset
            </Button>
            {errorMessage && !isProcessing && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/8 border border-destructive/20 animate-fade-in-up">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-destructive mb-0.5">Generation failed</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: output */}
        <div className="glass-card p-4 sm:p-6 flex flex-col self-stretch min-h-[400px]">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full gradient-bg flex items-center justify-center shrink-0">
                <span className="text-[9px] sm:text-[10px] font-bold text-foreground">4</span>
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-foreground">Output</h3>
            </div>
            <StatusChip state={outputStatus} />
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {isProcessing ? (
              <ProcessingOverlay
                stage={PROCESSING_STAGES[processingStageIdx]}
                stageIndex={processingStageIdx}
                total={PROCESSING_STAGES.length}
                longWaitMessage={longWaitMsgIdx !== null ? LONG_WAIT_MESSAGES[longWaitMsgIdx] : undefined}
              />
            ) : generation.generatedAudioUrl ? (
              <div className="w-full space-y-4 sm:space-y-5 animate-scale-in">
                <div className="flex items-center gap-2.5 p-3 sm:p-4 rounded-xl bg-success/8 border border-success/20">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-success">Voice generated successfully</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                      AudioSeal watermark embedded · Ready to download
                    </p>
                  </div>
                </div>
                <AudioPlayer audioUrl={generation.generatedAudioUrl} onRegenerate={handleGenerate} />
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="w-full h-10 sm:h-12 border border-white/10 bg-white/5 hover:bg-white/10 text-foreground text-sm transition-all"
                >
                  <Download className="w-4 h-4 mr-2" />Download WAV
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
