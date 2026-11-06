import { easterEggs } from "@etic/content";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Factory, Users } from "lucide-react";
import { EndScreen } from "@/components/end/end-screen";
import { ActivityLog } from "@/components/game/activity-log";
import { PageHeader } from "@/components/game/page-header";
import { StatCard } from "@/components/game/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { credits, formatNumber, regionName, score } from "@/lib/format";
import { useView } from "@/lib/game";

export const Route = createFileRoute("/play/")({
  component: Dashboard,
});

/** Company overview (#26): key figures, activity log, secrets found. */
function Dashboard() {
  const view = useView();
  if (view.clock.status === "ended") return <EndScreen />;
  const { team } = view;
  const orders = Object.values(team.orders);
  const pending = orders.filter((order) => order.status === "pending").length;
  const machines = Object.values(team.machines);
  const running = machines.filter((machine) => machine.status === "running").length;
  const employees = Object.values(team.employees).filter(
    (employee) => employee.arrivesOnDay <= view.clock.time.day,
  );
  const reserved = team.reservedCash > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${regionName(team.region)} · palier ${team.progression.unlockedTier}`}
        title={team.companyName ?? team.name}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Trésorerie"
          value={credits(team.cash)}
          info="availableCash"
          hint={reserved ? `${credits(team.cash - team.reservedCash)} disponibles` : undefined}
        />
        <StatCard
          label="Dette"
          value={credits(team.finance.debt)}
          tone={team.finance.debt > 0 ? "warning" : "default"}
          info="netCash"
          hint={`Net : ${credits(team.cash - team.finance.debt)}`}
        />
        <StatCard
          label="Entrepôt"
          value={`${formatNumber(view.warehouseUsed)} / ${formatNumber(team.warehouse.capacity)}`}
          info="warehouse"
          tone={view.warehouseUsed >= team.warehouse.capacity * 0.9 ? "warning" : "default"}
        />
        <StatCard
          label="Commandes"
          value={formatNumber(orders.length)}
          hint={`${pending} en attente d'acceptation`}
        />
        <StatCard label="Réputation" value={`${score(team.reputation)} / 100`} info="reputation" />
        <StatCard
          label="Environnement"
          value={`${score(view.impact.environmental)} / 100`}
          info="environmental"
        />
        <StatCard label="Social" value={`${score(view.impact.social)} / 100`} info="social" />
        <StatCard
          label="Machines"
          value={`${running} / ${machines.length}`}
          hint={
            team.hr.unpaidWages > 0
              ? "Grève : salaires impayés"
              : `${employees.length} employé(s) au travail`
          }
          tone={team.hr.unpaidWages > 0 ? "danger" : "default"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="eyebrow text-muted-foreground">Journal de l'entreprise</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityLog />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="eyebrow text-muted-foreground">Raccourcis</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Link to="/play/production" className="flex items-center gap-2 hover:underline">
                <Factory className="size-4" aria-hidden /> Production
              </Link>
              <Link to="/play/equipe" className="flex items-center gap-2 hover:underline">
                <Users className="size-4" aria-hidden /> Équipe
              </Link>
            </CardContent>
          </Card>
          {team.badges.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="eyebrow text-muted-foreground">Secrets découverts</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {team.badges.map((badge) => (
                  <Badge key={badge} variant="secondary" className="gap-1">
                    <Award className="size-3" aria-hidden />
                    {easterEggs.find((egg) => egg.id === badge)?.name ?? badge}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
