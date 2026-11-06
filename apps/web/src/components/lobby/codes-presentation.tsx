import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Every team's code in very large type, in the projector's colours (DESIGN.md §6): to read
 * them aloud or show them to the room from the organizer's laptop. The public projector
 * screen never shows codes.
 */
export function CodesPresentation({
  gameName,
  teams,
}: {
  gameName: string;
  teams: { id: string; name: string; joinCode: string }[];
}) {
  const few = teams.length <= 4;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Maximize2 aria-hidden />
          Afficher en grand
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="flex h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-8 border-0 bg-power-red p-10 text-milk sm:max-w-[calc(100vw-2rem)]"
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <DialogTitle className="text-4xl font-bold uppercase">Codes d'équipe</DialogTitle>
            <DialogDescription className="mt-2 text-lg text-milk/90">
              {gameName} · Connectez-vous sur{" "}
              <span className="font-semibold">{window.location.host}</span>, puis saisissez le code
              de votre équipe.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button className="bg-milk text-night hover:bg-milk/90">Fermer</Button>
          </DialogClose>
        </div>
        <ul
          className={cn(
            "grid flex-1 content-center gap-x-12 gap-y-8",
            few ? "grid-cols-2" : "grid-cols-3",
          )}
        >
          {teams.map((team) => (
            <li key={team.id} className="min-w-0">
              <p
                className={cn(
                  "font-display font-bold tracking-wider text-milk/80 uppercase",
                  few ? "text-2xl" : "text-lg",
                )}
              >
                {team.name}
              </p>
              <p
                className={cn(
                  "mt-1 font-display leading-none font-bold tracking-wide",
                  few ? "text-7xl" : "text-5xl",
                )}
              >
                {team.joinCode}
              </p>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
