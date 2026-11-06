import { type TransportOption, tradeRules, transportOptions } from "@etic/content";
import { type ReactNode, useId } from "react";
import { TransportImpactBadge } from "@/components/game/impact-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { credits, formatNumber, itemLabel, regionName } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  count,
  type GoodDraft,
  isMaterial,
  isTransportOption,
  type MachineChoice,
  machineNote,
  optionMode,
  optionShortName,
  type Partner,
  type Payer,
  quantityError,
  quoteFor,
  type RouteQuote,
  type StockLine,
  stockHint,
} from "./trade-math";

/** A radio option shown as a small card (same pattern as the hiring and marketing forms). */
function ChoiceCard({
  id,
  value,
  selected,
  disabled,
  className,
  children,
}: {
  id: string;
  value: string;
  selected: boolean;
  disabled: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40",
        selected && "border-primary bg-primary/5 hover:bg-primary/5",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="grid min-w-0 flex-1 gap-0.5">{children}</span>
    </label>
  );
}

/** The other company of the operation: buyer of an offer, recipient of a transfer. */
export function PartnerField({
  label,
  partners,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  partners: readonly Partner[];
  value: string | null;
  onChange: (id: string) => void;
  disabled: boolean;
  hint?: string;
}) {
  const id = useId();
  const hintId = useId();
  const selected = partners.some((partner) => partner.id === value) ? value : null;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={selected ?? ""} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full" aria-describedby={hint ? hintId : undefined}>
          <SelectValue placeholder="Choisir une entreprise" />
        </SelectTrigger>
        <SelectContent>
          {partners.map((partner) => (
            <SelectItem key={partner.id} value={partner.id}>
              {partner.name}
              <span className="text-xs text-muted-foreground">· {regionName(partner.region)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A whole amount in crédits, with its rule or its error underneath. */
export function CreditsField({
  label,
  value,
  onChange,
  disabled,
  error,
  hint,
  min,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error: string | null;
  hint: ReactNode;
  min: number;
  placeholder?: string;
}) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {label}
        <span className="sr-only"> (en crédits)</span>
      </Label>
      <div className="relative w-48">
        <span
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
          aria-hidden
        >
          ₢
        </span>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          step={1}
          placeholder={placeholder}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-invalid={error !== null}
          aria-describedby={hintId}
          className="tabular pl-7"
        />
      </div>
      <p
        id={hintId}
        className={cn("text-xs text-pretty", error ? "text-destructive" : "text-muted-foreground")}
      >
        {error ?? hint}
      </p>
    </div>
  );
}

/**
 * The good of an offer or a gift: raw materials or products with a quantity, or one machine.
 * In a gift, goods reserved by customer orders cannot leave, so they are not offered.
 */
export function GoodFields({
  draft,
  onChange,
  stock,
  machines,
  disabled,
  mode,
}: {
  draft: GoodDraft;
  onChange: (draft: GoodDraft) => void;
  stock: readonly StockLine[];
  machines: readonly MachineChoice[];
  disabled: boolean;
  mode: "offer" | "gift";
}) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const free = machines.filter((choice) => choice.blocked === null).length;
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p id={labelId} className="text-sm font-medium">
          Marchandise
        </p>
        <RadioGroup
          aria-labelledby={labelId}
          value={draft.kind}
          onValueChange={(value) => {
            if (value === "item" || value === "machine") onChange({ ...draft, kind: value });
          }}
          disabled={disabled}
          className="grid grid-cols-2 gap-2"
        >
          <ChoiceCard
            id={`${baseId}-item`}
            value="item"
            selected={draft.kind === "item"}
            disabled={disabled}
          >
            <span className="font-medium">Matières ou produits</span>
            <span className="text-xs text-muted-foreground">
              {stock.length > 0 ? `${count(stock.length, "article")} en stock` : "Entrepôt vide"}
            </span>
          </ChoiceCard>
          <ChoiceCard
            id={`${baseId}-machine`}
            value="machine"
            selected={draft.kind === "machine"}
            disabled={disabled}
          >
            <span className="font-medium">Une machine</span>
            <span className="text-xs text-muted-foreground">
              {machines.length > 0
                ? `${count(free, "libre")} sur ${formatNumber(machines.length)}`
                : "Aucune machine"}
            </span>
          </ChoiceCard>
        </RadioGroup>
      </div>
      {draft.kind === "item" ? (
        <ItemFields
          draft={draft}
          onChange={onChange}
          stock={stock}
          disabled={disabled}
          mode={mode}
        />
      ) : (
        <MachineField draft={draft} onChange={onChange} machines={machines} disabled={disabled} />
      )}
    </div>
  );
}

function StockOption({ line, mode }: { line: StockLine; mode: "offer" | "gift" }) {
  return (
    <SelectItem value={line.item} disabled={mode === "gift" && line.available <= 0}>
      {itemLabel(line.item)}
      <span className="tabular text-xs text-muted-foreground">
        · {formatNumber(line.available)} dispo.
      </span>
    </SelectItem>
  );
}

function ItemFields({
  draft,
  onChange,
  stock,
  disabled,
  mode,
}: {
  draft: GoodDraft;
  onChange: (draft: GoodDraft) => void;
  stock: readonly StockLine[];
  disabled: boolean;
  mode: "offer" | "gift";
}) {
  const itemId = useId();
  const quantityId = useId();
  const hintId = useId();
  const line = stock.find((entry) => entry.item === draft.item) ?? null;
  const error = quantityError(draft.quantity);
  const materials = stock.filter((entry) => isMaterial(entry.item));
  const products = stock.filter((entry) => !isMaterial(entry.item));
  const empty = stock.length === 0;
  return (
    <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="grid gap-1.5">
        <Label htmlFor={itemId}>Article</Label>
        <Select
          value={line ? line.item : ""}
          onValueChange={(value) => {
            const next = stock.find((entry) => entry.item === value);
            if (next) onChange({ ...draft, item: next.item });
          }}
          disabled={disabled || empty}
        >
          <SelectTrigger id={itemId} className="w-full">
            <SelectValue placeholder={empty ? "Entrepôt vide" : "Choisir un article"} />
          </SelectTrigger>
          <SelectContent>
            {materials.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Matières premières</SelectLabel>
                {materials.map((entry) => (
                  <StockOption key={entry.item} line={entry} mode={mode} />
                ))}
              </SelectGroup>
            ) : null}
            {materials.length > 0 && products.length > 0 ? <SelectSeparator /> : null}
            {products.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Produits finis</SelectLabel>
                {products.map((entry) => (
                  <StockOption key={entry.item} line={entry} mode={mode} />
                ))}
              </SelectGroup>
            ) : null}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={quantityId}>Quantité</Label>
        <div className="flex items-center gap-2">
          <Input
            id={quantityId}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="Ex. 100"
            autoComplete="off"
            value={draft.quantity}
            onChange={(event) => onChange({ ...draft, quantity: event.target.value })}
            disabled={disabled || empty}
            aria-invalid={error !== null}
            aria-describedby={hintId}
            className="tabular w-28"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !line || line.available <= 0}
            onClick={() => {
              if (line) onChange({ ...draft, quantity: String(line.available) });
            }}
          >
            Tout
          </Button>
        </div>
      </div>
      <p
        id={hintId}
        className={cn(
          "text-xs sm:col-span-2",
          error ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {error ?? (line ? stockHint(line) : "Choisissez un article de votre entrepôt.")}
      </p>
    </div>
  );
}

