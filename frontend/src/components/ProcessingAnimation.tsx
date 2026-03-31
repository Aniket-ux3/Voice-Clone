import { useEffect, useState } from "react";
import { Mic, Sparkles, Wand2, Cpu } from "lucide-react";

interface ProcessingAnimationProps {
  stages: string[];
  isProcessing: boolean;
  /** Optional message shown when processing takes longer than expected (CPU mode). */
  longWaitMessage?: string;
}

const ProcessingAnimation = ({
  stages,
  isProcessing,
  longWaitMessage,
}: ProcessingAnimationProps) => {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    if (!isProcessing) {
      setCurrentStage(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStage((prev) => (prev < stages.length - 1 ? prev + 1 : prev));
    }, 2000);

    return () => clearInterval(interval);
  }, [isProcessing, stages.length]);

  if (!isProcessing) return null;

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-fade-in-up">
      {/* Main animation container */}
      <div className="relative w-32 h-32 mb-8">
        {/* Outer rotating ring */}
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30 animate-spin-slow" />

        {/* Middle gradient ring */}
        <div
          className="absolute inset-2 rounded-full animate-pulse-glow"
          style={{
            background: `conic-gradient(
              from 0deg,
              hsl(var(--gradient-start)) 0%,
              hsl(var(--gradient-mid)) 33%,
              hsl(var(--gradient-end)) 66%,
              hsl(var(--gradient-start)) 100%
            )`,
          }}
        />

        {/* Inner dark circle */}
        <div className="absolute inset-3 rounded-full bg-background flex items-center justify-center">
          <div className="relative">
            <Mic className="w-10 h-10 text-primary animate-float" />
            <Sparkles className="absolute -top-3 -right-3 w-5 h-5 text-accent animate-pulse" />
            <Sparkles
              className="absolute -bottom-2 -left-3 w-4 h-4 text-secondary animate-pulse"
              style={{ animationDelay: "0.5s" }}
            />
          </div>
        </div>

        {/* Orbiting dots */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full gradient-bg"
            style={{
              top: "50%",
              left: "50%",
              transform: `rotate(${i * 120}deg) translateX(60px) translateY(-50%)`,
              animation: "spin-slow 4s linear infinite",
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Processing stage text */}
      <div className="text-center">
        <p className="text-lg font-medium text-foreground mb-2 flex items-center gap-2 justify-center">
          <Wand2 className="w-5 h-5 text-primary animate-pulse" />
          {stages[currentStage]}
        </p>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {stages.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentStage
                  ? "w-6 gradient-bg"
                  : i < currentStage
                  ? "w-2 bg-primary"
                  : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Waveform bars */}
      <div className="flex items-end justify-center gap-1 h-8 mt-8">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="waveform-bar animate-wave"
            style={{
              height: "100%",
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      {/* CPU long-wait nudge — appears after caller sets this prop */}
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
};

export default ProcessingAnimation;
