import { useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleDashed, Hourglass } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { regionName } from "@/lib/format";
import { useView } from "@/lib/game";
import { useTRPC } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { countLabel, readinessItems, sortTeams } from "./lobby-helpers";
import { ReadinessList, ReadyBadge } from "./readiness";

/** The team's checklist (member, name, region) and the wait for the organizer (R21). */
export function LaunchStatusCard() {
  const view = useView();
  const { team } = view;
  const items = readinessItems({
    memberCount: Object.keys(team.members).length,
    companyName: team.companyName,
    region: team.region,
  });
  const left = items.filter((item) => !item.done).length;
  const competitors = Object.values(view.competitors);
  const total = competitors.length + 1;
  const readyTeams = competitors.filter((company) => company.ready).length + (left === 0 ? 1 : 0);
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">Prêts pour le lancement ?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ReadinessList items={items} />
        <p
          className={cn(
            "flex items-center gap-2 text-sm font-medium",
            left === 0 ? "text-success" : "text-warning",
          )}
        >
          {left === 0 ? (
            <CircleCheck className="size-4 shrink-0" aria-hidden />
          ) : (
            <CircleDashed className="size-4 shrink-0" aria-hidden />
          )}
          {left === 0
            ? "Votre équipe est prête."
            : `Encore ${countLabel(left, "étape", "étapes")} avant d'être prêts.`}
        </p>
        <div role="status" className="rounded-lg bg-night px-4 py-3 text-milk">
          <p className="flex items-center gap-2 font-display text-sm font-bold uppercase">
            <Hourglass className="size-4 shrink-0 motion-safe:animate-pulse" aria-hidden />
            En attente du lancement par l'organisateur
          </p>
          <p className="tabular mt-2 text-sm opacity-90">
            {readyTeams} équipe{readyTeams > 1 ? "s" : ""} prête{readyTeams > 1 ? "s" : ""} sur{" "}
            {total}
          </p>
          <Progress
            value={(readyTeams / total) * 100}
            aria-label="Équipes prêtes"
            className="mt-2 h-1.5 bg-milk/20"
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** Members of the team and its code, for teammates who have not joined yet (stories 3, 7). */
export function TeamMembersCard() {
  const view = useView();
  const trpc = useTRPC();
  // Already cached by the route guard: no extra request.
  const me = useQuery(trpc.session.queryOptions()).data?.id;
  const members = Object.values(view.team.members);
  const full = members.length >= view.memberCap;
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">
          Votre équipe · {view.team.name}
        </CardTitle>
        <CardAction>
          <span className="tabular text-sm text-muted-foreground">
            {members.length}/{view.memberCap}
            <span className="sr-only"> membres au maximum</span>
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center gap-2.5 text-sm">
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold"
              >
                {Array.from(member.name.trim())[0]?.toUpperCase() ?? "?"}
              </span>
              <span className="truncate">{member.name}</span>
              {member.userId === me ? (
                <span className="text-xs text-muted-foreground">(vous)</span>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="rounded-lg border border-dashed px-3 py-2.5">
          <p className="eyebrow text-muted-foreground">Code de l'équipe</p>
          <p className="mt-1 font-display text-2xl font-bold tracking-wider select-all">
            {view.team.joinCode}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {full
              ? "Équipe complète : ce code est désormais refusé."
              : "À donner aux coéquipiers qui n'ont pas encore rejoint."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** The other companies' public choices and readiness (R21, story 17). */
export function CompetitorsCard() {
  const view = useView();
  const competitors = sortTeams(Object.values(view.competitors));
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">Les autres équipes</CardTitle>
      </CardHeader>
      <CardContent>
        {competitors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune autre équipe dans cette partie.</p>
        ) : (
          <ul className="divide-y">
            {competitors.map((company) => (
              <li
                key={company.id}
                className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {company.companyName ?? (
                      <span className="text-muted-foreground italic">Nom à venir</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {company.name} ·{" "}
                    {company.region ? regionName(company.region) : "région à choisir"} ·{" "}
                    {countLabel(company.memberCount, "membre", "membres")}
                  </p>
                </div>
                <ReadyBadge ready={company.ready} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
