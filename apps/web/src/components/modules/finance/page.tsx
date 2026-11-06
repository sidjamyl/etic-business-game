import { PageHeader } from "@/components/game/page-header";
import { useView } from "@/lib/game";
import { balanceOf } from "./finance-math";
import { FinanceStats } from "./finance-stats";
import { InterestCard } from "./interest-card";
import { LedgerCard } from "./ledger-card";
import { LoanCard } from "./loan-card";
import { TotalsCard } from "./totals-card";

/**
 * Finance (#33, R16, N12): cash, debt and net cash; bank loan and repayments with their
 * interest preview; next interest day; the ledger of every movement and the totals per
 * category (stories 105–109). Everything is derived from the live team view.
 */
export function FinancePage() {
  const { team } = useView();
  const balance = balanceOf(team);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Trésorerie, grand livre et prêts"
        description="Suivez chaque entrée et sortie d'argent, empruntez pour financer votre croissance et remboursez quand vous voulez. À la fin, seule la trésorerie nette compte."
      />
      <FinanceStats balance={balance} />
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <LoanCard balance={balance} />
        <InterestCard balance={balance} />
      </div>
      <LedgerCard />
      <TotalsCard />
    </div>
  );
}
