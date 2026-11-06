import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type GlossaryKey, glossary } from "@/lib/glossary";

/** A small ⓘ with the glossary explanation of an indicator (R22). */
export function InfoTip({ term }: { term: GlossaryKey }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex align-middle text-muted-foreground hover:text-foreground"
        aria-label="Explication"
      >
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-pretty">{glossary[term]}</TooltipContent>
    </Tooltip>
  );
}
