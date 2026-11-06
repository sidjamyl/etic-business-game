import { blackMarketRules } from "@etic/content";
import { availableCash } from "@etic/engine";
import { Ban } from "lucide-react";
import { StatCard } from "@/components/game/stat-card";
import { credits, formatNumber } from "@/lib/format";
import { useView } from "@/lib/game";
import { daysLabel, traceSummary } from "./black-market-math";

const rules = blackMarketRules;

/**
 * Exclusion after a conviction (R13, story 87): buying and selling are closed until the end
 * of `until`; investigations and accusations stay open (engine: requireAccess on deals only).
 */
export function BanBanner({ until, today }: { until: number; today: number }) {
  const left = until - today + 1;
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl bg-power-red px-5 py-4 text-milk"
    >
      <Ban className="mt-1 size-5 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className="font-display text-lg font-bold uppercase">
          Votre entreprise est exclue du marché noir
        </p>
        <p className="text-sm">
          Achats et ventes vous sont fermés jusqu'au jour {until} inclus, encore {daysLabel(left)} :
          retour le jour {until + 1}. Enquêtes et accusations restent possibles.
        </p>
      </div>
    </div>
  );
}

/** Key figures: spendable cash, recent traces, the fine at stake and reputation (R13, R22). */
export function BlackMarketStats() {
  const view = useView();
  const { team } = view;
  const traces = traceSummary(team.blackMarket.traces, view.clock.time.day);
  const exposed = traces.count > 0;
  const { fineMultiplier, minFine } = rules.accusation;
  const fineHint =
    traces.fine > Math.round(traces.gain * fineMultiplier)
      ? `Minimum de ${credits(minFine)} · gain illicite récent : ${credits(traces.gain)}`
      : `${fineMultiplier} × votre gain illicite récent (${credits(traces.gain)})`;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Trésorerie disponible"
        value={credits(availableCash(team))}
        info="availableCash"
        hint={
          team.reservedCash > 0
            ? `${credits(team.reservedCash)} bloqués par vos enchères`
            : "Achats payés comptant, ventes encaissées aussitôt"
        }
      />
      <StatCard
        label="Traces récentes"
        value={formatNumber(view.blackMarket.recentTraces)}
        info="traces"
        tone={exposed ? "warning" : "default"}
        hint={
          traces.clearDay === null
            ? "Rien à trouver sur vous"
            : `Toutes effacées le jour ${traces.clearDay} si vous arrêtez`
        }
      />
      <StatCard
        label="Amende si démasqué"
        value={exposed ? credits(traces.fine) : "—"}
        tone={exposed ? "warning" : "default"}
        hint={exposed ? fineHint : `Aucune affaire ces ${rules.traceDays} derniers jours`}
      />
      <StatCard
        label="Réputation"
        value={`${team.reputation} / 100`}
        info="reputation"
        hint={`−${rules.accusation.reputationPenalty} en cas de condamnation`}
      />
    </div>
  );
}
