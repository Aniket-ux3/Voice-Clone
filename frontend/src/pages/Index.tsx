import { useState, useEffect } from "react";
import {
  Mic, Shield, Sparkles, Trash2, Zap, Fingerprint, Waves, Brain,
  ChevronRight, Cpu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import VoiceGeneration from "@/components/VoiceGeneration";
import VoiceAuthentication from "@/components/VoiceAuthentication";
import { useVoiceStudio } from "@/hooks/useVoiceStudio";
import { voiceAPI } from "@/services/api";

type TabType = "generation" | "authentication";

// ── Feature badge ────────────────────────────────────────────────────────────
const FeatureBadge = ({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-white/10 bg-white/5 text-muted-foreground backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:text-foreground hover:bg-primary/10">
    <Icon className="w-3 h-3 text-primary" />
    {label}
  </span>
);

// ── Session dot ──────────────────────────────────────────────────────────────
const SessionBadge = () => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-success/30 bg-success/10 text-success">
    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
    Session Active
  </span>
);

// ── CPU notice banner ─────────────────────────────────────────────────────────
// Shown when the health check reports device === "cpu".
// Users learn upfront that generation will be slow — no surprise freezes.
const CpuNoticeBanner = ({ onDismiss }: { onDismiss: () => void }) => (
  <div className="relative flex items-start gap-3 px-5 py-3.5 rounded-xl bg-amber-500/8 border border-amber-500/25 animate-fade-in-up mb-4">
    <Cpu className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-amber-300 mb-0.5">
        Running on CPU — expect slower generation
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        This Space is using CPU inference (no GPU available). Voice generation typically takes{" "}
        <span className="text-foreground/70 font-medium">1–3 minutes</span>. Authentication is faster (~20–40 s).
        Please don't close or refresh the tab while processing.
      </p>
    </div>
    <button
      onClick={onDismiss}
      aria-label="Dismiss CPU notice"
      className="shrink-0 p-0.5 rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
);

// ── Main page ────────────────────────────────────────────────────────────────
const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>("generation");
  const { clearAll } = useVoiceStudio();

  // CPU detection state
  const [isCpu, setIsCpu]               = useState(false);
  const [cpuBannerVisible, setCpuBannerVisible] = useState(false);

  // Poll /api/health once on mount to detect CPU vs GPU
  useEffect(() => {
    let cancelled = false;
    voiceAPI.healthCheck()
      .then((health) => {
        if (cancelled) return;
        if (health.device === "cpu") {
          setIsCpu(true);
          setCpuBannerVisible(true);
        }
      })
      .catch(() => {
        // Health check failed silently — don't block the UI
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">

      {/* ── Ambient background ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top-left orb */}
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-[0.07]"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--gradient-start)) 0%, transparent 70%)",
          }}
        />
        {/* Top-right orb */}
        <div
          className="absolute -top-16 right-0 w-[500px] h-[500px] rounded-full opacity-[0.06]"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--gradient-mid)) 0%, transparent 70%)",
          }}
        />
        {/* Centre orb */}
        <div
          className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-[0.04]"
          style={{
            background:
              "radial-gradient(ellipse, hsl(var(--gradient-end)) 0%, transparent 70%)",
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-6 pt-8 pb-16 max-w-6xl">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-16 animate-fade-in-up">
          {/* Logo mark */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center glow">
              <Waves className="w-4 h-4 text-foreground" />
            </div>
            <span className="text-sm font-semibold text-foreground/70 tracking-wide uppercase">
              VoiceStudio
            </span>
          </div>
          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* Chip showing CPU mode when detected */}
            {isCpu && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <Cpu className="w-3 h-3" />
                CPU Mode
              </span>
            )}
            <SessionBadge />
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Session
            </Button>
          </div>
        </div>

        {/* ── CPU notice banner (dismissible) ──────────────────────────────── */}
        {cpuBannerVisible && (
          <CpuNoticeBanner onDismiss={() => setCpuBannerVisible(false)} />
        )}

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <header
          className="text-center mb-16 animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          {/* Eye-catching icon cluster */}
          <div className="relative inline-flex items-center justify-center mb-8">
            <div className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center glow animate-pulse-glow">
              <Mic className="w-9 h-9 text-foreground" />
            </div>
            {/* Orbiting badges */}
            <div
              className="absolute -top-2 -right-3 w-8 h-8 rounded-full bg-secondary/30 border border-secondary/40 flex items-center justify-center animate-float"
              style={{ animationDelay: "0s" }}
            >
              <Brain className="w-4 h-4 text-secondary" />
            </div>
            <div
              className="absolute -bottom-1 -left-3 w-7 h-7 rounded-full bg-accent/30 border border-accent/40 flex items-center justify-center animate-float"
              style={{ animationDelay: "1s" }}
            >
              <Zap className="w-3.5 h-3.5 text-accent" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight gradient-text mb-5 leading-tight">
            Synthetic Voice Studio
          </h1>

          {/* Subtitle */}
          <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed mb-8">
            Generate high-fidelity voice clones and verify audio authenticity
            with{" "}
            <span className="text-foreground/80 font-medium">
              AI-powered watermark detection
            </span>
            .
          </p>

          {/* Feature badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            <FeatureBadge icon={Sparkles} label="Voice Cloning" />
            <FeatureBadge icon={Fingerprint} label="Voice Authentication" />
            <FeatureBadge icon={Shield} label="Watermark Detection" />
            <FeatureBadge icon={Brain} label="AI-Powered" />
          </div>

          {/* Separator */}
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-primary/40" />
            <div className="w-1.5 h-1.5 rounded-full gradient-bg opacity-60" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-primary/40" />
          </div>
        </header>

        {/* ── Tab switcher ─────────────────────────────────────────────────── */}
        <nav
          className="flex justify-center mb-12 animate-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="relative glass-card p-1.5 inline-flex gap-1 rounded-2xl">
            {(
              [
                { id: "generation", label: "Voice Generation", Icon: Sparkles },
                { id: "authentication", label: "Voice Authentication", Icon: Shield },
              ] as const
            ).map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`relative flex items-center gap-2 px-7 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  {/* Active background */}
                  {active && (
                    <span className="absolute inset-0 rounded-xl gradient-bg glow opacity-90 -z-0" />
                  )}
                  <Icon className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">{label}</span>
                  {active && (
                    <ChevronRight className="w-3.5 h-3.5 relative z-10 opacity-60" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <main
          className="animate-fade-in-up"
          style={{ animationDelay: "0.3s" }}
        >
          {activeTab === "generation" ? (
            <VoiceGeneration />
          ) : (
            <VoiceAuthentication />
          )}
        </main>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="text-center mt-20 pb-4">
          <p className="text-muted-foreground/40 text-xs tracking-wider uppercase">
            Powered by OpenVoice V2 · AudioSeal · MeloTTS
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
