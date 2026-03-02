import { useEffect, useState } from "react";
import { Mic, Sparkles, Wand2 } from "lucide-react";

interface ProcessingAnimationProps {
  stages: string[];
  isProcessing: boolean;
}

const ProcessingAnimation = ({ stages, isProcessing }: ProcessingAnimationProps) => {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    if (!isProcessing) {
      setCurrentStage(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStage((prev) => (prev + 1) % stages.length);
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
            
            {/* Sparkle effects */}
            <Sparkles className="absolute -top-3 -right-3 w-5 h-5 text-accent animate-pulse" />
            <Sparkles className="absolute -bottom-2 -left-3 w-4 h-4 text-secondary animate-pulse" style={{ animationDelay: '0.5s' }} />
          </div>
        </div>

        {/* Orbiting dots */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full gradient-bg"
            style={{
              top: '50%',
              left: '50%',
              transform: `rotate(${i * 120}deg) translateX(60px) translateY(-50%)`,
              animation: 'spin-slow 4s linear infinite',
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Processing stage text */}
      <div className="text-center">
        <p className="text-lg font-medium text-foreground mb-2 flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-primary animate-pulse" />
          {stages[currentStage]}
        </p>
        
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {stages.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentStage
                  ? "w-6 gradient-bg"
                  : i < currentStage
                  ? "bg-primary"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Waveform bars at bottom */}
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
    </div>
  );
};

export default ProcessingAnimation;
