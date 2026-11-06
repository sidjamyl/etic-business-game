/** Global timing rules (product.md §5, N5, R19). Edit values here, not in code. */
export const timingRules = {
  /** Real milliseconds per simulated day in a real game: one minute (Q8). */
  msPerDay: 60_000,
  /** Sub-steps per simulated day: every 15 s at real speed (N5). */
  stepsPerDay: 4,
  /** Length of the final countdown in simulated days (R19). */
  countdownDays: 30,
} as const;

/** Starting conditions and lobby rules (R16, O4). */
export const startRules = {
  /** Cash credited to every company at the start, in crédits (₢). */
  startingCash: 50_000,
  /** Default member cap per team, adjustable by the organizer. */
  defaultMemberCap: 4,
  companyNameMaxLength: 40,
} as const;

/** Warehouse rules (R9). */
export const warehouseRules = {
  /** Initial capacity in units, all goods combined. */
  initialCapacity: 1_500,
  expansionCapacity: 1_000,
  expansionCost: 10_000,
  expansionDays: 5,
} as const;

/** Human resources rules (R6, N8). */
export const hrRules = {
  jobs: {
    operator: { name: "Opérateur", wageFactor: 1 },
    logistician: { name: "Logisticien", wageFactor: 1.1 },
  },
  hiringDelayDays: 2,
  /** Most people hired in a single decision. */
  maxHiresPerDecision: 50,
  payrollEveryDays: 30,
  /** Days without a raise before efficiency starts to drop. */
  raiseGraceDays: 60,
  decayEveryDays: 10,
  decayStep: 0.05,
  minEfficiency: 0.5,
  /** Smallest raise, in percent, that counts as a raise. */
  minRaisePercent: 5,
  maxRaisePercent: 50,
  recoveryPerDay: 0.05,
  /** Severance as a fraction of the 30-day wage. */
  severanceMonths: 0.5,
  /** Days of strike after which unpaid employees resign together (N25). */
  strikeResignationDays: 10,
  /** Shipments prepared per logistician per day (R8). */
  shipmentsPerLogisticianPerDay: 5,
} as const;

export type JobId = keyof typeof hrRules.jobs;
export const jobIds = Object.keys(hrRules.jobs) as [JobId, ...JobId[]];

/** Production and machine rules (R5, N9). */
export const productionRules = {
  /** Efficiency lost per day of operation. */
  wearPerDay: 0.01,
  minEfficiency: 0.4,
  /** Maintenance cost as a share of the machine's base price. */
  maintenanceCostShare: 0.1,
  maintenanceDays: 3,
  efficiencyAfterMaintenance: 0.95,
  maxCyclesPerJob: 999,
} as const;

/** Sales and demand rules (R7, N10). */
export const salesRules = {
  /** Maximum price = local price × this factor; no demand above it. */
  maxPriceFactor: 1.5,
  /** Demand multiplier when the price is half the local price or lower. */
  cheapDemandBoost: 1.5,
  /** Attractiveness lost per travel day beyond the first. */
  deliveryPenaltyPerDay: 0.1,
  /** Days a pending order stays in the inbox. */
  orderExpiryDays: 2,
  /** Days added to the travel time to set an order's deadline. */
  deadlineSlackDays: 3,
  /** Order sizes in units, by tier. */
  orderSize: {
    1: { min: 20, max: 60 },
    2: { min: 5, max: 15 },
    3: { min: 1, max: 4 },
  },
  /** Demand ramps of tiers 2 and 3, in simulated days (before events and head starts). */
  recovery: {
    2: { from: 60, to: 180 },
    3: { from: 150, to: 300 },
  },
  reputation: { initial: 50, min: 0, max: 100, onTime: 1, late: -3, failed: -8 },
  /** Days of order history kept for charts. */
  historyDays: 60,
} as const;

/** Delivery rules (R8, N11). */
export const deliveryRules = {
  /** Flat cost per shipment, in crédits. */
  baseCost: 20,
  options: {
    standard: {
      name: "Standard (route)",
      costPerUnitPerDay: 0.4,
      durationFactor: 1,
      environmental: 50,
    },
    express: {
      name: "Express (avion)",
      costPerUnitPerDay: 1.2,
      durationFactor: 0.5,
      environmental: 10,
    },
    green: {
      name: "Verte (rail ou électrique)",
      costPerUnitPerDay: 0.6,
      durationFactor: 1.5,
      environmental: 90,
    },
  },
  /** Price cut on a late delivery. */
  lateDiscount: 0.2,
  /** Days after the deadline before an accepted, unshipped order is cancelled. */
  failureGraceDays: 5,
} as const;

