import { formatReport } from "./report.ts";
import { simulateGame } from "./simulate.ts";

/** `bun run sim [games] [days]`: plays bot games and prints the balancing report (N24). */
const games = Number(process.argv[2] ?? 10);
const days = Number(process.argv[3] ?? 420);
const results = [];
for (let i = 1; i <= games; i++) {
  const started = performance.now();
  results.push(simulateGame(`seed-${i}`, days));
  console.error(`partie ${i}/${games} en ${Math.round(performance.now() - started)} ms`);
}
console.log(formatReport(results));
