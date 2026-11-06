import { Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, MonitorPlay } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The Clipboard API needs HTTPS or localhost: on the local-network fallback (P5, plain HTTP)
 * it is missing, and the link has to be copied from the opened tab instead.
 */
async function copyText(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The projector screen (P10): public, no sign-in. Opens in a new tab, or copies its link. */
export function ProjectorLinks({ gameId }: { gameId: string }) {
  const url = `${window.location.origin}/screen/${gameId}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!(await copyText(url))) {
      toast.error("Copie impossible ici : ouvrez l'écran et copiez l'adresse de l'onglet.");
      return;
    }
    toast.success("Lien de l'écran de la salle copié.");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button asChild variant="secondary">
        <Link to="/screen/$gameId" params={{ gameId }} target="_blank" rel="noreferrer">
          <MonitorPlay aria-hidden />
          Écran de la salle
          <ExternalLink className="size-3.5 opacity-70" aria-hidden />
          <span className="sr-only"> (nouvel onglet)</span>
        </Link>
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Copier le lien de l'écran de la salle"
            onClick={() => void copy()}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{url}</TooltipContent>
      </Tooltip>
    </div>
  );
}
