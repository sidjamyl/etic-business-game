import { marketingRules, type ProductId, products, type RegionId, regions } from "@etic/content";
import { type Campaign, campaignCost } from "@etic/engine";
import { Megaphone } from "lucide-react";
import { type ReactNode, useId } from "react";
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
import { credits, itemLabel, regionName } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ALL,
  type CampaignTarget,
  campaignOn,
  endDayOf,
  isDuration,
  onSaleLabel,
  type Pair,
  parseProductChoice,
  parseRegionChoice,
  rangeFactorLabel,
  reaches,
} from "./marketing-math";

/** What every field of the campaign form needs to show the consequences of each choice. */
export interface FieldContext {
  target: CampaignTarget;
  days: number;
  today: number;
  /** Active campaigns. */
  campaigns: readonly Campaign[];
  /** Products on sale, region by region. */
  offers: readonly Pair[];
  available: number;
  home: RegionId | null;
  disabled: boolean;
}

const tiers = [1, 2, 3] as const;

/** A radio option shown as a small card, like the job choice of the hiring form. */
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

/** Price of an option, flagged in words when the available cash cannot pay it. */
function CostLine({ cost, available }: { cost: number; available: number }) {
  return (
    <span className="tabular text-sm font-semibold">
      {credits(cost)}
      {cost > available ? <span className="font-normal text-destructive"> · trop cher</span> : null}
    </span>
  );
}

/** Every region or one of the four, with the cost of each for the chosen product and length. */
export function RegionField({
  context,
  onChange,
}: {
  context: FieldContext;
  onChange: (region: RegionId | null) => void;
}) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const { target, days } = context;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p id={labelId} className="text-sm font-medium">
          Région ciblée
        </p>
        <p className="text-xs text-muted-foreground">
          Coûts pour {target.productId ? itemLabel(target.productId) : "toute la gamme"}, {days}{" "}
          jours
        </p>
      </div>
      <RadioGroup
        aria-labelledby={labelId}
        value={target.region ?? ALL}
        onValueChange={(value) => {
          const region = parseRegionChoice(value);
          if (region !== undefined) onChange(region);
        }}
        disabled={context.disabled}
        className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4"
      >
        <RegionOption
          id={`${baseId}-${ALL}`}
          region={null}
          context={context}
          className="sm:col-span-2 2xl:col-span-4"
        />
        {regions.map((region) => (
          <RegionOption
            key={region.id}
            id={`${baseId}-${region.id}`}
            region={region.id}
            context={context}
          />
        ))}
      </RadioGroup>
    </div>
  );
}

function RegionOption({
  id,
  region,
  context,
  className,
}: {
  id: string;
  region: RegionId | null;
  context: FieldContext;
  className?: string;
}) {
  const option: CampaignTarget = { region, productId: context.target.productId };
  const running = campaignOn(context.campaigns, option);
  const onSale = context.offers.filter((pair) => reaches(option, pair)).length;
  return (
    <ChoiceCard
      id={id}
      value={region ?? ALL}
      selected={context.target.region === region}
      disabled={context.disabled}
      className={className}
    >
      <span className="font-medium">
        {region ? regionName(region) : "Toutes les régions"}
        {region !== null && region === context.home ? (
          <span className="font-normal text-muted-foreground"> · votre région</span>
        ) : null}
      </span>
      <CostLine
        cost={campaignCost(region, option.productId, context.days)}
        available={context.available}
      />
      {running ? (
        <span className="flex items-center gap-1 text-xs font-medium">
          <Megaphone className="size-3 shrink-0" aria-hidden />
          Campagne en cours jusqu'au jour {running.endDay}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">{onSaleLabel(option, onSale)}</span>
      )}
    </ChoiceCard>
  );
}

/** One product or the whole range (2.5 times the price of one product, N14). */
export function ProductField({
  context,
  onChange,
}: {
  context: FieldContext;
  onChange: (productId: ProductId | null) => void;
}) {
  const baseId = useId();
  const selectId = `${baseId}-select`;
  const hintId = `${baseId}-hint`;
  const { target, campaigns } = context;
  const running = (productId: ProductId | null) =>
    campaignOn(campaigns, { region: target.region, productId }) ? (
      <span className="text-xs text-muted-foreground">(campagne en cours)</span>
    ) : null;
  return (
    <div className="space-y-2">
      <Label htmlFor={selectId}>Produit ciblé</Label>
      <Select
        value={target.productId ?? ALL}
        onValueChange={(value) => {
          const productId = parseProductChoice(value);
          if (productId !== undefined) onChange(productId);
        }}
        disabled={context.disabled}
      >
        <SelectTrigger id={selectId} aria-describedby={hintId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>
            Toute la gamme
            {running(null)}
          </SelectItem>
          <SelectSeparator />
          {tiers.map((tier) => (
            <SelectGroup key={tier}>
              <SelectLabel>Palier {tier}</SelectLabel>
              {products
                .filter((product) => product.tier === tier)
                .map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                    {running(product.id)}
                  </SelectItem>
                ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <p id={hintId} className="text-xs text-muted-foreground">
        Toute la gamme couvre les {products.length} produits, pour {rangeFactorLabel()} fois le coût
        d'un seul.
      </p>
    </div>
  );
}

/** 7, 14 or 30 days, with the cost and the last day of each. */
export function DurationField({
  context,
  onChange,
}: {
  context: FieldContext;
  onChange: (days: number) => void;
}) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const hintId = `${baseId}-hint`;
  const { target } = context;
  return (
    <div className="space-y-2">
      <p id={labelId} className="text-sm font-medium">
        Durée
      </p>
      <RadioGroup
        aria-labelledby={labelId}
        aria-describedby={hintId}
        value={String(context.days)}
        onValueChange={(value) => {
          const days = Number(value);
          if (isDuration(days)) onChange(days);
        }}
        disabled={context.disabled}
        className="grid grid-cols-3 gap-2"
      >
        {marketingRules.durations.map((days) => (
          <ChoiceCard
            key={days}
            id={`${baseId}-${days}`}
            value={String(days)}
            selected={context.days === days}
            disabled={context.disabled}
          >
            <span className="font-medium">{days} jours</span>
            <CostLine
              cost={campaignCost(target.region, target.productId, days)}
              available={context.available}
            />
            <span className="tabular text-xs text-muted-foreground">
              Jusqu'au jour {endDayOf(context.today, days)}
            </span>
          </ChoiceCard>
        ))}
      </RadioGroup>
      <p id={hintId} className="text-xs text-muted-foreground">
        La campagne démarre dès son lancement : la journée en cours compte comme premier jour.
      </p>
    </div>
  );
}
