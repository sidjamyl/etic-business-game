import { Megaphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { dayLabel, stepLabel } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import { latestFirst } from "./news-feed";

/** Beyond this many announcements, the list scrolls inside the card. */
const SCROLL_FROM = 6;

/**
 * Public announcements, as on the room's screen: start, pauses, auctions, secrets found,
 * end of the game. Latest first.
 */
export function AnnouncementsCard() {
  const { announcements, clock } = useView();
  const items = latestFirst(announcements);
  return (
    <Card>
      <CardHeader>
        <h2 className="eyebrow font-sans text-muted-foreground">Annonces</h2>
        <CardDescription>
          Ce qui est annoncé à toute la salle : pauses, enchères, secrets découverts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune annonce pour l'instant.</p>
        ) : (
          <ScrollArea className={cn("pr-3", items.length > SCROLL_FROM && "h-80")}>
            <ol className="space-y-3">
              {items.map((announcement) => (
                <li key={announcement.id} className="flex gap-3 text-sm">
                  <Megaphone className="mt-0.5 size-4 shrink-0 text-power-red" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-pretty">{announcement.message}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {dayLabel(announcement.day)} ·{" "}
                      {stepLabel(announcement.step, clock.stepsPerDay)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