export type TransportOption = keyof typeof deliveryRules.options;
export const transportOptions = Object.keys(deliveryRules.options) as [
  TransportOption,
  ...TransportOption[],
];

/** Finance rules (R16, N12). */
export const financeRules = {
  /** Ceiling on borrowed principal; capitalized interest may exceed it. */
  loanCap: 30_000,
  minLoan: 1_000,
  /** Interest charged on the debt every `interestEveryDays`. */
  interestRate: 0.03,
  interestEveryDays: 30,
  /** Ledger entries kept in the team view; totals cover the whole game. */
  ledgerLimit: 300,
} as const;

export const ledgerCategories = {
  sales: "Ventes",
  purchases: "Achats de matières",
  machines: "Machines",
  maintenance: "Maintenance",
  warehouse: "Entrepôt",
  wages: "Salaires",
  severance: "Indemnités",
  shipping: "Transport",
  loan: "Emprunt",
  repayment: "Remboursement",
  interest: "Intérêts",
  development: "Recherche et développement",
  marketing: "Marketing",
  auction: "Enchères",
  blackMarket: "Marché noir",
  investigations: "Enquêtes",
  fines: "Amendes",
  trades: "Échanges entre entreprises",
  transfers: "Transferts",
  bonus: "Primes",
  other: "Autres",
} as const;

export type LedgerCategory = keyof typeof ledgerCategories;

/** Progression rules (R1, R2, N13). Milestones count units delivered and paid. */
export const progressionRules = {
  tiers: {
    2: { milestoneTier: 1, milestoneUnits: 400, cost: 20_000, days: 10 },
    3: { milestoneTier: 2, milestoneUnits: 200, cost: 25_000, days: 15 },
  },
  branches: { tech: "Tech", leisure: "Loisirs" },
} as const;

export type Branch = keyof typeof progressionRules.branches;

/** Marketing rules (R10, N14). */
export const marketingRules = {
  costPerDay: 60,
  wholeRangeFactor: 2.5,
  durations: [7, 14, 30],
  /** Attractiveness multiplier on every covered region × product. */
  attractivenessBoost: 1.2,
} as const;

/** Black market rules (R13, N17). */
export const blackMarketRules = {
  /** Weekly stock per material sold off the books. */
  stock: { flour: 100, plastic: 100, fabric: 100, metal: 100, components: 30, batteries: 20 },
  restockEveryDays: 7,
  /** Discount on the average supplier price. */
  buyDiscount: 0.35,
  deliveryDays: 1,
  /** Premium over the local price of the seller's home region. */
  sellPremium: 0.3,
  /** Units a team may sell per day, by tier. */
  dailySellCap: { 1: 40, 2: 10, 3: 2 },
  /** Port-Libre's wider access (R3): multiplier of the daily sell caps (more buyers). */
  portLibreFactor: 1.5,
  /** Chance that a Port-Libre deal is caught by customs (R3). */
  customsChance: 0.05,
  traceDays: 30,
  investigation: { cost: 3_000, baseChance: 0.1, chancePerTrace: 0.15, maxChance: 0.9 },
  accusation: {
    fineMultiplier: 2,
    minFine: 2_000,
    reputationPenalty: 15,
    banDays: 30,
    falseAccusationFine: 5_000,
    falseAccusationReputation: 10,
    cooldownDays: 10,
  },
} as const;

/** Secret card rules (R14, N18). */
export const cardRules = {
  fakeNewsTitleMax: 80,
  fakeNewsBodyMax: 400,
  sabotageDays: 5,
  amnestyShieldDays: 30,
} as const;

/** Trade rules (R15, N19). */
export const tradeRules = {
  offerExpiryDays: 5,
  /** Units a machine counts for when computing its shipping cost. */
  machineShippingUnits: 10,
} as const;

/** Social and environmental impact rules (R17, N20). */
export const impactRules = {
  /** Score before any decision. */
  neutral: 50,
  /** Environmental footprint per unit produced, by tier (100 = harmless). */
  productFootprint: { 1: 70, 2: 50, 3: 30 },
  /** Penalty on production made in Ferronia (pollution, R3). */
  ferroniaProductionPenalty: 20,
  /** Wage score: 50 at the regional base, 100 at this ratio and above. */
  wage: { baseScore: 50, fullScoreRatio: 1.25 },
  penalties: {
    perStrikeDay: 1,
    strikeCap: 20,
    perLayoff: 3,
    perConviction: 15,
    perMassResignation: 15,
  },
  /** Share above which a breakdown hint is shown. */
  hintThreshold: 0.3,
} as const;

/** Final score (R18): majority weight on the economy. */
export const scoreRules = {
  economicWeight: 0.7,
  impactWeight: 0.3,
} as const;
