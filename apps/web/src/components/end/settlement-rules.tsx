import type { TeamView } from "@etic/engine";
import { Boxes, Landmark, type LucideIcon, Scale, ShoppingCart, Truck } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { credits } from "@/lib/format";
import { useTeamView } from "@/lib/game";
import { cn } from "@/lib/utils";
import { netCashOf, unitsLabel } from "./end-math";
import { ScoreFormula } from "./score-formula";
import { SettlementTable } from "./settlement-table";

const advice: { icon: LucideIcon; text: string }[] = [
  {
    icon: Boxes,
    text: "Vendez votre stock tant qu'il est temps : à la clôture, il ne vaut plus rien.",
  },
  {
    icon: Truck,
    text: "Expédiez assez tôt : une livraison encore en route à la clôture n'est pas payée.",
  },
  {
    icon: ShoppingCart,
    text: "N'achetez que ce que vous aurez le temps de produire et de vendre avant la fin.",
  },
  {
    icon: Landmark,
    text: "Remboursez votre emprunt dès que possible : la dette est déduite de toute façon, mais chaque échéance d'intérêts vous coûte encore.",
  },
];

function RulesBlock({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <h3 id={titleId} className="eyebrow font-sans text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** What would count if the game stopped now: net cash, and goods that would be worth nothing. */
function TodaySnapshot({ view }: { view: TeamView }) {
  const { team, warehouseUsed } = view;
  const net = netCashOf(team);
  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
      <div>
        <p className="eyebrow text-muted-foreground">Votre trésorerie nette aujourd'hui</p>
        <p className={cn("tabular mt-1 text-2xl font-semibold", net < 0 && "text-destructive")}>
          {credits(net)}
        </p>
        <p className="tabular text-xs text-muted-foreground">
          Trésorerie {credits(team.cash)} − dette {credits(team.finance.debt)}
        </p>
      </div>
      <div>
        <p className="eyebrow text-muted-foreground">En entrepôt</p>
        <p className="tabular mt-1 text-2xl font-semibold">{unitsLabel(warehouseUsed)}</p>
        <p className="text-xs text-muted-foreground">
          {warehouseUsed > 0
            ? "Matières et produits ne vaudront plus rien à la clôture."
            : "Rien en stock : rien à perdre de ce côté."}
        </p>
      </div>
    </div>
  );
}

function Advice() {
  return (
    <ul className="space-y-3 text-sm">
      {advice.map(({ icon: Icon, text }) => (
        <li key={text} className="flex gap-3">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-pretty">{text}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * What counts at the end of the game (R18, R19, stories 113–114): opened from the final
 * countdown banner, and from the end screen to look back at how the game was settled.
 */
export function SettlementRulesDialog({
  label = "Ce qui compte à la fin",
  variant = "secondary",
}: {
  label?: string;
  variant?: "secondary" | "outline";
}) {
  const view = useTeamView();
  const ended = view?.clock.status === "ended";
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant}>
          <Scale aria-hidden />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl"
      >
        <DialogHeader>
          <p className="eyebrow text-power-red">Clôture de la partie</p>
          <DialogTitle className="font-display text-2xl font-bold uppercase">
            Ce qui compte à la fin
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {ended
              ? "La partie est close : voici comment le score est calculé et comment les engagements en cours ont été soldés."
              : "À la clôture, tout se fige. Seule votre trésorerie nette compte pour l'économie : ce qui n'est ni vendu ni encaissé ne rapporte plus rien."}
          </DialogDescription>
        </DialogHeader>
        {view && !ended ? <TodaySnapshot view={view} /> : null}
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <RulesBlock title="Le score final">
              <ScoreFormula />
            </RulesBlock>
            {ended ? null : (
              <RulesBlock title="Pour bien finir">
                <Advice />
              </RulesBlock>
            )}
          </div>
          <RulesBlock title="Les engagements en cours">
            <SettlementTable />
          </RulesBlock>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button>J'ai compris</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
