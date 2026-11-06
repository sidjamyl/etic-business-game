import { useMutation } from "@tanstack/react-query";
import { ArrowRightLeft, UserMinus, UserRound } from "lucide-react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type AdminStreamView, useAdminGameId } from "@/lib/admin";
import { regionName } from "@/lib/format";
import { useTRPC } from "@/lib/trpc";
import { CopyButton } from "./copy-button";
import { readinessItems } from "./lobby-helpers";
import { runOrganizerAction } from "./organizer-action";
import { ReadinessChips, ReadyBadge } from "./readiness";

export type AdminTeam = AdminStreamView["companies"][string];
type Member = AdminTeam["members"][number];

/** One team in the organizer's lobby: its code to hand out, choices, readiness and members. */
export function AdminTeamCard({
  team,
  teams,
  memberCap,
}: {
  team: AdminTeam;
  teams: AdminTeam[];
  memberCap: number;
}) {
  const items = readinessItems({
    memberCount: team.members.length,
    companyName: team.companyName,
    region: team.region,
  });
  return (
    <Card className="h-full gap-4 py-5">
      <CardHeader className="px-5">
        <h3 className="text-lg leading-none font-bold uppercase">{team.name}</h3>
        <CardDescription className="truncate">
          {team.companyName ?? "Nom d'entreprise à venir"} ·{" "}
          {team.region ? regionName(team.region) : "région à choisir"}
        </CardDescription>
        <CardAction>
          <ReadyBadge ready={team.ready} />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        <div className="flex items-start justify-between gap-3 rounded-lg bg-background/60 px-4 py-3 ring-1 ring-border">
          <div className="min-w-0">
            <p className="eyebrow text-muted-foreground">Code à distribuer</p>
            <p className="mt-1 font-display text-4xl leading-none font-bold tracking-wide select-all 2xl:text-5xl">
              {team.joinCode}
            </p>
          </div>
          <CopyButton
            text={team.joinCode}
            label={`Copier le code de ${team.name}`}
            copiedMessage={`Code de ${team.name} copié.`}
          />
        </div>
        <ReadinessChips items={items} />
        <MemberList team={team} teams={teams} memberCap={memberCap} />
      </CardContent>
    </Card>
  );
}

/** Members with the organizer's corrections: move to another team or remove (P7, story 9). */
function MemberList({
  team,
  teams,
  memberCap,
}: {
  team: AdminTeam;
  teams: AdminTeam[];
  memberCap: number;
}) {
  const gameId = useAdminGameId();
  const trpc = useTRPC();
  const move = useMutation(trpc.admin.moveMember.mutationOptions());
  const remove = useMutation(trpc.admin.removeMember.mutationOptions());
  const busy = move.isPending || remove.isPending;
  const others = teams.filter((other) => other.id !== team.id);
  const full = team.members.length >= memberCap;

  const moveTo = (member: Member, target: AdminTeam) =>
    runOrganizerAction(
      () => move.mutateAsync({ gameId, userId: member.userId, toTeamId: target.id }),
      `${member.name} rejoint ${target.name}.`,
    );

  const removeMember = async (member: Member) => {
    const ok = await runOrganizerAction(
      () => remove.mutateAsync({ gameId, userId: member.userId }),
      `${member.name} ne fait plus partie de ${team.name}.`,
    );
    return ok ? undefined : false;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="eyebrow text-muted-foreground">Membres</p>
        <p className="tabular text-xs text-muted-foreground">
          {team.members.length}/{memberCap}
          {full ? " · complète" : ""}
        </p>
      </div>
      {team.members.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-3 text-center text-sm text-muted-foreground">
          Personne n'a encore rejoint cette équipe.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {team.members.map((member) => (
            <li key={member.userId} className="flex items-center gap-1 py-1 pr-1 pl-3">
              <UserRound className="mr-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{member.name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="xs" disabled={busy || others.length === 0}>
                    <ArrowRightLeft aria-hidden />
                    Déplacer
                    <span className="sr-only"> {member.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                {/* Portals render outside the organizer's dark wrapper: keep the dark theme. */}
                <DropdownMenuContent align="end" className="dark min-w-52">
                  <DropdownMenuLabel>Déplacer {member.name} vers…</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {others.map((other) => {
                    const otherFull = other.members.length >= memberCap;
                    return (
                      <DropdownMenuItem
                        key={other.id}
                        disabled={otherFull}
                        onSelect={() => void moveTo(member, other)}
                      >
                        <span className="min-w-0 flex-1 truncate">{other.name}</span>
                        <span className="tabular text-xs text-muted-foreground">
                          {otherFull ? "complète" : `${other.members.length}/${memberCap}`}
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="xs" disabled={busy}>
                    <UserMinus aria-hidden />
                    Retirer
                    <span className="sr-only"> {member.name}</span>
                  </Button>
                }
                title={`Retirer ${member.name} ?`}
                description={`${member.name} quittera ${team.name} et perdra aussitôt l'accès à son entreprise.`}
                consequences={[
                  "Ce compte pourra rejoindre une équipe avec un code.",
                  "Utile pour un compte abandonné, par exemple après un mot de passe oublié.",
                ]}
                confirmLabel="Retirer"
                tone="danger"
                onConfirm={() => removeMember(member)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
