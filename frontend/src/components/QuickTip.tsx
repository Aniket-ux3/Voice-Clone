import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuickTipProps {
  tip: string;
}

/**
 * QuickTip — shows a help tooltip on desktop, and a tappable inline
 * popover on mobile (since hover-based tooltips don't work reliably on touch).
 */
const QuickTip = ({ tip }: QuickTipProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop: standard hover tooltip */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="hidden sm:inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted/50 hover:bg-primary/20 transition-colors ml-1 shrink-0"
            aria-label="Show tip"
            onClick={(e) => e.preventDefault()}
          >
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[240px] bg-popover/95 backdrop-blur-xl border-white/10 text-xs"
        >
          <p>{tip}</p>
        </TooltipContent>
      </Tooltip>

      {/* Mobile: tap to toggle inline tip */}
      <button
        className="sm:hidden inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted/50 active:bg-primary/30 transition-colors ml-1 shrink-0"
        aria-label="Show tip"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen
          ? <X className="w-3 h-3 text-primary" />
          : <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {/* Inline expanded tip on mobile */}
      {mobileOpen && (
        <div className="sm:hidden w-full mt-2 px-3 py-2 rounded-lg bg-primary/8 border border-primary/20 animate-fade-in-up">
          <p className="text-xs text-primary/90 leading-relaxed">{tip}</p>
        </div>
      )}
    </>
  );
};

export default QuickTip;
