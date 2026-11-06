import {
  materialSupplierById,
  materialSuppliers,
  type NewsSource,
  type RegionId,
  type ScenarioEffect,
  type ScenarioEvent,
  scenarioEvents,
  scenarioNews,
} from "@etic/content";
import { allocateId, logTeam } from "../log.ts";
import type { GameSystem } from "../systems.ts";
import type { GameState, NewsItem } from "../types.ts";

/** Publishes a news item (scenario or secret card). */
export function publishNews(
  state: GameState,
  item: { source: NewsSource; region: RegionId | null; title: string; body: string },
  origin: NewsItem["origin"],
): NewsItem {
  const news: NewsItem = {
    id: allocateId(state),
    day: state.time.day,
    step: state.time.step,
    ...item,
    origin,
  };
  state.news.push(news);
  return news;
}

/** Combined supplier conditions from the running events. */
export function supplierConditions(state: GameState, supplierId: string) {
  let priceFactor = 1;
  let stockFactor = 1;
  let outage = false;
  for (const effect of Object.values(state.market.supplierEffects)) {
    if (!effect.supplierIds.includes(supplierId)) continue;
    priceFactor *= effect.priceFactor;
    stockFactor *= effect.stockFactor;
    outage ||= effect.outage;
  }
  return { priceFactor, stockFactor, outage };
}

function resolveSuppliers(target: {
  supplierIds?: string[] | undefined;
  material?: string | undefined;
  region?: string | undefined;
}): string[] {
  return materialSuppliers
    .filter(
      (s) =>
        (target.supplierIds === undefined || target.supplierIds.includes(s.id)) &&
        (target.material === undefined || s.material === target.material) &&
        (target.region === undefined || s.region === target.region),
    )
    .map((s) => s.id);
}

/** Recomputes supplier prices and applies stock cuts after effects change. */
function refreshSuppliers(state: GameState): void {
  for (const supplier of materialSuppliers) {
    const market = state.market.suppliers[supplier.id];
    if (!market) continue;
    const { priceFactor, stockFactor, outage } = supplierConditions(state, supplier.id);
    market.priceFactor = priceFactor;
    if (outage) market.stock = 0;
    else market.stock = Math.min(market.stock, Math.floor(supplier.restock.level * stockFactor));
  }
}

function applyEffect(
  state: GameState,
  key: string,
  effect: ScenarioEffect,
  untilDay: number | null,
) {
  const day = state.time.day;
  switch (effect.kind) {
    case "demand":
      state.market.demandModifiers[key] = {
        id: key,
        region: effect.region,
        productId: effect.productId,
        factor: effect.factor,
        untilDay,
      };
      return;
    case "supplierOutage":
    case "supplierPrice":
    case "supplierStock":
      state.market.supplierEffects[key] = {
        supplierIds: resolveSuppliers(effect.target),
        priceFactor: effect.kind === "supplierPrice" ? effect.factor : 1,
        stockFactor: effect.kind === "supplierStock" ? effect.factor : 1,
        outage: effect.kind === "supplierOutage",
        untilDay,
      };
      refreshSuppliers(state);
      return;
    case "transportDelay":
      state.market.transportDelays[key] = {
        region: effect.region,
        extraDays: effect.extraDays,
        untilDay,
      };
      // Shipments already on the road to or from the region are delayed too.
      for (const team of Object.values(state.teams)) {
        for (const shipment of Object.values(team.shipments)) {
          const touches = team.region === effect.region || shipment.destination === effect.region;
          if (shipment.status === "in-transit" && touches && shipment.arrivesOnDay !== null) {
            shipment.arrivesOnDay += effect.extraDays;
          }
        }
      }
      return;
    case "wage":
      state.market.wageFactor[effect.region] =
        (state.market.wageFactor[effect.region] ?? 1) * effect.factor;
      return;
    case "breakdown":
      for (const team of Object.values(state.teams)) {
        if (team.region !== effect.region) continue;
        for (const machine of Object.values(team.machines)) {
          machine.stoppedUntilDay = Math.max(machine.stoppedUntilDay ?? 0, day + effect.days);
        }
        logTeam(state, team.id, {
          kind: "event",
          message: `Vos machines sont arrêtées ${effect.days} jour(s) par mesure de sécurité.`,
        });
      }
      return;
    case "recovery":
      state.market.recoveryShiftDays[effect.tier] += effect.shiftDays;
      return;
  }
}

function fireEvent(state: GameState, event: ScenarioEvent): void {
  const day = state.time.day;
  for (const [index, effect] of event.effects.entries()) {
    const days = ("days" in effect ? effect.days : undefined) ?? event.durationDays;
    const untilDay = days ? day + days - 1 : null;
    applyEffect(state, `${event.id}:${index}`, effect, untilDay);
  }
  state.scenario.active[event.id] = {
    title: event.title,
    startDay: day,
    endDay: event.durationDays ? day + event.durationDays - 1 : null,
  };
}

/** Removes expired supplier and transport effects; refills suppliers whose outage ended. */
function expireEffects(state: GameState): void {
  const day = state.time.day;
  let suppliersChanged = false;
  const reopened = new Set<string>();
  for (const [key, effect] of Object.entries(state.market.supplierEffects)) {
    if (effect.untilDay === null || day <= effect.untilDay) continue;
    if (effect.outage) for (const id of effect.supplierIds) reopened.add(id);
    delete state.market.supplierEffects[key];
    suppliersChanged = true;
  }
  for (const [key, delay] of Object.entries(state.market.transportDelays)) {
    if (delay.untilDay !== null && day > delay.untilDay) delete state.market.transportDelays[key];
  }
  for (const [id, event] of Object.entries(state.scenario.active)) {
    if (event.endDay !== null && day > event.endDay) delete state.scenario.active[id];
  }
  if (!suppliersChanged) return;
  refreshSuppliers(state);
  for (const id of reopened) {
    const supplier = materialSupplierById.get(id);
    const market = state.market.suppliers[id];
    if (!supplier || !market) continue;
    const { stockFactor, outage } = supplierConditions(state, id);
    if (!outage)
      market.stock = Math.max(market.stock, Math.floor(supplier.restock.level * stockFactor));
  }
}

/** Publishes due news and fires due events (scheduled, automatic: Q4, R11, R12). */
function runSchedule(state: GameState): void {
  const day = state.time.day;
  for (const news of scenarioNews) {
    if (news.day > day || state.scenario.done[news.id]) continue;
    state.scenario.done[news.id] = true;
    const { source, region, title, body } = news;
    publishNews(state, { source, region, title, body }, { kind: "scenario", ref: news.id });
  }
  for (const event of scenarioEvents) {
    if (event.day > day || state.scenario.done[event.id]) continue;
    state.scenario.done[event.id] = true;
    fireEvent(state, event);
  }
}

export const scenarioSystem: GameSystem = {
  name: "scenario",
  onDay: (draft) => expireEffects(draft),
  onStep: (draft) => runSchedule(draft),
};