function MachineField({
  draft,
  onChange,
  machines,
  disabled,
}: {
  draft: GoodDraft;
  onChange: (draft: GoodDraft) => void;
  machines: readonly MachineChoice[];
  disabled: boolean;
}) {
  const id = useId();
  const hintId = useId();
  const selected = machines.find((choice) => choice.machine.id === draft.machineId) ?? null;
  const none = machines.length === 0;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Machine</Label>
      <Select
        value={selected ? selected.machine.id : ""}
        onValueChange={(value) => onChange({ ...draft, machineId: value })}
        disabled={disabled || none}
      >
        <SelectTrigger id={id} className="w-full" aria-describedby={hintId}>
          <SelectValue placeholder={none ? "Aucune machine" : "Choisir une machine"} />
        </SelectTrigger>
        <SelectContent>
          {machines.map((choice) => (
            <SelectItem
              key={choice.machine.id}
              value={choice.machine.id}
              disabled={choice.blocked !== null}
            >
              {choice.name}
              <span className="tabular text-xs text-muted-foreground">· {machineNote(choice)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id={hintId} className="text-xs text-pretty text-muted-foreground">
        Une machine en plein cycle ne peut pas partir. Elle voyage avec son rendement et compte pour{" "}
        {tradeRules.machineShippingUnits} unités dans le prix du transport.
      </p>
    </div>
  );
}

/** The three transport options with their cost and travel time on this route (R8). */
export function TransportField({
  value,
  onChange,
  quotes,
  estimate,
  disabled,
  hint,
}: {
  value: TransportOption;
  onChange: (option: TransportOption) => void;
  quotes: readonly RouteQuote[] | null;
  /** The cost is an estimate (paid by the other company, whose perks are private). */
  estimate: boolean;
  disabled: boolean;
  hint: string;
}) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const hintId = `${baseId}-hint`;
  return (
    <div className="space-y-2">
      <p id={labelId} className="text-sm font-medium">
        Transport
      </p>
      <RadioGroup
        aria-labelledby={labelId}
        aria-describedby={hintId}
        value={value}
        onValueChange={(next) => {
          if (isTransportOption(next)) onChange(next);
        }}
        disabled={disabled}
        className="grid gap-2 lg:grid-cols-3"
      >
        {transportOptions.map((option) => {
          const quote = quoteFor(quotes, option);
          const mode = optionMode(option);
          return (
            <ChoiceCard
              key={option}
              id={`${baseId}-${option}`}
              value={option}
              selected={value === option}
              disabled={disabled}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{optionShortName(option)}</span>
                <TransportImpactBadge option={option} />
              </span>
              {mode ? <span className="text-xs text-muted-foreground">{mode}</span> : null}
              <span className="tabular text-sm font-semibold">
                {quote ? `${estimate ? "≈ " : ""}${credits(quote.cost)} · ${quote.days} j` : "—"}
              </span>
            </ChoiceCard>
          );
        })}
      </RadioGroup>
      <p id={hintId} className="text-xs text-pretty text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

/** Who pays the transport of an offer: the seller or the buyer (R15). */
export function PayerField({
  value,
  onChange,
  sellerCost,
  buyerCost,
  disabled,
}: {
  value: Payer;
  onChange: (payer: Payer) => void;
  /** Exact: the seller's own perks are known. */
  sellerCost: number | null;
  /** Estimate: the buyer's perks are private. */
  buyerCost: number | null;
  disabled: boolean;
}) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  return (
    <div className="space-y-2">
      <p id={labelId} className="text-sm font-medium">
        Transport payé par
      </p>
      <RadioGroup
        aria-labelledby={labelId}
        value={value}
        onValueChange={(next) => {
          if (next === "seller" || next === "buyer") onChange(next);
        }}
        disabled={disabled}
        className="grid gap-2 sm:grid-cols-2"
      >
        <ChoiceCard
          id={`${baseId}-seller`}
          value="seller"
          selected={value === "seller"}
          disabled={disabled}
        >
          <span className="font-medium">Vous, le vendeur</span>
          <span className="tabular text-xs text-muted-foreground">
            {sellerCost === null ? "Prix compris" : `${credits(sellerCost)} à l'acceptation`}
          </span>
        </ChoiceCard>
        <ChoiceCard
          id={`${baseId}-buyer`}
          value="buyer"
          selected={value === "buyer"}
          disabled={disabled}
        >
          <span className="font-medium">L'acheteur</span>
          <span className="tabular text-xs text-muted-foreground">
            {buyerCost === null ? "En plus du prix" : `≈ ${credits(buyerCost)} en plus du prix`}
          </span>
        </ChoiceCard>
      </RadioGroup>
    </div>
  );
}
