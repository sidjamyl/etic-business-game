import {
  type Branch,
  equipmentSupplierById,
  hrRules,
  type MaterialId,
  machineTypeById,
  materialSuppliers,
  type ProductId,
  productById,
  products,
  type RegionId,
  regions,
  type TransportOption,
  travelDays,
} from "@etic/content";
import { shippingDays } from "../modules/delivery.ts";
import { cycleMaterials } from "../modules/production.ts";
import { canProduce, milestoneProgress } from "../modules/progression.ts";
import { localPrice } from "../modules/sales.ts";
import { availableCash, freeSpace } from "../modules/shared.ts";
import { nextFloat, nextInt, type RngState } from "../rng.ts";
import type { Command, GameState, TeamState } from "../types.ts";

/** A playing style (N24). Bots only read their own company and public market data. */
export interface BotProfile {
  id: "cautious" | "aggressive" | "smuggler" | "responsible";
  name: string;
  region: RegionId;
  supplierChoice: "cheap" | "ethical";
  equipmentSupplier: string;
  transport: TransportOption;
  /** Price as a share of the local price. */
  priceFactor: number;
  /** Sells in regions up to this many travel days away. */
  marketReach: number;
  loanAtStart: number;
  /** Days between 5% raises; null = never. */
  raiseEvery: number | null;
  branch: Branch;
  blackMarket: boolean;
  /** Cash kept aside before investing. */
  cashBuffer: number;
  /** Highest tier the bot tries to reach. */
  maxTier: 1 | 2 | 3;
}

export const botProfiles: BotProfile[] = [
  {
    id: "cautious",
    name: "Prudente",
    region: "ferronia",
    supplierChoice: "cheap",
    equipmentSupplier: "ferro-machines",
    transport: "standard",
    priceFactor: 1,
    marketReach: 1,
    loanAtStart: 0,
    raiseEvery: 58,
    branch: "leisure",
    blackMarket: false,
    cashBuffer: 15_000,
    maxTier: 2,
  },
  {
    id: "aggressive",
    name: "Agressive",
    region: "azura",
    supplierChoice: "cheap",
    equipmentSupplier: "ferro-machines",
    transport: "express",
    priceFactor: 0.92,
    marketReach: 4,
    loanAtStart: 30_000,
    raiseEvery: null,
    branch: "tech",
    blackMarket: false,
    cashBuffer: 5_000,
    maxTier: 3,
  },
  {
    id: "smuggler",
    name: "Contrebande",
    region: "port-libre",
    supplierChoice: "cheap",
    equipmentSupplier: "ferro-machines",
    transport: "standard",
    priceFactor: 1,
    marketReach: 2,
    loanAtStart: 10_000,
    raiseEvery: null,
    branch: "leisure",
    blackMarket: true,
    cashBuffer: 8_000,
    maxTier: 3,
  },
  {
    id: "responsible",
    name: "Responsable",
    region: "nordhaven",
    supplierChoice: "ethical",
    equipmentSupplier: "nordic-equipment",
    transport: "green",
    priceFactor: 1.05,
    marketReach: 3,
    loanAtStart: 0,
    raiseEvery: 55,
    branch: "leisure",
    blackMarket: false,
    cashBuffer: 10_000,
    maxTier: 3,
  },
];

/** Which machine type a bot buys for each product (one product per machine). */
const MACHINE_FOR: Record<ProductId, string> = {
  bread: "oven",
  "bottled-water": "bottling-line",
  soap: "soap-vat",
  clothing: "textile-workshop",
  "packaged-meal": "oven",
  kettle: "assembly-line",
  laptop: "tech-line",
  console: "leisure-line",
};

/** Products worth producing now: unlocked and with customers soon. */
function targetProducts(state: GameState, team: TeamState, profile: BotProfile): ProductId[] {
  const day = state.time.day;
  // Enter higher tiers once their demand has started, one product at a time (every 30 days).
  const allowed = {
    1: 3,
    2: day < 100 ? 0 : 1 + Math.floor((day - 100) / 30),
    3: day < 220 ? 0 : 1,
  };
  const count = { 1: 0, 2: 0, 3: 0 };
  return products
    .filter((p) => p.tier <= profile.maxTier && canProduce(team, p.id))
    .filter((p) => {
      if (count[p.tier] >= allowed[p.tier]) return false;
      count[p.tier] += 1;
      return true;
    })
    .map((p) => p.id);
}

