import type { SpyReport } from "@etic/engine";
import { Link } from "@tanstack/react-router";
import {
  Ban,
  Camera,
  CirclePause,
  EyeOff,
  type LucideIcon,
  OctagonX,
  PackageX,
  Play,
  ScanEye,
  Skull,
  UserX,
  Warehouse,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/game/info-tip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { credits, formatNumber, itemLabel, percent, regionName } from "@/lib/format";
import { useClock } from "@/lib/game";
import {
  relativeDay,
  type StockLine,
  spyMachines,
  spyPrices,
  spyStock,
  tierLabel,
} from "./card-math";
import { Fact } from "./fact";

/** Machine states in the Production module's words, each with its icon. */
const machineStatus: Record<string, { label: string; icon: LucideIcon }> = {
  running: { label: "En production", icon: Play },
  idle: { label: "Inactive", icon: CirclePause },
  "waiting-materials": { label: "Manque de matières", icon: PackageX },
  "waiting-operators": { label: "Manque d'opérateurs", icon: UserX },
  "waiting-space": { label: "Entrepôt plein", icon: Warehouse },
  maintenance: { label: "Maintenance", icon: Wrench },
  strike: { label: "Grève", icon: Ban },
  stopped: { label: "Arrêt forcé", icon: OctagonX },
};

function MachineState({ status }: { status: string }) {
  const known = machineStatus[status];
  const Icon = known?.icon ?? CirclePause;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      {known?.label ?? status}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="eyebrow font-sans text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Nothing({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Machines({ report }: { report: SpyReport }) {
  const machines = spyMachines(report.machines);
  if (machines.length === 0) return <Nothing>Aucune machine.</Nothing>;
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Machine</TableHead>
          <TableHead className="text-right">
            Rendement <InfoTip term="machineEfficiency" />
          </TableHead>
          <TableHead>État</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {machines.map((machine) => (
          <TableRow key={machine.key}>
            <TableCell className="font-medium">{machine.name}</TableCell>
            <TableCell className="tabular text-right">{percent(machine.efficiency)}</TableCell>
            <TableCell>
              <MachineState status={machine.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StockList({ title, empty, lines }: { title: string; empty: string; lines: StockLine[] }) {
  return (
    <div className="rounded-lg border">
      <p className="border-b bg-muted/50 px-3 py-2 text-xs font-medium">{title}</p>
      {lines.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <dl className="divide-y text-sm">
          {lines.map((line) => (
            <div key={line.item} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <dt>{itemLabel(line.item)}</dt>
              <dd className="tabular font-medium">{formatNumber(line.quantity)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Stock({ report }: { report: SpyReport }) {
  const stock = spyStock(report.inventory);
  if (stock.materials.length === 0 && stock.products.length === 0) {
    return <Nothing>Entrepôt vide.</Nothing>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <StockList title="Matières premières" empty="Aucune" lines={stock.materials} />
      <StockList title="Produits finis" empty="Aucun" lines={stock.products} />
    </div>
  );
}

function Prices({ report }: { report: SpyReport }) {
  const grid = spyPrices(report.prices);
  if (grid.rows.length === 0) return <Nothing>Aucun prix fixé : rien en vente.</Nothing>;
  return (
    <Table>
      <TableCaption className="text-left text-xs">
        Prix de vente par unité. « — » : pas en vente dans cette région.
      </TableCaption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Produit</TableHead>
          {grid.regions.map((region) => (
            <TableHead key={region} className="text-right">
              {regionName(region)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {grid.rows.map((row) => (
          <TableRow key={row.product}>
            <TableCell className="font-medium">{itemLabel(row.product)}</TableCell>
            {row.cells.map(({ region, price }) => (
              <TableCell key={region} className="tabular text-right">
                {price === null ? (
                  <span className="text-muted-foreground">
                    <span aria-hidden>—</span>
                    <span className="sr-only">pas en vente</span>
                  </span>
                ) : (
                  credits(price)
                )}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * The spying report (story 92): a competitor's full dashboard, frozen on the day the card was
 * played and kept for the rest of the game. One look only: it is never refreshed.
 */
export function SpyReportView({ report }: { report: SpyReport }) {
  const today = useClock().time.day;
  const { employees } = report;
  const staff = employees.operators + employees.logisticians;
  const traces = report.recentBlackMarketTraces;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-night px-6 py-3 text-milk">
        <p className="eyebrow flex items-center gap-2">
          <ScanEye className="size-4" aria-hidden />
          Rapport d'espionnage
        </p>
        <p className="tabular flex items-center gap-1.5 text-xs">
          <Camera className="size-3.5" aria-hidden />
          Figé au jour {report.day} · {relativeDay(report.day, today)}
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold uppercase">{report.companyName}</h2>
          <p className="flex items-start gap-2 text-sm text-pretty text-muted-foreground">
            <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
            Son tableau de bord tel qu'il était au jour {report.day}. Sa situation a pu changer
            depuis, et elle ignore avoir été espionnée.
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-3">
          <Fact label="Trésorerie" value={credits(report.cash)} />
          <Fact label="Dette" value={credits(report.debt)} />
          <Fact
            label="Trésorerie nette"
            value={credits(report.cash - report.debt)}
            info="netCash"
          />
          <Fact label="Réputation" value={`${report.reputation} / 100`} info="reputation" />
          <Fact label="Progression" value={tierLabel(report.tier, report.branch)} />
          <Fact
            label="Traces de marché noir"
            value={formatNumber(traces)}
            info="traces"
            hint={traces > 0 ? "Récentes, au jour du rapport" : "Aucune trace récente"}
          />
        </dl>

        {traces > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <p className="flex items-start gap-2 text-sm text-pretty">
              <Skull className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              Elle avait des traces de marché noir récentes. Elles s'effacent avec le temps.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/play/marche-noir">Enquêter ou accuser</Link>
            </Button>
          </div>
        ) : null}

        <Section title="Machines">
          <Machines report={report} />
        </Section>

        <div className="grid gap-6 sm:grid-cols-2">
          <Section title="Effectifs">
            {staff === 0 ? (
              <Nothing>Aucun employé au travail.</Nothing>
            ) : (
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Opérateurs</dt>
                <dd className="tabular text-right font-medium">{employees.operators}</dd>
                <dt className="text-muted-foreground">Logisticiens</dt>
                <dd className="tabular text-right font-medium">{employees.logisticians}</dd>
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  Rendement moyen <InfoTip term="workforceEfficiency" />
                </dt>
                <dd className="tabular text-right font-medium">
                  {percent(employees.averageEfficiency)}
                </dd>
              </dl>
            )}
          </Section>
          <Section title="Commandes clients">
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">En attente d'acceptation</dt>
              <dd className="tabular text-right font-medium">{report.pendingOrders}</dd>
              <dt className="text-muted-foreground">Acceptées, en cours</dt>
              <dd className="tabular text-right font-medium">{report.acceptedOrders}</dd>
            </dl>
          </Section>
        </div>

        <Section title="Stocks">
          <Stock report={report} />
        </Section>

        <Section title="Prix de vente">
          <Prices report={report} />
        </Section>
      </div>
    </Card>
  );
}
