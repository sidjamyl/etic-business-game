import { Ban, Gavel, Leaf, Skull, Spade, Users } from "lucide-react";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/game/info-tip";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { credits, formatNumber, percent, regionName } from "@/lib/format";
import type { GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";
import { Pill, SectionTitle } from "./bits";
import {
  type AdminCompany,
  cardInfo,
  companyLabel,
  formatIndicator,
  hasBlackMarketActivity,
  inventorySummary,
  machineSummary,
  plural,
  ratingTone,
  tierLabel,
} from "./control-room-helpers";

/** The company column stays in view when the table scrolls sideways on a small laptop. */
const stickyColumn = "sticky left-0 z-10 bg-card pl-5";

/** Main value of a cell and an optional muted second line. */
function Cell({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <>
      <div>{children}</div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </>
  );
}

function Header({
  children,
  info,
  numeric = false,
  className,
}: {
  children: ReactNode;
  info?: GlossaryKey;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <TableHead className={cn("text-muted-foreground", numeric && "text-right", className)}>
      {info ? (
        <span className="inline-flex items-center gap-1">
          {children} <InfoTip term={info} />
        </span>
      ) : (
        children
      )}
    </TableHead>
  );
}

function Nothing({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Total stock, with the detail per good on hover or focus (story 126). */
function StockCell({ inventory }: { inventory: AdminCompany["inventory"] }) {
  const { total, lines } = inventorySummary(inventory);
  if (total === 0) return <Nothing label="Entrepôt vide" />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="tabular cursor-help underline decoration-dotted underline-offset-4"
        >
          {formatNumber(total)}
          <span className="sr-only"> unités en stock</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <ul className="space-y-0.5">
          {lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-6">
              <span>{line.label}</span>
              <span className="tabular">{formatNumber(line.quantity)}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function ImpactCell({ environmental, social }: { environmental: number; social: number }) {
  return (
    <span className="inline-flex gap-1.5">
      <Pill
        tone={ratingTone(environmental)}
        icon={Leaf}
        title={`Environnement : ${formatIndicator(environmental)}/100`}
      >
        <span className="sr-only">Environnement </span>
        <span className="tabular">{formatIndicator(environmental)}</span>
      </Pill>
      <Pill
        tone={ratingTone(social)}
        icon={Users}
        title={`Social : ${formatIndicator(social)}/100`}
      >
        <span className="sr-only">Social </span>
        <span className="tabular">{formatIndicator(social)}</span>
      </Pill>
    </span>
  );
}

function StaffCell({ employees }: { employees: AdminCompany["employees"] }) {
  const count = formatNumber(employees.count);
  if (employees.onStrike) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Pill tone="danger" icon={Ban}>
          Grève
        </Pill>
        {count}
      </span>
    );
  }
  return (
    <Cell hint={employees.count > 0 ? `rend. ${percent(employees.averageEfficiency)}` : undefined}>
      {count}
    </Cell>
  );
}

function BlackMarketCell({ activity }: { activity: AdminCompany["blackMarket"] }) {
  if (!hasBlackMarketActivity(activity)) return <Nothing label="Aucune activité" />;
  return (
    <Cell
      hint={`achats ${formatNumber(activity.purchasedUnits)} · ventes ${formatNumber(activity.soldUnits)}`}
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1">
          <Skull className="size-3.5 text-muted-foreground" aria-hidden />
          {plural(activity.recentTraces, "trace")}
        </span>
        {activity.convictions > 0 ? (
          <Pill tone="danger" icon={Gavel}>
            {plural(activity.convictions, "condamnation")}
          </Pill>
        ) : null}
      </span>
    </Cell>
  );
}

function CardCell({ card }: { card: AdminCompany["card"] }) {
  const info = cardInfo(card);
  if (!info) return <Nothing label="Aucune carte" />;
  return (
    <Cell hint={info.used ? "jouée" : "pas encore jouée"}>
      <span
        className={cn("inline-flex items-center gap-1.5", info.used && "text-muted-foreground")}
      >
        <Spade className="size-3.5 shrink-0" aria-hidden />
        {info.name}
      </span>
    </Cell>
  );
}

function CompanyRow({ company }: { company: AdminCompany }) {
  const machines = machineSummary(company.machines);
  const reserved = company.availableCash < company.cash;
  return (
    <TableRow>
      <TableCell className={stickyColumn}>
        <Cell hint={`${company.name} · ${regionName(company.region)}`}>
          <span className="block max-w-52 truncate font-medium" title={companyLabel(company)}>
            {companyLabel(company)}
          </span>
        </Cell>
      </TableCell>
      <TableCell className="tabular text-right">
        <Cell hint={reserved ? `dispo ${credits(company.availableCash)}` : undefined}>
          {credits(company.cash)}
        </Cell>
      </TableCell>
      <TableCell className="tabular text-right">
        {company.debt > 0 ? (
          <span className="text-warning">{credits(company.debt)}</span>
        ) : (
          <Nothing label="Aucune dette" />
        )}
      </TableCell>
      <TableCell className="tabular text-right">{credits(company.revenue)}</TableCell>
      <TableCell className="tabular text-right">{formatIndicator(company.reputation)}</TableCell>
      <TableCell>
        <ImpactCell environmental={company.environmental} social={company.social} />
      </TableCell>
      <TableCell className="tabular">{tierLabel(company.tier, company.branch)}</TableCell>
      <TableCell className="text-right">
        <StockCell inventory={company.inventory} />
      </TableCell>
      <TableCell className="tabular text-right">
        <Cell
          hint={
            machines.averageEfficiency === null
              ? undefined
              : `rend. ${percent(machines.averageEfficiency)}`
          }
        >
          {machines.running}/{machines.total}
          <span className="sr-only"> en marche</span>
        </Cell>
      </TableCell>
      <TableCell className="tabular text-right">
        <StaffCell employees={company.employees} />
      </TableCell>
      <TableCell className="tabular text-right">
        <Cell hint={`${formatNumber(company.orders.pending)} en attente`}>
          {plural(company.orders.accepted, "acceptée")}
        </Cell>
      </TableCell>
      <TableCell>
        <BlackMarketCell activity={company.blackMarket} />
      </TableCell>
      <TableCell className="pr-5">
        <CardCell card={company.card} />
      </TableCell>
    </TableRow>
  );
}

/**
 * Every company live (N22, story 126): cash, debt, revenue, reputation, impact, tier, stocks,
 * machines, staff, orders, black-market activity and secret card. Organizer only.
 */
export function CompaniesTable({ companies }: { companies: readonly AdminCompany[] }) {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <SectionTitle>Entreprises</SectionTitle>
        <CardDescription>
          Toutes les entreprises en direct, avec ce que les équipes ignorent les unes des autres :
          de quoi animer la journée et préparer le débriefing.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <caption className="sr-only">Situation en direct de chaque entreprise</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <Header className={stickyColumn}>Entreprise</Header>
              <Header numeric info="availableCash">
                Trésorerie
              </Header>
              <Header numeric>Dette</Header>
              <Header numeric>
                <span title="Chiffre d'affaires" aria-hidden>
                  CA
                </span>
                <span className="sr-only">Chiffre d'affaires</span>
              </Header>
              <Header numeric>Réputation</Header>
              <Header info="impact">Impact</Header>
              <Header>Palier</Header>
              <Header numeric>Stocks</Header>
              <Header numeric>Machines</Header>
              <Header numeric>Employés</Header>
              <Header numeric>Commandes</Header>
              <Header info="traces">Marché noir</Header>
              <Header className="pr-5">Carte</Header>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((company) => (
              <CompanyRow key={company.id} company={company} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
