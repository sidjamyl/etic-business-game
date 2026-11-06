import { hrRules } from "@etic/content";
import type { Employee } from "@etic/engine";
import { StatCard, type Tone } from "@/components/game/stat-card";
import { formatNumber, percent, regionName } from "@/lib/format";
import { useView } from "@/lib/game";
import { averageEfficiency, jobCount, plural, raiseOutlook } from "./team-math";

function efficiencyTone(value: number | null): Tone {
  if (value === null || value >= 1) return "default";
  return value < 0.8 ? "danger" : "warning";
}

function logisticsHint(onStrike: boolean, capacity: number, preparedToday: number): string {
  if (onStrike) return "À l'arrêt pendant la grève";
  if (capacity === 0) return "Recrutez des logisticiens pour expédier vos commandes";
  return `${plural(preparedToday, "préparée")} aujourd'hui · ${hrRules.shipmentsPerLogisticianPerDay} par logisticien`;
}

function poolHint(pool: number, region: string, rivals: number): string {
  if (pool === 0) return `Épuisé à ${region}`;
  if (rivals === 0) return `${region}, aucune autre entreprise sur place`;
  return `${region}, partagé avec ${plural(rivals, "autre entreprise", "autres entreprises")}`;
}

/** Key HR figures: staff, operators' efficiency, logistics capacity and the regional pool. */
export function TeamStats({ employees, pool }: { employees: Employee[]; pool: number }) {
  const view = useView();
  const { team, clock } = view;
  const day = clock.time.day;
  const onStrike = team.hr.unpaidWages > 0;
  const atWork = employees.filter((employee) => employee.arrivesOnDay <= day);
  const arriving = employees.length - atWork.length;
  const operators = atWork.filter((employee) => employee.job === "operator");
  const logisticians = atWork.length - operators.length;
  const efficiency = averageEfficiency(operators);
  const toRaise = employees.filter(
    (employee) => raiseOutlook(employee.lastRaiseDay, day).level !== "ok",
  ).length;
  const sameRegion = Object.values(view.competitors).filter(
    (company) => company.region !== null && company.region === team.region,
  ).length;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Effectif"
        value={formatNumber(atWork.length)}
        tone={onStrike && atWork.length > 0 ? "danger" : "default"}
        hint={[
          onStrike && atWork.length > 0 ? "En grève" : null,
          jobCount("operator", operators.length),
          jobCount("logistician", logisticians),
          arriving > 0 ? `${arriving} en route` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <StatCard
        label="Rendement des opérateurs"
        info="workforceEfficiency"
        value={efficiency === null ? "—" : percent(efficiency)}
        tone={efficiencyTone(efficiency)}
        hint={
          toRaise > 0
            ? `${plural(toRaise, "employé")} à augmenter bientôt`
            : "Aucune augmentation urgente"
        }
      />
      <StatCard
        label="Capacité logistique"
        info="logistics"
        value={
          <>
            {formatNumber(view.logisticsCapacity)}
            <span className="text-sm font-normal text-muted-foreground"> expéditions / jour</span>
          </>
        }
        tone={onStrike && logisticians > 0 ? "danger" : "default"}
        hint={logisticsHint(onStrike, view.logisticsCapacity, team.preparedToday)}
      />
      <StatCard
        label="Bassin d'emploi"
        value={
          <>
            {formatNumber(pool)}
            <span className="text-sm font-normal text-muted-foreground">
              {pool > 1 ? " personnes" : " personne"}
            </span>
          </>
        }
        tone={pool === 0 ? "warning" : "default"}
        hint={poolHint(pool, regionName(team.region), sameRegion)}
      />
    </div>
  );
}