function pickSupplier(
  state: GameState,
  profile: BotProfile,
  material: MaterialId,
  quantity: number,
) {
  const candidates = materialSuppliers
    // Partial purchases are fine: any supplier with at least one cycle's worth.
    .filter(
      (s) => s.material === material && (state.market.suppliers[s.id]?.stock ?? 0) >= quantity,
    )
    .sort((a, b) =>
      profile.supplierChoice === "ethical"
        ? b.ethics.environmental + b.ethics.social - (a.ethics.environmental + a.ethics.social)
        : a.price - b.price,
    );
  return candidates[0];
}

/** Commands a bot sends at the start of a day. */
export function botTurn(
  state: GameState,
  teamId: string,
  profile: BotProfile,
  rng: RngState,
): Command[] {
  const team = state.teams[teamId];
  if (!team?.region) return [];
  const day = state.time.day;
  const commands: Command[] = [];
  // Day-to-day spending uses all the available cash; investments keep a safety buffer.
  let operating = availableCash(team);
  const operate = (amount: number) => {
    if (amount > operating) return false;
    operating -= amount;
    return true;
  };
  // Investments keep the safety buffer and two months of payroll in cash.
  const monthlyPayroll = Object.values(team.employees).reduce((sum, e) => sum + e.wage, 0);
  const reserve = Math.max(profile.cashBuffer, 2 * monthlyPayroll);
  const spend = (amount: number) => {
    if (amount > operating - reserve) return false;
    operating -= amount;
    return true;
  };
  let budget = operating - profile.cashBuffer;

  if (day === 1 && profile.loanAtStart > 0) {
    commands.push({ type: "finance.borrow", payload: { amount: profile.loanAtStart } });
    operating += profile.loanAtStart;
    budget += profile.loanAtStart;
  }
  // Borrow rather than let a strike freeze the company.
  const nextPayroll = Object.values(team.employees).reduce((sum, e) => sum + e.wage, 0);
  const capacity = Math.max(0, 30_000 - team.finance.principal);
  const shortfall = team.hr.unpaidWages + nextPayroll - availableCash(team);
  if (shortfall > 0 && capacity >= 1_000) {
    const amount = Math.min(capacity, Math.max(1_000, Math.ceil(shortfall / 1_000) * 1_000));
    commands.push({ type: "finance.borrow", payload: { amount } });
    operating += amount;
  }
  if (team.finance.debt > 0 && team.cash > 120_000) {
    commands.push({ type: "finance.repay", payload: { amount: team.finance.debt } });
  }

  // Progression: invest as soon as the milestone is met and cash allows (R2).
  const milestone = milestoneProgress(team);
  if (
    milestone &&
    milestone.tier <= profile.maxTier &&
    !team.progression.project &&
    milestone.sold >= milestone.required &&
    spend(milestone.cost)
  ) {
    commands.push({
      type: "progression.invest",
      payload:
        milestone.tier === 3 ? { tier: 3, branch: profile.branch } : { tier: milestone.tier },
    });
  }

  const targets = targetProducts(state, team, profile);
  const pendingMachineTypes = Object.values(team.inbound)
    .filter((s) => s.kind === "machine")
    .map((s) => (s.kind === "machine" ? s.machineTypeId : ""));

  // Machines: one per target product.
  const machineForProduct = new Map<ProductId, string>();
  const freeMachines = Object.values(team.machines).filter((m) => !m.job && !m.cycle);
  for (const productId of targets) {
    const busy = Object.values(team.machines).find(
      (m) => m.job?.productId === productId || m.cycle?.productId === productId,
    );
    if (busy) {
      machineForProduct.set(productId, busy.id);
      continue;
    }
    const typeId = MACHINE_FOR[productId];
    const idle = freeMachines.find(
      (m) =>
        m.typeId === typeId ||
        (typeId === "leisure-line" && m.typeId === "next-gen-line") ||
        (typeId === "tech-line" && m.typeId === "next-gen-line"),
    );
    if (idle) {
      machineForProduct.set(productId, idle.id);
      freeMachines.splice(freeMachines.indexOf(idle), 1);
      continue;
    }
    const index = pendingMachineTypes.indexOf(typeId);
    if (index >= 0) {
      pendingMachineTypes.splice(index, 1);
      continue;
    }
    const supplier = equipmentSupplierById.get(profile.equipmentSupplier);
    const offer = state.market.equipment[profile.equipmentSupplier];
    if (!supplier || !offer || (offer.stock[typeId] ?? 0) < 1) continue;
    const typePrice = machineTypeById.get(typeId)?.price ?? 50_000;
    if (spend(Math.round(typePrice * supplier.priceFactor))) {
      commands.push({
        type: "purchase.buyMachine",
        payload: { supplierId: supplier.id, machineTypeId: typeId },
      });
    }
  }

  // Staff: operators for every machine, logisticians for shipments.
  const present = Object.values(team.employees);
  const operators = present.filter((e) => e.job === "operator");
  const logisticians = present.filter((e) => e.job === "logistician");
  const requiredOperators = Object.values(team.machines).reduce(
    (sum, m) => sum + (machineTypeById.get(m.typeId)?.operatorsRequired ?? 2),
    0,
  );
  const pool = state.market.laborPool[team.region] ?? 0;
  // Hire only what the cash can pay for two months.
  const affordable = Math.floor(
    Math.max(0, availableCash(team) - 2 * monthlyPayroll) / (2 * 2_500),
  );
  if (operators.length < requiredOperators && pool > 0 && affordable > 0) {
    commands.push({
      type: "hr.hire",
      payload: {
        job: "operator",
        count: Math.min(pool, affordable, requiredOperators - operators.length),
      },
    });
  }
  const accepted = Object.values(team.orders).filter((o) => o.status === "accepted").length;
  const wantedLogisticians = Math.max(
    1,
    Math.ceil((accepted + 2) / hrRules.shipmentsPerLogisticianPerDay),
  );
  if (logisticians.length < wantedLogisticians && pool > 1 && operate(0)) {
    commands.push({ type: "hr.hire", payload: { job: "logistician", count: 1 } });
  }

  // Assign operators and keep queues running.
  const unassigned = operators.filter((e) => e.machineId === null || !team.machines[e.machineId]);
  const dailyNeed = new Map<MaterialId, number>();
  const incomingUnits = Object.values(team.inbound).reduce(
    (sum, s) => sum + (s.kind === "material" ? s.quantity : 0),
    0,
  );
  const banned = team.blackMarket.bannedUntilDay !== null && day <= team.blackMarket.bannedUntilDay;
  for (const [productId, machineId] of machineForProduct) {
    const machine = team.machines[machineId];
    if (!machine) continue;
    const needed = machineTypeById.get(machine.typeId)?.operatorsRequired ?? 2;
    const assigned = operators.filter((e) => e.machineId === machineId);
    if (assigned.length < needed && !machine.cycle && unassigned.length > 0) {
      const extra = unassigned.splice(0, needed - assigned.length);
      commands.push({
        type: "production.assignOperators",
        payload: { machineId, employeeIds: [...assigned, ...extra].map((e) => e.id) },
      });
    }
    if (!machine.job) {
      commands.push({ type: "production.setJob", payload: { machineId, productId, cycles: 20 } });
    }
    if (machine.efficiency < 0.72 && !machine.cycle && machine.maintenanceUntilDay === null) {
      if (operate(Math.round(1_000)))
        commands.push({ type: "production.maintain", payload: { machineId } });
    }

    // Daily material need of this machine (summed over machines below).
    const cycleDays = machineTypeById.get(machine.typeId)?.products[productId]?.cycleDays ?? 1;
    for (const { item, quantity } of cycleMaterials(machine, productId)) {
      const material = item as MaterialId;
      dailyNeed.set(material, (dailyNeed.get(material) ?? 0) + quantity / cycleDays);
    }
  }

  // Restock to about five days of need, scarcest materials first, within the room left for output.
  let room = freeSpace(team) - incomingUnits - team.warehouse.capacity * 0.2;
  const coverage = [...dailyNeed].map(([material, perDay]) => {
    const incoming = Object.values(team.inbound).reduce(
      (sum, s) => sum + (s.kind === "material" && s.item === material ? s.quantity : 0),
      0,
    );
    const have = (team.inventory[material] ?? 0) + incoming;
    return { material, perDay, have, days: have / perDay };
  });
  coverage.sort((a, b) => a.days - b.days);
  for (const { material, perDay, have } of coverage) {
    if (have >= perDay * 3) continue;
    const wanted = Math.min(Math.ceil(perDay * 5 - have), Math.floor(room));
    if (wanted < Math.ceil(perDay)) continue;
    if (
      profile.blackMarket &&
      !banned &&
      (state.market.blackMarket.stock[material] ?? 0) >= wanted &&
      operate(wanted * 6)
    ) {
      commands.push({ type: "blackMarket.buy", payload: { material, quantity: wanted } });
      room -= wanted;
      continue;
    }
    const supplier = pickSupplier(state, profile, material, Math.ceil(perDay));
    const available = supplier ? (state.market.suppliers[supplier.id]?.stock ?? 0) : 0;
    const bought = Math.min(wanted, available);
    if (supplier && bought > 0 && operate(Math.ceil(bought * supplier.price * 1.4))) {
      commands.push({
        type: "purchase.buyMaterial",
        payload: { supplierId: supplier.id, quantity: bought },
      });
      room -= bought;
    }
  }

  // Prices and auto-accept in reachable regions.
  for (const productId of targets) {
    for (const region of regions) {
      if (travelDays(team.region, region.id) > profile.marketReach) continue;
      const price = Math.round(localPrice(region.id, productId) * profile.priceFactor * 100) / 100;
      if (team.prices[region.id]?.[productId] !== price) {
        commands.push({ type: "sales.setPrice", payload: { region: region.id, productId, price } });
      }
    }
    if (!team.autoAccept[productId]) {
      commands.push({ type: "sales.setAutoAccept", payload: { productId, enabled: true } });
    }
  }

  // Ship every accepted order.
  for (const order of Object.values(team.orders)) {
    if (order.status !== "accepted") continue;
    // Express only when the standard route would miss the deadline.
    const late = day + shippingDays("standard", team.region, order.region) > order.deadlineDay;
    const option: TransportOption =
      profile.transport === "express" ? (late ? "express" : "standard") : profile.transport;
    // Shipping is never postponed to protect the cash buffer: unshipped orders fail.
    commands.push({ type: "delivery.ship", payload: { orderId: order.id, option } });
  }

  // Warehouse.
  if (
    freeSpace(team) < team.warehouse.capacity * 0.15 &&
    !team.warehouse.expansion &&
    spend(10_000)
  ) {
    commands.push({ type: "warehouse.expand" });
  }

  // Raises.
  if (profile.raiseEvery !== null) {
    const due = present.filter(
      (e) => e.arrivesOnDay <= day && day - e.lastRaiseDay >= (profile.raiseEvery ?? 0),
    );
    if (due.length > 0) {
      commands.push({
        type: "hr.raise",
        payload: { employeeIds: due.map((e) => e.id), percent: 5 },
      });
    }
  }

  // Auctions.
  for (const auction of Object.values(state.auctions)) {
    if (auction.status !== "open" || auction.bids[teamId]) continue;
    const startingPrice =
      { "auction-patent": 5_000, "auction-export": 8_000, "auction-next-gen": 15_000 }[
        auction.id
      ] ?? 10_000;
    const bid = Math.round(startingPrice * (1.2 + nextFloat(rng)));
    if (budget > bid * 2)
      commands.push({ type: "auction.bid", payload: { auctionId: auction.id, amount: bid } });
  }

  // Black market: sell a bit of surplus, accuse now and then.
  if (profile.blackMarket && !banned) {
    for (const productId of targets) {
      const surplus = (team.inventory[productId] ?? 0) - (team.reserved[productId] ?? 0);
      const tier = productById.get(productId)?.tier ?? 1;
      const cap = Math.floor(
        ({ 1: 40, 2: 10, 3: 2 } as const)[tier] * (team.region === "port-libre" ? 1.5 : 1),
      );
      const quantity = Math.min(
        cap - (team.blackMarket.soldToday[productId] ?? 0),
        Math.floor(surplus / 2),
      );
      if (quantity > 0)
        commands.push({ type: "blackMarket.sell", payload: { productId, quantity } });
    }
    // Investigate a rival now and then; accuse only with proof.
    const rivals = Object.keys(state.teams).filter((id) => id !== teamId);
    const lastProof = team.blackMarket.investigations.at(-1);
    if (lastProof?.proofFound && lastProof.day === day - 1) {
      commands.push({
        type: "blackMarket.accuse",
        payload: { targetTeamId: lastProof.targetTeamId },
      });
    } else if (day % 30 === 0 && budget > 10_000) {
      const target = rivals[nextInt(rng, 0, rivals.length - 1)];
      if (target)
        commands.push({ type: "blackMarket.investigate", payload: { targetTeamId: target } });
    }
  }

  // Secret card, played once when useful.
  const card = team.card;
  if (card && !card.used && day > 20) {
    const rivals = Object.keys(state.teams).filter((id) => id !== teamId);
    const target = rivals[nextInt(rng, 0, rivals.length - 1)] ?? "";
    const payload =
      card.id === "fake-news"
        ? {
            kind: "fake-news",
            source: "tabloid",
            region: null,
            title: "Rumeur de pénurie",
            body: "Une rumeur court.",
          }
        : card.id === "spying" || card.id === "sabotage"
          ? { kind: card.id, targetTeamId: target }
          : card.id === "supplier-priority"
            ? { kind: card.id, supplierId: "nordtech" }
            : { kind: card.id };
    commands.push({ type: "card.play", payload });
  }

  return commands;
}
