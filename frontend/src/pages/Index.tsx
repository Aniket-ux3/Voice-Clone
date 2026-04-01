import { useState, useEffect } from "react";
import {
  Mic, Shield, Sparkles, Trash2, Zap, Fingerprint, Waves, Brain,
  Cpu, X, Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import VoiceGeneration from "@/components/VoiceGeneration";
import VoiceAuthentication from "@/components/VoiceAuthentication";
import { useVoiceStudio } from "@/hooks/useVoiceStudio";
import { voiceAPI } from "@/services/api";

type TabType = "generation" | "authentication";

const SessionBadge = () => (
  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border border-success/30 bg-success/10 text-success">
    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
    <span className="hidden sm:inline">Session Active</span>
  </span>
);

const CpuNoticeBanner = ({ onDismiss }: { onDismiss: () => void }) => (
  <div className="relative flex items-start gap-3 px-4 py-3 rounded-xl border animate-fade-in-up mb-4"
    style={{ background: "hsl(38 92% 50% / 0.08)", borderColor: "hsl(38 92% 50% / 0.25)" }}>
    <Cpu className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-amber-300 mb-0.5">Running on CPU — expect slower generation</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Voice generation takes <span className="text-foreground/70 font-medium">1–3 minutes</span> on CPU.
        Don't close or refresh this tab while processing.
      </p>
    </div>
    <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 p-0.5 rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors">
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
);

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>("generation");
  const { clearAll } = useVoiceStudio();
  const [isCpu, setIsCpu] = useState(false);
  const [cpuBannerVisible, setCpuBannerVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    voiceAPI.healthCheck()
      .then((h) => { if (!cancelled && h.device === "cpu") { setIsCpu(true); setCpuBannerVisible(true); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">

      {/* Ambient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, hsl(var(--gradient-start)) 0%, transparent 70%)" }} />
        <div className="absolute -top-20 right-0 w-[400px] h-[400px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, hsl(var(--gradient-mid)) 0%, transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.013]"
          style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "72px 72px" }} />
      </div>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="relative z-20 sticky top-0 backdrop-blur-lg border-b border-white/5 bg-background/70">
        <div className="container mx-auto px-4 sm:px-6 h-14 flex items-center justify-between max-w-6xl">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-bg flex items-center justify-center glow">
              <Waves className="w-3.5 h-3.5 text-foreground" />
            </div>
            <span className="text-sm font-bold text-foreground/80 tracking-wide uppercase">VoiceStudio</span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {isCpu && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <Cpu className="w-3 h-3" /> CPU Mode
              </span>
            )}
            <SessionBadge />
            <Button variant="ghost" size="sm" onClick={clearAll}
              className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-2 sm:px-3">
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">Clear</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 pt-8 pb-16 max-w-6xl">

        {cpuBannerVisible && <CpuNoticeBanner onDismiss={() => setCpuBannerVisible(false)} />}

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <header className="text-center mb-10 sm:mb-14 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl gradient-bg flex items-center justify-center glow animate-pulse-glow">
              <Mic className="w-8 h-8 sm:w-9 sm:h-9 text-foreground" />
            </div>
            <div className="absolute -top-2 -right-3 w-7 h-7 rounded-full bg-secondary/30 border border-secondary/40 flex items-center justify-center animate-float" style={{ animationDelay: "0s" }}>
              <Brain className="w-3.5 h-3.5 text-secondary" />
            </div>
            <div className="absolute -bottom-1 -left-3 w-6 h-6 rounded-full bg-accent/30 border border-accent/40 flex items-center justify-center animate-float" style={{ animationDelay: "1s" }}>
              <Zap className="w-3 h-3 text-accent" />
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight gradient-text mb-3 sm:mb-4 leading-tight px-2">
            Synthetic Voice Studio
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto leading-relaxed mb-6 px-4">
            Generate high-fidelity voice clones and verify audio authenticity with{" "}
            <span className="text-foreground/80 font-medium">AI-powered watermark detection</span>.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {[
              { icon: Sparkles, label: "Voice Cloning" },
              { icon: Fingerprint, label: "Authentication" },
              { icon: Shield, label: "Watermarks" },
              { icon: Brain, label: "AI-Powered" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-white/10 bg-white/5 text-muted-foreground">
                <Icon className="w-3 h-3 text-primary" />{label}
              </span>
            ))}
          </div>
        </header>

        {/* ── Tab switcher ─────────────────────────────────────────────── */}
        <nav className="flex justify-center mb-8 sm:mb-10 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <div className="glass-card p-1 inline-flex gap-1 rounded-2xl w-full max-w-sm sm:max-w-none sm:w-auto">
            {([
              { id: "generation" as TabType, label: "Voice Generation", short: "Generate", Icon: Sparkles },
              { id: "authentication" as TabType, label: "Voice Authentication", short: "Authenticate", Icon: Shield },
            ]).map(({ id, label, short, Icon }) => {
              const active = activeTab === id;
              return (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`relative flex items-center justify-center gap-2 flex-1 sm:flex-none sm:px-6 px-3 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-300 ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"}`}>
                  {active && <span className="absolute inset-0 rounded-xl gradient-bg glow opacity-90 -z-0" />}
                  <Icon className="w-3.5 h-3.5 relative z-10 shrink-0" />
                  <span className="relative z-10 hidden sm:inline">{label}</span>
                  <span className="relative z-10 sm:hidden">{short}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content ──────────────────────────────────────────────────── */}
        <main className="animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
          {activeTab === "generation" ? <VoiceGeneration /> : <VoiceAuthentication />}
        </main>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="text-center mt-16 pb-2">
          <p className="text-muted-foreground/30 text-xs tracking-wider uppercase">
            Powered by OpenVoice V2 · AudioSeal · MeloTTS
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
