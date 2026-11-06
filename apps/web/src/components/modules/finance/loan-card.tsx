import { financeRules } from "@etic/content";
import { borrowingCapacity } from "@etic/engine";
import { HandCoins, TriangleAlert, Undo2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { credits } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import { BorrowForm } from "./borrow-form";
import { type Balance, canBorrow, unpaidInterest } from "./finance-math";
import { RepayForm } from "./repay-form";

/** How much of the loan ceiling is used: the words carry the figures, the bar only shows them. */
function CeilingGauge({ balance, capacity }: { balance: Balance; capacity: number }) {
  const { loanCap } = financeRules;
  const used = Math.min(100, (balance.principal / loanCap) * 100);
  const full = !canBorrow(capacity);
  const unpaid = unpaidInterest(balance);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="text-muted-foreground">Capital emprunté</span>
        <span className="tabular font-medium">
          {credits(balance.principal)} / {credits(loanCap)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn("h-full rounded-full", full ? "bg-warning" : "bg-cacao")}
          style={{ width: `${used}%` }}
        />
      </div>
      {full ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-warning">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {capacity > 0
            ? `Plafond presque atteint : il reste ${credits(capacity)}, moins que l'emprunt minimum.`
            : "Plafond d'emprunt atteint."}
        </p>
      ) : (
        <p className="text-sm">
          Vous pouvez encore emprunter{" "}
          <span className="tabular font-semibold">{credits(capacity)}</span>.
        </p>
      )}
      {unpaid > 0 ? (
        <p className="text-xs text-muted-foreground">
          Votre dette compte aussi {credits(unpaid)} d'intérêts impayés, en plus du capital et hors
          plafond.
        </p>
      ) : null}
    </div>
  );
}

/** Bank loan (R16, N12): borrow up to the ceiling, repay any amount at any time. */
export function LoanCard({ balance }: { balance: Balance }) {
  const { team } = useView();
  const capacity = borrowingCapacity(team);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Prêt bancaire
        </CardTitle>
        <CardDescription>
          Empruntez jusqu'à {credits(financeRules.loanCap)} de capital, par tranches d'au moins{" "}
          {credits(financeRules.minLoan)}. Remboursez quand vous voulez, en une ou plusieurs fois.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <CeilingGauge balance={balance} capacity={capacity} />
        <Tabs defaultValue="borrow">
          <TabsList className="w-full">
            <TabsTrigger value="borrow">
              <HandCoins aria-hidden />
              Emprunter
            </TabsTrigger>
            <TabsTrigger value="repay">
              <Undo2 aria-hidden />
              Rembourser
            </TabsTrigger>
          </TabsList>
          <TabsContent value="borrow" className="pt-3">
            <BorrowForm balance={balance} />
          </TabsContent>
          <TabsContent value="repay" className="pt-3">
            <RepayForm balance={balance} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
