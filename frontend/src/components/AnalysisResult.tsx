import { useEffect, useState } from "react";
import { Check, AlertTriangle, Shield, Percent } from "lucide-react";

interface AnalysisResultProps {
  isOriginal: boolean;
  confidence: number;
}

const AnalysisResult = ({ isOriginal, confidence }: AnalysisResultProps) => {
  const [displayedConfidence, setDisplayedConfidence] = useState(0);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    // Animate the confidence counter
    const duration = 1500;
    const steps = 60;
    const increment = confidence / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= confidence) {
        setDisplayedConfidence(confidence);
        clearInterval(timer);
        setTimeout(() => setShowResult(true), 300);
      } else {
        setDisplayedConfidence(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [confidence]);

  return (
    <div className="animate-fade-in-up">
      {/* Circular gauge */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative w-48 h-48">
          {/* Background circle */}
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="12"
            />
            {/* Progress circle */}
            <circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke={isOriginal ? "url(#successGradient)" : "url(#warningGradient)"}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 88}
              strokeDashoffset={2 * Math.PI * 88 * (1 - displayedConfidence / 100)}
              className="transition-all duration-300"
            />
            <defs>
              <linearGradient id="successGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--success))" />
                <stop offset="100%" stopColor="hsl(180, 80%, 50%)" />
              </linearGradient>
              <linearGradient id="warningGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--warning))" />
                <stop offset="100%" stopColor="hsl(var(--accent))" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold gradient-text">
              {displayedConfidence}%
            </span>
            <span className="text-muted-foreground text-sm mt-1">Confidence</span>
          </div>
        </div>
      </div>

      {/* Result badge */}
      {showResult && (
        <div
          className={`flex items-center justify-center gap-3 p-4 rounded-2xl animate-scale-in ${
            isOriginal
              ? "bg-success/10 border border-success/30 glow-success"
              : "bg-warning/10 border border-warning/30 glow-warning"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isOriginal ? "bg-success/20" : "bg-warning/20"
            }`}
          >
            {isOriginal ? (
              <Check className="w-6 h-6 text-success" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-warning" />
            )}
          </div>
          <div>
            <p className={`font-semibold text-lg ${isOriginal ? "text-success" : "text-warning"}`}>
              {isOriginal ? "Original Voice Detected" : "Synthetic Voice Detected"}
            </p>
            <p className="text-muted-foreground text-sm">
              {isOriginal
                ? "This audio appears to be an authentic human voice"
                : "This audio shows signs of synthetic generation"}
            </p>
          </div>
        </div>
      )}

      {/* Details panel */}
      {showResult && (
        <div className="mt-6 glass-card p-5 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <h4 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Analysis Details
          </h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Confidence Level</span>
              <span className="flex items-center gap-1 text-sm font-medium">
                <Percent className="w-3.5 h-3.5 text-primary" />
                {confidence}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Watermark Status</span>
              <span className={`text-sm font-medium ${isOriginal ? "text-success" : "text-warning"}`}>
                {isOriginal ? "No synthetic markers" : "Synthetic markers found"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Analysis Type</span>
              <span className="text-sm font-medium text-foreground">Deep Voice Analysis</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisResult;
