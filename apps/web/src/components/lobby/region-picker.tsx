import { type Region, regions } from "@etic/content";
import type { CompanySummary } from "@etic/engine";
import { AlertTriangle, Check, MapPin, ThumbsUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useGameCommand } from "@/lib/commands";
import { credits } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import { companyLabel, countLabel, sortTeams } from "./lobby-helpers";

/** The four regions with their advantage, risk and the teams already there (R3, R21). */
export function RegionPicker() {
  const view = useView();
  const { send, pending } = useGameCommand();
  // Lobby commands are allowed while useCanAct() is false: gate them on the lobby itself.
  const editable = view.clock.status === "lobby" && !pending;
  const competitors = sortTeams(Object.values(view.competitors));
  return (
    <ul className="grid gap-5 lg:grid-cols-2">
      {regions.map((region) => (
        <li key={region.id}>
          <RegionCard
            region={region}
            chosen={view.team.region === region.id}
            rivals={competitors.filter((competitor) => competitor.region === region.id)}
            disabled={!editable}
            onChoose={() =>
              send(
                "lobby.chooseRegion",
                { region: region.id },
                { success: `Région choisie : ${region.name}.` },
              )
            }
          />
        </li>
      ))}
    </ul>
  );
}

function RegionCard({
  region,
  chosen,
  rivals,
  disabled,
  onChoose,
}: {
  region: Region;
  chosen: boolean;
  rivals: CompanySummary[];
  disabled: boolean;
  onChoose: () => void;
}) {
  const titleId = `region-${region.id}`;
  const card = (
    <Card
      aria-labelledby={titleId}
      className={cn("h-full gap-4 py-5", chosen && "border-power-red ring-1 ring-power-red")}
    >
      <CardHeader className="gap-1.5 px-5">
        <div className="flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-2xl font-bold uppercase">
            {region.name}
          </h3>
          {chosen ? (
            <Badge className="gap-1">
              <Check aria-hidden />
              Votre région
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{region.summary}</p>
      </CardHeader>
      <CardContent className="grid gap-3 px-5 text-sm">
        <p className="flex gap-2">
          <ThumbsUp className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <span>
            <span className="font-semibold">Atout : </span>
            {region.advantage}
          </span>
        </p>
        <p className="flex gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            <span className="font-semibold">Risque : </span>
            {region.risk}
          </span>
        </p>
        <dl className="grid gap-1 rounded-md bg-muted/60 px-3 py-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Salaire d'un opérateur</dt>
            <dd className="tabular text-right font-medium">
              {credits(region.baseWage)} / 30 jours
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Main-d'œuvre disponible</dt>
            <dd className="tabular text-right font-medium">
              {countLabel(region.laborPool, "personne", "personnes")}
            </dd>
          </div>
        </dl>
        <RivalList rivals={rivals} />
      </CardContent>
      <CardFooter className="mt-auto px-5">
        {chosen ? (
          <p className="text-sm text-muted-foreground">
            Vous pouvez encore changer jusqu'au lancement.
          </p>
        ) : (
          <Button className="w-full" disabled={disabled} onClick={onChoose}>
            <MapPin aria-hidden />
            Choisir {region.name}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
  // The charter's dotted shadow marks the team's current choice (DESIGN.md §5).
  // The wrapper always exists so the card is never remounted when the choice changes.
  return <div className={cn("h-full rounded-xl", chosen && "shadow-dotted")}>{card}</div>;
}

/** Competitors settled in a region: their choices are public (R21). */
function RivalList({ rivals }: { rivals: CompanySummary[] }) {
  return (
    <div className="grid gap-1.5">
      <p className="eyebrow text-muted-foreground">Autres équipes ici</p>
      {rivals.length === 0 ? (
        <p className="text-muted-foreground">Aucune pour l'instant.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {rivals.map((rival) => (
            <li
              key={rival.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
            >
              <Users className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{companyLabel(rival)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
