import { EyeOff, Lock, type LucideIcon, Newspaper, TrendingUp, Trophy, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const rules: { icon: LucideIcon; text: string }[] = [
  {
    icon: Newspaper,
    text: "Chaque enchère est annoncée dans les news à son ouverture, sans préavis.",
  },
  {
    icon: EyeOff,
    text: "Offres scellées : seul le nom du gagnant est annoncé, jamais les montants.",
  },
  {
    icon: TrendingUp,
    text: "Une offre par entreprise, que vous pouvez augmenter jusqu'à la clôture. Impossible de la baisser ou de la retirer.",
  },
  {
    icon: Lock,
    text: "Le montant offert est bloqué jusqu'à la clôture : vous ne pouvez pas le dépenser ailleurs.",
  },
  {
    icon: Trophy,
    text: "La plus haute offre l'emporte et paie son montant. À égalité, l'entreprise arrivée la première à ce montant gagne.",
  },
  {
    icon: Undo2,
    text: "Les offres perdantes sont rendues à la clôture. Si la partie se termine avant, toutes les offres sont rendues.",
  },
];

/** How sealed-bid auctions work (R12, N16), next to the lots. */
export function AuctionRules() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">Règles des enchères</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3 text-sm">
          {rules.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-pretty">{text}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
