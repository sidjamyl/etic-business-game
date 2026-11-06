import { type ItemId, itemName, type RegionId, regionById } from "@etic/content";

/** Display helpers shared by every screen (French formatting, DESIGN.md §4). */
const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFormat = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 0,
});

/** "₢12 500", or "₢3,60" for non-integer amounts such as unit prices. */
export function credits(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  const value = Math.abs(amount);
  const text = Number.isInteger(Math.round(value * 100) / 100)
    ? integer.format(value)
    : decimal.format(value);
  return `${sign}₢${text}`;
}

/** "+₢1 200" / "−₢300": for changes in money. */
export function signedCredits(delta: number): string {
  return delta > 0 ? `+${credits(delta)}` : credits(delta);
}

export function formatNumber(value: number): string {
  return integer.format(value);
}

/** Ratio (0.85) as "85 %". */
export function percent(ratio: number): string {
  return percentFormat.format(ratio);
}

export function regionName(id: RegionId | null | undefined): string {
  if (!id) return "—";
  return regionById.get(id)?.name ?? id;
}

export function itemLabel(id: ItemId): string {
  return itemName(id);
}

export function dayLabel(day: number): string {
  return `Jour ${day}`;
}

const STEP_NAMES = ["Matin", "Midi", "Après-midi", "Soir"];

/** Name of a sub-step of the day (N5: 4 sub-steps). */
export function stepLabel(step: number, stepsPerDay: number): string {
  if (stepsPerDay === STEP_NAMES.length) return STEP_NAMES[step] ?? "";
  return `${step + 1}/${stepsPerDay}`;
}

/** Real time left for a number of simulated days: "≈ 2 h 15", "≈ 45 min", "< 1 min". */
export function timeLeft(days: number, msPerDay: number): string {
  const minutes = Math.round((days * msPerDay) / 60_000);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `≈ ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `≈ ${hours} h` : `≈ ${hours} h ${String(rest).padStart(2, "0")}`;
}
