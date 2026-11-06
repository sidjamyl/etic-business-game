import { availableCash } from "@etic/engine";
import { PageHeader } from "@/components/game/page-header";
import { regionName } from "@/lib/format";
import { useView } from "@/lib/game";
import { EmployeesCard } from "./employees-card";
import { HireForm } from "./hire-form";
import { PayrollCard } from "./payroll-card";
import { PayrollWarning, StrikeAlert } from "./team-alerts";
import { payrollOutlook, strikeOutlook } from "./team-math";
import { TeamStats } from "./team-stats";

/**
 * Human resources (#29, R6): hiring in the regional pool, employees' wages and efficiency,
 * raises, layoffs, payroll and strikes. Everything is derived from the live team view.
 */
export function TeamPage() {
  const view = useView();
  const { team, clock } = view;
  const day = clock.time.day;
  const employees = Object.values(team.employees);
  const available = availableCash(team);
  const pool = team.region ? (view.market.laborPool[team.region] ?? 0) : 0;
  const strike = strikeOutlook(team.hr, employees, available, day);
  const payroll = payrollOutlook(employees, team.hr, available, day);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Équipe · ${regionName(team.region)}`}
        title="Ressources humaines"
        description="Les opérateurs font tourner vos machines, les logisticiens préparent vos expéditions. Payez-les à temps et pensez à les augmenter."
      />
      {strike ? <StrikeAlert strike={strike} staff={employees.length} /> : null}
      {!strike && payroll.due > 0 && payroll.shortfall > 0 ? (
        <PayrollWarning payroll={payroll} available={available} />
      ) : null}
      <TeamStats employees={employees} pool={pool} />
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <HireForm pool={pool} available={available} />
        <PayrollCard payroll={payroll} strike={strike} available={available} />
      </div>
      <EmployeesCard />
    </div>
  );
}
