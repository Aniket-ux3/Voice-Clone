import { useEffect, useState } from "react";
import { Check, AlertTriangle, Shield, Percent } from "lucide-react";

interface AnalysisResultProps {
  isOriginal: boolean;
  confidence: number;
}

const AnalysisResult = ({ isOriginal, confidence }: AnalysisResultProps) => {
  const [displayed, setDisplayed] = useState(0);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    setDisplayed(0);
    setShowResult(false);
    const steps = 60;
    const increment = confidence / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= confidence) {
        setDisplayed(confidence);
        clearInterval(timer);
        setTimeout(() => setShowResult(true), 300);
      } else {
        setDisplayed(Math.floor(current));
      }
    }, 1500 / steps);
    return () => clearInterval(timer);
  }, [confidence]);

  // SVG gauge — radius adapts for mobile via viewBox scaling
  const R = 80;
  const cx = 96;
  const cy = 96;
  const circumference = 2 * Math.PI * R;
  const dashOffset = circumference * (1 - displayed / 100);

  return (
    <div className="animate-fade-in-up">

      {/* Circular gauge — responsive via max-w */}
      <div className="flex flex-col items-center mb-5 sm:mb-8">
        <div className="relative w-36 h-36 sm:w-48 sm:h-48">
          <svg viewBox="0 0 192 192" className="w-full h-full -rotate-90">
            {/* Track */}
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
            {/* Progress */}
            <circle
              cx={cx} cy={cy} r={R}
              fill="none"
              stroke={isOriginal ? "url(#successGrad)" : "url(#warningGrad)"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-200"
            />
            <defs>
              <linearGradient id="successGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--success))" />
                <stop offset="100%" stopColor="hsl(180, 80%, 50%)" />
              </linearGradient>
              <linearGradient id="warningGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--warning))" />
                <stop offset="100%" stopColor="hsl(var(--accent))" />
              </linearGradient>
            </defs>
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl sm:text-4xl font-bold gradient-text leading-none">{displayed}%</span>
            <span className="text-muted-foreground text-xs sm:text-sm mt-1">Confidence</span>
          </div>
        </div>
      </div>

      {/* Result badge */}
      {showResult && (
        <div className={`flex items-center gap-3 p-3 sm:p-4 rounded-2xl animate-scale-in ${
          isOriginal ? "bg-success/10 border border-success/30 glow-success" : "bg-warning/10 border border-warning/30 glow-warning"
        }`}>
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 ${isOriginal ? "bg-success/20" : "bg-warning/20"}`}>
            {isOriginal
              ? <Check className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
              : <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />}
          </div>
          <div className="min-w-0">
            <p className={`font-semibold text-sm sm:text-base leading-tight ${isOriginal ? "text-success" : "text-warning"}`}>
              {isOriginal ? "Original Voice Detected" : "Synthetic Voice Detected"}
            </p>
            <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
              {isOriginal ? "Appears to be an authentic human recording" : "Shows signs of AI generation"}
            </p>
          </div>
        </div>
      )}

      {/* Details panel */}
      {showResult && (
        <div className="mt-4 sm:mt-6 glass-card p-4 sm:p-5 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <h4 className="text-xs sm:text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            Analysis Details
          </h4>
          <div className="space-y-2.5">
            {[
              { label: "Confidence Level", value: <span className="flex items-center gap-1 font-medium text-xs sm:text-sm"><Percent className="w-3 h-3 text-primary" />{confidence}%</span> },
              { label: "Watermark Status", value: <span className={`font-medium text-xs sm:text-sm ${isOriginal ? "text-success" : "text-warning"}`}>{isOriginal ? "No markers" : "Markers found"}</span> },
              { label: "Analysis Type", value: <span className="font-medium text-foreground text-xs sm:text-sm">AudioSeal Detection</span> },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs sm:text-sm">{label}</span>
                {value}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisResult;
