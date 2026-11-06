import type { JobId } from "@etic/content";
import type { Employee } from "@etic/engine";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  CircleCheck,
  Clock,
  Factory,
  type LucideIcon,
  TrendingDown,
  TrendingUp,
  Truck,
} from "lucide-react";
import { InfoTip } from "@/components/game/info-tip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { credits, percent } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  type EfficiencyTrend,
  type EmployeeStatus,
  efficiencyTrend,
  employeeRef,
  employeeStatus,
  jobLabels,
  machineNames,
  plural,
  type RaiseOutlook,
  raiseOutlook,
  signedPercentValue,
  wageGapPercent,
} from "./team-math";

export interface EmployeeGroup {
  job: JobId;
  employees: Employee[];
}

/** "demain", "dans 8 j": compact delays for table cells. */
const soon = (days: number) => (days <= 1 ? "demain" : `dans ${days} j`);

function Hint({
  icon: Icon,
  tone,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  children: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", tone)}>
      <Icon className="size-3 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

function StatusLabel({
  status,
  inDaysToArrival,
}: {
  status: EmployeeStatus;
  inDaysToArrival: number;
}) {
  if (status === "arriving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Clock className="size-3.5" aria-hidden />
        Arrive {soon(inDaysToArrival)}
      </span>
    );
  }
  if (status === "strike") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        <Ban className="size-3" aria-hidden />
        En grève
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <CircleCheck className="size-3.5 text-success" aria-hidden />
      Au travail
    </span>
  );
}

function Assignment({ employee, machine }: { employee: Employee; machine: string | undefined }) {
  if (employee.job === "logistician") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Truck className="size-3.5 text-muted-foreground" aria-hidden />
        Expéditions
      </span>
    );
  }
  if (machine) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Factory className="size-3.5 text-muted-foreground" aria-hidden />
        {machine}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      Aucune machine ·{" "}
      <Link to="/play/production" className="underline underline-offset-4 hover:text-foreground">
        affecter
      </Link>
    </span>
  );
}

/** Wage against the regional base for new hires (events included): sign and arrow, not colour alone. */
function WageGap({ gap }: { gap: number | null }) {
  if (gap === null) return null;
  if (gap === 0) return <span className="text-xs text-muted-foreground">= base régionale</span>;
  return gap > 0 ? (
    <Hint icon={ArrowUp} tone="text-success">{`base ${signedPercentValue(gap)}`}</Hint>
  ) : (
    <Hint icon={ArrowDown} tone="text-warning">{`base ${signedPercentValue(gap)}`}</Hint>
  );
}

const trendHints: Record<Exclude<EfficiencyTrend, "stable">, [LucideIcon, string, string]> = {
  recovering: [TrendingUp, "text-success", "remonte"],
  dropping: [TrendingDown, "text-destructive", "en baisse"],
  floor: [TrendingDown, "text-destructive", "au plancher"],
};

function Trend({ trend }: { trend: EfficiencyTrend }) {
  if (trend === "stable") return null;
  const [icon, tone, text] = trendHints[trend];
  return (
    <Hint icon={icon} tone={tone}>
      {text}
    </Hint>
  );
}

/** Warning as the grace period without a raise ends, then the next drop (R6, story 47). */
function RaiseHint({ outlook }: { outlook: RaiseOutlook }) {
  switch (outlook.level) {
    case "ok":
      return null;
    case "soon":
      return (
        <Hint icon={Clock} tone="text-warning">{`fin du délai ${soon(outlook.graceLeft)}`}</Hint>
      );
    case "due":
      return (
        <Hint icon={AlertTriangle} tone="text-warning">
          {outlook.nextDropIn === null ? "à augmenter" : `baisse ${soon(outlook.nextDropIn)}`}
        </Hint>
      );
    case "dropping":
      return (
        <Hint icon={TrendingDown} tone="text-destructive">
          {outlook.nextDropIn === null
            ? "à augmenter"
            : `nouvelle baisse ${soon(outlook.nextDropIn)}`}
        </Hint>
      );
    case "floor":
      return (
        <Hint icon={AlertTriangle} tone="text-destructive">
          augmentation urgente
        </Hint>
      );
  }
}

