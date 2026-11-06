import type { RegionId } from "./regions.ts";

/**
 * Travel time in simulated days between regions (N7), reused by deliveries.
 * Ferronia is central; Azura and Nordhaven are the farthest apart.
 */
const TRAVEL_DAYS: Record<RegionId, Record<RegionId, number>> = {
  azura: { azura: 1, nordhaven: 4, ferronia: 2, "port-libre": 3 },
  nordhaven: { azura: 4, nordhaven: 1, ferronia: 2, "port-libre": 3 },
  ferronia: { azura: 2, nordhaven: 2, ferronia: 1, "port-libre": 2 },
  "port-libre": { azura: 3, nordhaven: 3, ferronia: 2, "port-libre": 1 },
};

export function travelDays(from: RegionId, to: RegionId): number {
  return TRAVEL_DAYS[from][to];
}

/** Purchase price factor by buyer region: Ferronia's industrial advantage (R3). */
export const purchasePriceFactor: Record<RegionId, number> = {
  azura: 1,
  nordhaven: 1,
  ferronia: 0.9,
  "port-libre": 1,
};

/** Shipping cost factor by shipper region: Port-Libre's trade-hub advantage (R3, N11). */
export const shippingCostFactor: Record<RegionId, number> = {
  azura: 1,
  nordhaven: 1,
  ferronia: 1,
  "port-libre": 0.7,
};
