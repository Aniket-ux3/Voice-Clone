import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuickTipProps {
  tip: string;
}

const QuickTip = ({ tip }: QuickTipProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted/50 hover:bg-primary/20 transition-colors">
          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        className="max-w-xs bg-popover/95 backdrop-blur-xl border-white/10 text-sm"
      >
        <p>{tip}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default QuickTip;
