import { blackMarketRules } from "@etic/content";
import { availableCash, type CompanySummary } from "@etic/engine";
import {
  CircleCheck,
  CircleX,
  FileSearch,
  FileWarning,
  FolderSearch,
  Gavel,
  Hourglass,
  Lock,
  type LucideIcon,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useId } from "react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { EmptyState } from "@/components/game/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useGameCommand } from "@/lib/commands";
import { credits, regionName } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  type AccusationRecord,
  accusationConsequences,
  accusationRecords,
  companyLabel,
  type InvestigationResult,
  investigationsOn,
  nextAccusationDay,
  plural,
  relativeDay,
  type Verdict,
} from "./black-market-math";
import type { GameCommand } from "./deal-dialog";

const rules = blackMarketRules;
const OLDER_RESULTS_SHOWN = 3;

/**
 * One file per competitor (R13, stories 85–88): private investigation results, accusations
 * and their outcome, then the two actions, each confirmed with its consequences.
 */
export function CompetitorDossiers() {
  const view = useView();
  const headingId = useId();
  const competitors = Object.values(view.competitors);
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div>
        <h2 id={headingId} className="text-2xl font-bold uppercase">
          Dossiers concurrents
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Une enquête coûte {credits(rules.investigation.cost)} et son résultat reste entre vous :
          plus une entreprise a laissé de traces récentes, plus vous avez de chances de trouver une
          preuve. Une accusation, elle, est publique… et se retourne contre vous si elle est
          infondée.
        </p>
      </div>
      {competitors.length === 0 ? (
        <EmptyState icon={FolderSearch} title="Aucune autre entreprise dans la partie." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {competitors.map((company) => (
            <DossierCard key={company.id} company={company} />
          ))}
        </div>
      )}
    </section>
  );
}