function EmployeeRow({
  employee,
  day,
  onStrike,
  base,
  machine,
  selected,
  onSelect,
}: {
  employee: Employee;
  day: number;
  onStrike: boolean;
  base: number;
  machine: string | undefined;
  selected: boolean;
  onSelect: (ids: readonly string[], on: boolean) => void;
}) {
  const outlook = raiseOutlook(employee.lastRaiseDay, day);
  const status = employeeStatus(employee, day, onStrike);
  const checkboxId = `employee-${employee.id}`;
  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      <TableCell>
        <Checkbox
          id={checkboxId}
          checked={selected}
          onCheckedChange={(checked) => onSelect([employee.id], checked === true)}
        />
      </TableCell>
      <TableCell>
        <label htmlFor={checkboxId} className="cursor-pointer font-medium">
          {jobLabels[employee.job].one}{" "}
          <span className="tabular font-normal text-muted-foreground">
            {employeeRef(employee.id)}
          </span>
        </label>
        <div className="tabular text-xs text-muted-foreground">
          Recruté jour {employee.hiredOnDay}
        </div>
      </TableCell>
      <TableCell>
        <StatusLabel status={status} inDaysToArrival={employee.arrivesOnDay - day} />
      </TableCell>
      <TableCell>
        <Assignment employee={employee} machine={machine} />
      </TableCell>
      <TableCell className="text-right">
        <div className="tabular font-medium">{credits(employee.wage)}</div>
        <WageGap gap={wageGapPercent(employee.wage, base)} />
      </TableCell>
      <TableCell className="text-right">
        <div
          className={cn("tabular font-medium", status === "arriving" && "text-muted-foreground")}
        >
          {percent(employee.efficiency)}
        </div>
        <Trend trend={efficiencyTrend(employee.efficiency, outlook)} />
      </TableCell>
      <TableCell className="text-right">
        <div className="tabular">{outlook.daysSinceRaise} j</div>
        <RaiseHint outlook={outlook} />
      </TableCell>
    </TableRow>
  );
}

/**
 * Employees grouped by job (story 47): status, assignment, wage against the regional base,
 * efficiency and days without a raise. Checkboxes feed the raise and layoff actions.
 */
export function EmployeesTable({
  groups,
  selection,
  onSelect,
}: {
  groups: EmployeeGroup[];
  selection: ReadonlySet<string>;
  onSelect: (ids: readonly string[], on: boolean) => void;
}) {
  const view = useView();
  const { team, clock } = view;
  const day = clock.time.day;
  const onStrike = team.hr.unpaidWages > 0;
  const machines = machineNames(team.machines);
  const visibleIds = groups.flatMap((group) => group.employees.map((employee) => employee.id));
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selection.has(id));

  return (
    <Table>
      <TableCaption className="sr-only">
        Employés de l'entreprise, regroupés par métier
      </TableCaption>
      <TableHeader className="bg-muted/70">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-10">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => onSelect(visibleIds, checked === true)}
              aria-label="Sélectionner tous les employés affichés"
            />
          </TableHead>
          <TableHead>Employé</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Affectation</TableHead>
          <TableHead className="text-right">Salaire / 30 j</TableHead>
          <TableHead className="text-right">
            <span className="inline-flex items-center gap-1">
              Rendement
              <InfoTip term="workforceEfficiency" />
            </span>
          </TableHead>
          <TableHead className="text-right">Sans augmentation</TableHead>
        </TableRow>
      </TableHeader>
      {groups.map((group) => {
        const ids = group.employees.map((employee) => employee.id);
        const groupSelected = ids.every((id) => selection.has(id));
        const arriving = group.employees.filter((employee) => employee.arrivesOnDay > day).length;
        return (
          <TableBody key={group.job}>
            <TableRow className="bg-secondary/40 hover:bg-secondary/40">
              <TableCell>
                <Checkbox
                  checked={groupSelected}
                  onCheckedChange={(checked) => onSelect(ids, checked === true)}
                  aria-label={`Sélectionner tous les ${jobLabels[group.job].many.toLowerCase()}`}
                />
              </TableCell>
              <TableHead scope="rowgroup" colSpan={6} className="h-9">
                <span className="eyebrow">{jobLabels[group.job].many}</span>
                <span className="tabular ml-2 text-xs font-normal text-muted-foreground">
                  {plural(group.employees.length, "personne")}
                  {arriving > 0 ? ` dont ${arriving} en route` : ""} · base régionale{" "}
                  {credits(view.wages[group.job])} / 30 j
                </span>
              </TableHead>
            </TableRow>
            {group.employees.map((employee) => (
              <EmployeeRow
                key={employee.id}
                employee={employee}
                day={day}
                onStrike={onStrike}
                base={view.wages[employee.job]}
                machine={employee.machineId ? machines.get(employee.machineId) : undefined}
                selected={selection.has(employee.id)}
                onSelect={onSelect}
              />
            ))}
          </TableBody>
        );
      })}
    </Table>
  );
}
