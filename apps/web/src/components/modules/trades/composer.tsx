import type { TransportOption } from "@etic/content";
import { availableCash } from "@etic/engine";
import { useState } from "react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useGameCommand } from "@/lib/commands";
import { credits } from "@/lib/format";
import { useView } from "@/lib/game";
import { CreditsField, GoodFields, PartnerField, PayerField, TransportField } from "./trade-fields";
import {
  amountError,
  emptyGoodDraft,
  type GoodDraft,
  machineChoices,
  type Payer,
  partnersOf,
  previewGift,
  previewOffer,
  priceError,
  readWhole,
  resolvedLabel,
  resolveGood,
  stockLines,
} from "./trade-math";
import { MessageList, TrustNotice } from "./trade-ui";

export type ComposeMode = "offer" | "goods" | "money";

export function TradeComposer({ mode }: { mode: ComposeMode }) {
  const view = useView();
  const { team, clock } = view;
  const command = useGameCommand();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [draft, setDraft] = useState<GoodDraft>(emptyGoodDraft);
  const [amount, setAmount] = useState("");
  const [option, setOption] = useState<TransportOption>("standard");
  const [payer, setPayer] = useState<Payer>("buyer");
  const partners = partnersOf(view.competitors);
  const partner = partners.find((entry) => entry.id === partnerId) ?? null;
  const stock = stockLines(team);
  const machines = machineChoices(team);
  const good = resolveGood(draft, stock, machines);
  const value = readWhole(amount).value;
  const error =
    mode === "money"
      ? amountError(amount, availableCash(team), team.reservedCash)
      : priceError(amount);
  const offer = previewOffer({
    team,
    buyer: partner,
    good,
    price: value,
    option,
    payer,
    today: clock.time.day,
    endDay: clock.endDay,
    delays: view.market.transportDelays,
  });
  const gift = previewGift({
    team,
    recipient: partner,
    good,
    option,
    today: clock.time.day,
    endDay: clock.endDay,
    delays: view.market.transportDelays,
  });
  const plan = mode === "offer" ? offer : gift;
  const locked = !command.canAct || command.pending;
  const ready =
    mode === "money"
      ? partner !== null && value !== null && value > 0 && !error
      : plan.ready && (mode !== "offer" || !error);
  const label =
    mode === "offer"
      ? "Proposer l'échange"
      : mode === "money"
        ? "Virer l'argent"
        : "Envoyer les marchandises";
  const description =
    mode === "money"
      ? `${credits(value ?? 0)} seront immédiatement virés à ${partner?.name ?? "l'entreprise"}.`
      : `${resolvedLabel(good) ?? "Les marchandises"} pour ${partner?.name ?? "l'entreprise"}${mode === "offer" ? ` au prix total de ${credits(value ?? 0)}` : " sans contrepartie"}.`;
  const submit = async () => {
    if (!ready || locked || !partner) return false;
    let ok = false;
    if (mode === "money" && value !== null)
      ok = (
        await command.send(
          "transfer.money",
          { toTeamId: partner.id, amount: value },
          { success: "Virement effectué." },
        )
      ).ok;
    else if (good.payload && mode === "goods")
      ok = (
        await command.send(
          "transfer.goods",
          { toTeamId: partner.id, good: good.payload, option },
          { success: "Marchandises expédiées." },
        )
      ).ok;
    else if (good.payload && value !== null)
      ok = (
        await command.send(
          "trade.offer",
          {
            buyerTeamId: partner.id,
            good: good.payload,
            price: value,
            option,
            shippingPaidBy: payer,
          },
          { success: "Offre envoyée à l'autre entreprise." },
        )
      ).ok;
    if (ok) {
      setDraft(emptyGoodDraft);
      setAmount("");
    }
    return ok ? undefined : false;
  };
  return (
    <div className="max-w-3xl space-y-5">
      <PartnerField
        label={mode === "offer" ? "Acheteur" : "Destinataire"}
        partners={partners}
        value={partnerId}
        onChange={setPartnerId}
        disabled={locked}
      />
      {mode !== "money" ? (
        <GoodFields
          draft={draft}
          onChange={setDraft}
          stock={stock}
          machines={machines}
          disabled={locked}
          mode={mode === "offer" ? "offer" : "gift"}
        />
      ) : null}
      {mode !== "goods" ? (
        <CreditsField
          label={mode === "offer" ? "Prix total négocié" : "Montant du virement"}
          value={amount}
          onChange={setAmount}
          disabled={locked}
          error={error}
          hint={
            mode === "money"
              ? `${credits(availableCash(team))} disponibles`
              : "Le prix porte sur tout le lot. 0 crédit est autorisé."
          }
          min={mode === "money" ? 1 : 0}
        />
      ) : null}
      {mode !== "money" ? (
        <>
          <TransportField
            value={option}
            onChange={setOption}
            quotes={plan.quotes}
            estimate={mode === "offer" && offer.estimate}
            disabled={locked}
            hint="Les échanges partent sans passer par la file des logisticiens. Les retards d'événements en cours sont inclus."
          />
          {mode === "offer" ? (
            <PayerField
              value={payer}
              onChange={setPayer}
              sellerCost={offer.payerCosts.seller}
              buyerCost={offer.payerCosts.buyer}
              disabled={locked}
            />
          ) : null}
          <MessageList messages={plan.messages} />
          {plan.quote ? (
            <p className="rounded-lg bg-muted p-3 text-sm">
              Transport {mode === "offer" && offer.estimate ? "estimé " : ""}:{" "}
              {credits(plan.quote.cost)} · arrivée au plus tôt le jour {plan.arrivalDay}
              {mode === "offer" ? ` · offre valable jusqu'au jour ${offer.expiresOnDay}` : ""}.
            </p>
          ) : null}
        </>
      ) : null}
      {mode !== "offer" ? (
        <TrustNotice>
          Un don ou un virement ne garantit aucun remboursement. Les engagements se négocient en
          personne.
        </TrustNotice>
      ) : (
        <p className="text-sm text-muted-foreground">
          L'offre ne réserve pas votre stock. À l'acceptation, les marchandises partent et le
          paiement est placé sous séquestre jusqu'à l'arrivée.
        </p>
      )}
      <ConfirmDialog
        title={mode === "offer" ? "Envoyer cette offre ?" : "Confirmer ce transfert ?"}
        description={description}
        consequences={
          mode === "money"
            ? ["Virement immédiat, sans annulation ni contrepartie garantie."]
            : mode === "goods"
              ? [
                  "Le transport est à votre charge. Les marchandises partent immédiatement et ne peuvent pas être rappelées.",
                ]
              : ["L'acheteur peut accepter ou refuser. Vous pouvez retirer une offre en attente."]
        }
        confirmLabel={label}
        trigger={<Button disabled={locked || !ready}>{label}</Button>}
        onConfirm={submit}
      />
    </div>
  );
}