function DossierCard({ company }: { company: CompanySummary }) {
  const view = useView();
  const command = useGameCommand();
  const { team } = view;
  const today = view.clock.time.day;
  const name = companyLabel(company);
  const results = investigationsOn(team.blackMarket.investigations, company.id);
  const records = accusationRecords(team.log, name);
  const lastAccusation = team.blackMarket.lastAccusations[company.id];
  const nextDay = nextAccusationDay(lastAccusation);
  const waitUntil = nextDay !== null && today < nextDay ? nextDay : null;
  const cash = availableCash(team);
  const affordable = cash >= rules.investigation.cost;
  return (
    <Card className="gap-4">
      <CardHeader>
        <p className="eyebrow text-muted-foreground">
          {regionName(company.region)} · palier {company.tier}
        </p>
        <CardTitle className="font-display text-xl uppercase" role="heading" aria-level={3}>
          {name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <InvestigationResults results={results} today={today} />
        <AccusationStatus
          records={records}
          lastDay={lastAccusation}
          waitUntil={waitUntil}
          today={today}
        />
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <InvestigateAction
          company={company}
          name={name}
          cash={cash}
          disabled={!command.canAct || command.pending || !affordable}
          command={command}
        />
        <AccuseAction
          company={company}
          name={name}
          latest={results[0]}
          disabled={!command.canAct || command.pending || waitUntil !== null}
          command={command}
        />
        {!affordable ? (
          <p className="basis-full text-xs text-muted-foreground">
            Trésorerie disponible insuffisante pour enquêter ({credits(cash)}).
          </p>
        ) : null}
      </CardFooter>
    </Card>
  );
}

/** Private results, latest first: a clean result is never presented as innocence. */
function InvestigationResults({
  results,
  today,
}: {
  results: InvestigationResult[];
  today: number;
}) {
  const [latest, ...older] = results;
  const hidden = older.length - OLDER_RESULTS_SHOWN;
  return (
    <div className="space-y-2">
      <p className="eyebrow flex items-center gap-1.5 text-muted-foreground">
        <Lock className="size-3" aria-hidden />
        Vos enquêtes · résultats privés
      </p>
      <div aria-live="polite">
        {latest ? (
          <div className="rounded-lg border px-3 py-2.5">
            {latest.proofFound ? (
              <p className="flex items-center gap-2 font-semibold text-warning">
                <FileWarning className="size-4 shrink-0" aria-hidden />
                Preuve trouvée
              </p>
            ) : (
              <p className="flex items-center gap-2 font-semibold">
                <FileSearch className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                Rien trouvé
              </p>
            )}
            <p className="tabular text-xs text-muted-foreground">
              Jour {latest.day} · {relativeDay(latest.day, today)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {latest.proofFound
                ? `Les traces s'effacent après ${rules.traceDays} jours : une preuve ancienne peut ne plus suffire.`
                : "Ce qui ne prouve pas son innocence : l'enquête a pu passer à côté."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune enquête pour l'instant.</p>
        )}
      </div>
      {older.length > 0 ? (
        <ul className="tabular space-y-0.5 text-xs text-muted-foreground">
          {older.slice(0, OLDER_RESULTS_SHOWN).map((result) => (
            <li key={result.ordinal}>
              Jour {result.day} : {result.proofFound ? "preuve trouvée" : "rien trouvé"}
            </li>
          ))}
          {hidden > 0 ? (
            <li>{`… et ${plural(hidden, "enquête plus ancienne", "enquêtes plus anciennes")}`}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

const verdicts: Record<Verdict, { icon: LucideIcon; text: string; tone: string }> = {
  confirmed: {
    icon: CircleCheck,
    text: "fondée, l'entreprise a été sanctionnée",
    tone: "text-success",
  },
  unfounded: {
    icon: CircleX,
    text: "infondée, c'est vous qui avez payé",
    tone: "text-warning",
  },
  dismissed: { icon: ShieldCheck, text: "classée sans suite", tone: "text-muted-foreground" },
};

/** Latest accusation and its verdict (stories 86–88), then the cooldown if any. */
function AccusationStatus({
  records,
  lastDay,
  waitUntil,
  today,
}: {
  records: AccusationRecord[];
  lastDay: number | undefined;
  waitUntil: number | null;
  today: number;
}) {
  const latest = records[0];
  const verdict = latest ? verdicts[latest.verdict] : null;
  return (
    <div className="space-y-1.5">
      <p className="eyebrow text-muted-foreground">Vos accusations</p>
      {latest && verdict ? (
        <p className="flex items-start gap-2 text-sm">
          <verdict.icon className={cn("mt-0.5 size-4 shrink-0", verdict.tone)} aria-hidden />
          <span>
            <span className="tabular">Jour {latest.day}</span> : accusation {verdict.text}.
          </span>
        </p>
      ) : lastDay !== undefined ? (
        <p className="tabular text-sm">Dernière accusation : jour {lastDay}.</p>
      ) : (
        <p className="text-sm text-muted-foreground">Vous ne l'avez jamais accusée.</p>
      )}
      {waitUntil !== null ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Hourglass className="size-3.5 shrink-0" aria-hidden />
          Nouvelle accusation possible le jour {waitUntil} ({relativeDay(waitUntil, today)}).
        </p>
      ) : null}
    </div>
  );
}

/** A paid, private investigation (story 85), confirmed before paying. */
function InvestigateAction({
  company,
  name,
  cash,
  disabled,
  command,
}: {
  company: CompanySummary;
  name: string;
  cash: number;
  disabled: boolean;
  command: GameCommand;
}) {
  const cost = rules.investigation.cost;
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline" disabled={disabled}>
          <Search aria-hidden />
          Enquêter · {credits(cost)}
          <span className="sr-only"> sur {name}</span>
        </Button>
      }
      title={`Enquêter sur ${name}`}
      description="Un enquêteur fouille ses affaires. Le résultat tombe aussitôt et reste privé : seule votre équipe le voit."
      consequences={[
        `${credits(cost)} payés maintenant : votre trésorerie disponible passe de ${credits(cash)} à ${credits(cash - cost)}.`,
        `Plus ${name} a laissé de traces ces ${rules.traceDays} derniers jours, plus vous avez de chances de trouver une preuve.`,
        "« Rien trouvé » ne prouve pas son innocence : l'enquête peut passer à côté.",
      ]}
      confirmLabel={`Payer ${credits(cost)} et enquêter`}
      onConfirm={async () => {
        const result = await command.send(
          "blackMarket.investigate",
          { targetTeamId: company.id },
          { success: `Enquête sur ${name} terminée : le résultat est dans son dossier.` },
        );
        return result.ok;
      }}
    />
  );
}

/**
 * A public accusation (stories 86–88): both outcomes, the debt, the amnesty and the cooldown
 * are spelled out before confirming. The verdict arrives through the news and the log.
 */
function AccuseAction({
  company,
  name,
  latest,
  disabled,
  command,
}: {
  company: CompanySummary;
  name: string;
  latest: InvestigationResult | undefined;
  disabled: boolean;
  command: GameCommand;
}) {
  const view = useView();
  const { team } = view;
  return (
    <ConfirmDialog
      tone="danger"
      trigger={
        <Button size="sm" disabled={disabled}>
          <Gavel aria-hidden />
          Accuser…<span className="sr-only"> {name}</span>
        </Button>
      }
      title={`Accuser ${name} publiquement`}
      description="Une accusation est publique et engage votre entreprise : pesez vos preuves avant de la lancer."
      consequences={accusationConsequences({
        name,
        today: view.clock.time.day,
        reputation: team.reputation,
        cash: availableCash(team),
        latest,
      })}
      confirmLabel="Accuser publiquement"
      onConfirm={async () => {
        const result = await command.send("blackMarket.accuse", { targetTeamId: company.id });
        return result.ok;
      }}
    />
  );
}
