import { StatCard } from "@/components/game/stat-card";
import { credits, signedCredits } from "@/lib/format";
import { useView } from "@/lib/game";
import {
  availableOf,
  type Balance,
  dayNet,
  interestOn,
  netCashOf,
  unpaidInterest,
} from "./finance-math";

/** Cash, available cash, debt and net cash at a glance (story 105). */
export function FinanceStats({ balance }: { balance: Balance }) {
  const { team, clock } = useView();
  const ledger = team.finance.ledger;
  // The ledger is in time order: its last movement tells whether money moved today.
  const movedToday = ledger.at(-1)?.day === clock.time.day;
  const today = dayNet(ledger, clock.time.day);
  const net = netCashOf(balance);
  const unpaid = unpaidInterest(balance);
  const dueDay = team.finance.nextInterestDay;
  const interestAhead =
    clock.status !== "ended" && (clock.endDay === null || dueDay <= clock.endDay);

  const debtHint =
    balance.debt <= 0
      ? "Aucun emprunt en cours"
      : unpaid > 0
        ? `dont ${credits(unpaid)} d'intérêts impayés`
        : interestAhead
          ? `Intérêts : ${credits(interestOn(balance.debt))} le jour ${dueDay}`
          : "Plus d'intérêts d'ici la fin";

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Trésorerie"
        value={credits(balance.cash)}
        hint={movedToday ? `Aujourd'hui : ${signedCredits(today)}` : "Aucun mouvement aujourd'hui"}
      />
      <StatCard
        label="Trésorerie disponible"
        value={credits(availableOf(balance))}
        info="availableCash"
        hint={
          balance.reservedCash > 0
            ? `${credits(balance.reservedCash)} bloqués par vos enchères`
            : "Rien n'est bloqué par des enchères"
        }
      />
      <StatCard
        label="Dette"
        value={credits(balance.debt)}
        tone={balance.debt > 0 ? "warning" : "default"}
        hint={debtHint}
      />
      <StatCard
        label="Trésorerie nette"
        value={credits(net)}
        info="netCash"
        tone={net < 0 ? "danger" : "default"}
        hint={
          net < 0
            ? "Négative : aucun point au score économique"
            : net === 0
              ? "Nulle : aucun point au score économique"
              : "Trésorerie − dette : c'est elle qui compte à la fin"
        }
      />
    </div>
  );
}
