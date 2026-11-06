import { deliveryRules } from "@etic/content";
import { availableStock } from "@etic/engine";
import { StatCard } from "@/components/game/stat-card";
import { credits, formatNumber, percent } from "@/lib/format";
import { useView } from "@/lib/game";
import { countAcceptable, orderBook, plural, reputationLevel } from "./sales";

/** Key figures of the module: inbox, orders to deliver, money to collect, reputation. */
export function SalesOverview() {
  const { team, clock } = useView();
  const book = orderBook(team.orders, clock.time.day);
  const acceptable = countAcceptable(book.pending, (productId) => availableStock(team, productId));
  const reputation = Math.round(team.reputation);
  const level = reputationLevel(reputation);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Commandes en attente"
        value={formatNumber(book.pending.length)}
        hint={
          book.pending.length === 0
            ? "Boîte de réception vide"
            : `${plural(acceptable, "acceptable", "acceptables")} avec votre stock`
        }
      />
      <StatCard
        label="À livrer"
        value={formatNumber(book.toDeliver.length)}
        tone={book.late > 0 ? "warning" : "default"}
        hint={
          book.late > 0
            ? `${formatNumber(book.late)} en retard, ${formatNumber(book.toShip)} à expédier`
            : `${formatNumber(book.toShip)} à expédier`
        }
      />
      <StatCard
        label="À encaisser"
        value={credits(book.toCollect)}
        hint={`Payé à la livraison, −${percent(deliveryRules.lateDiscount)} en cas de retard`}
      />
      <StatCard
        label="Réputation"
        value={`${reputation} / 100`}
        info="reputation"
        tone={level.tone}
        hint={level.label}
      />
    </div>
  );
}
