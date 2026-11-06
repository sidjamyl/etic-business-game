import type { CardId } from "@etic/content";
import {
  Bomb,
  Feather,
  HeartHandshake,
  KeyRound,
  type LucideIcon,
  ScanEye,
  ShieldCheck,
} from "lucide-react";

/** One icon per card, used on the card itself, the catalogue and the outcome. */
export const cardIcon: Record<CardId, LucideIcon> = {
  "fake-news": Feather,
  spying: ScanEye,
  sabotage: Bomb,
  "supplier-priority": KeyRound,
  "social-peace": HeartHandshake,
  amnesty: ShieldCheck,
};
