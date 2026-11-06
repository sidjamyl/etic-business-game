import type { BotProfile } from "./bots.ts";
import type { GameResult } from "./simulate.ts";

export interface TargetCheck {
  id: number;
  label: string;
  ok: boolean;
  detail: string;
}

const avg = (values: number[]) =>
  values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
const fmt = (value: number) => Math.round(value).toLocaleString("fr-FR");

function salesBetween(sales: number[], from: number, to: number) {
  return avg(sales.slice(from - 1, to));
}

/** Checks the balancing targets agreed in N24 over a set of games. */
export function checkTargets(games: GameResult[]): TargetCheck[] {
  const all = games.flatMap((g) => g.bots);
  const by = (id: BotProfile["id"]) => all.filter((b) => b.profile === id);
  const wins = new Map<string, number>();
  for (const game of games) wins.set(game.winner, (wins.get(game.winner) ?? 0) + 1);
  const maxShare = Math.max(...wins.values()) / games.length;
  const winners = games.map((g) => g.bots.find((b) => b.rank === 1)?.netCash ?? 0);
  const tier2 = all.map((b) => b.tier2Day).filter((d): d is number => d !== null);
  const tier3 = all.map((b) => b.tier3Day).filter((d): d is number => d !== null);
  const soap = games.map((g) => ({
    before: salesBetween(g.dailyOrders.soap, 60, 74),
    during: salesBetween(g.dailyOrders.soap, 78, 94),
  }));
  const water = games.map((g) => ({
    before: salesBetween(g.dailyOrders["bottled-water"], 30, 44),
    during: salesBetween(g.dailyOrders["bottled-water"], 47, 56),
  }));
  const violations = games.flatMap((g) => g.invariantViolations);

  return [
    {
      id: 1,
      label: "Aucun bot compétent en trésorerie nette négative à la fin",
      ok: all.filter((b) => b.profile !== "smuggler").every((b) => b.netCash >= 0),
      detail: `minimum final : ${fmt(Math.min(...all.map((b) => b.netCash)))}`,
    },
    {
      id: 2,
      label: "Aucune stratégie > 70 % des victoires ; Responsable ≥ 1 victoire",
      ok: maxShare <= 0.7 && (wins.get("responsible") ?? 0) >= 1,
      detail: [...wins.entries()].map(([id, n]) => `${id} ${n}`).join(", "),
    },
    {
      id: 3,
      label: "Palier 2 vers les jours 40–80, palier 3 vers les jours 150–230",
      ok:
        tier2.length > 0 &&
        avg(tier2) >= 40 &&
        avg(tier2) <= 80 &&
        tier3.length > 0 &&
        avg(tier3) >= 150 &&
        avg(tier3) <= 230,
      detail: `palier 2 moyen : ${fmt(avg(tier2))}, palier 3 moyen : ${tier3.length ? fmt(avg(tier3)) : "jamais"}`,
    },
    {
      id: 4,
      label: "Trésorerie nette du gagnant entre ₢150 000 et ₢600 000",
      ok: winners.every((v) => v >= 150_000 && v <= 600_000),
      detail: `de ${fmt(Math.min(...winners))} à ${fmt(Math.max(...winners))}`,
    },
    {
      id: 5,
      label: "Impact : Responsable > 65, Contrebande < 30",
      ok:
        avg(by("responsible").map((b) => (b.environmental + b.social) / 2)) > 65 &&
        avg(by("smuggler").map((b) => (b.environmental + b.social) / 2)) < 30,
      detail: `responsable ${fmt(avg(by("responsible").map((b) => (b.environmental + b.social) / 2)))}, contrebande ${fmt(avg(by("smuggler").map((b) => (b.environmental + b.social) / 2)))}`,
    },
    {
      id: 6,
      label: "Les événements font bouger la demande (savon, eau)",
      ok:
        avg(soap.map((s) => s.during)) < avg(soap.map((s) => s.before)) * 0.5 &&
        avg(water.map((w) => w.during)) > avg(water.map((w) => w.before)) * 1.1,
      detail: `savon ${fmt(avg(soap.map((s) => s.before)))} → ${fmt(avg(soap.map((s) => s.during)))} / jour, eau ${fmt(avg(water.map((w) => w.before)))} → ${fmt(avg(water.map((w) => w.during)))} / jour`,
    },
    {
      id: 7,
      label: "Invariants respectés sur toutes les parties",
      ok: violations.length === 0,
      detail: violations.length === 0 ? "aucune violation" : violations.slice(0, 3).join(" ; "),
    },
  ];
}

export function formatReport(games: GameResult[]): string {
  const lines: string[] = [];
  lines.push(
    `# Rapport d'équilibrage — ${games.length} parties de ${games[0]?.days ?? 0} jours`,
    "",
  );
  lines.push(
    "| Bot | Rang moyen | Trésorerie nette moy. | Score moy. | Env. | Social | Palier 2 | Palier 3 | Victoires |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  const ids = [...new Set(games.flatMap((g) => g.bots.map((b) => b.profile)))];
  for (const id of ids) {
    const runs = games.flatMap((g) => g.bots.filter((b) => b.profile === id));
    const t2 = runs.map((b) => b.tier2Day).filter((d): d is number => d !== null);
    const t3 = runs.map((b) => b.tier3Day).filter((d): d is number => d !== null);
    lines.push(
      `| ${id} | ${avg(runs.map((b) => b.rank)).toFixed(1)} | ${fmt(avg(runs.map((b) => b.netCash)))} | ${avg(runs.map((b) => b.final)).toFixed(1)} | ${fmt(avg(runs.map((b) => b.environmental)))} | ${fmt(avg(runs.map((b) => b.social)))} | ${t2.length ? fmt(avg(t2)) : "—"} | ${t3.length ? fmt(avg(t3)) : "—"} | ${games.filter((g) => g.winner === id).length} |`,
    );
  }
  lines.push("", "## Cibles", "");
  for (const check of checkTargets(games)) {
    lines.push(`- ${check.ok ? "✅" : "❌"} **${check.id}. ${check.label}** — ${check.detail}`);
  }
  return lines.join("\n");
}
