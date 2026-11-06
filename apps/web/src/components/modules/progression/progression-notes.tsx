import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Factory, Newspaper, PackageCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Note({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <div className="text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

/**
 * What players should keep in mind before investing (R2, story 54). Demand for higher tiers
 * follows the economic recovery hinted at by the news: never any figure here.
 */
export function ProgressionNotes() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">Bon à savoir</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4 text-sm">
          <Note icon={Newspaper} title="Débloquer un palier ne crée pas ses clients">
            <p>
              La demande des produits plus évolués revient progressivement avec la reprise
              économique. Les news en donnent les signes : lisez-les avant d'investir.
            </p>
            <Link
              to="/play/news"
              className="mt-1 inline-block font-medium text-foreground underline underline-offset-4 hover:opacity-80"
            >
              Lire les news
            </Link>
          </Note>
          <Note icon={PackageCheck} title="Le jalon compte les livraisons payées">
            Seuls les produits livrés à vos clients et payés comptent, pas les commandes en cours.
          </Note>
          <Note icon={Factory} title="Seule la production attend le déblocage">
            Matières et machines s'achètent à l'avance : préparez-vous pendant le développement.
          </Note>
        </ul>
      </CardContent>
    </Card>
  );
}
