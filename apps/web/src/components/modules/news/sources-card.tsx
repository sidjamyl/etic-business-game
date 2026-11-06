import type { NewsSource } from "@etic/content";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useView } from "@/lib/game";
import { countBySource, plural, sourceOrder } from "./news-feed";
import { SourceMark } from "./news-marks";

/** How each paper writes; never whether a given news is true (R11). */
const sourceBlurbs: Record<NewsSource, string> = {
  serious: "Le journal de référence du continent, au ton posé.",
  tabloid: "Scoops, rumeurs et gros titres : plus sensationnaliste.",
};

/** The two papers of the continent, as the guide presents them. */
export function SourcesCard() {
  const { news } = useView();
  const counts = countBySource(news);
  return (
    <Card>
      <CardHeader>
        <h2 className="eyebrow font-sans text-muted-foreground">Les deux journaux</h2>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ul className="space-y-4">
          {sourceOrder.map((source) => (
            <li key={source} className="space-y-1">
              <SourceMark source={source} />
              <p className="text-pretty text-muted-foreground">{sourceBlurbs[source]}</p>
              <p className="tabular text-xs text-muted-foreground">
                {plural(counts[source], "news publiée", "news publiées")}
              </p>
            </li>
          ))}
        </ul>
        <p className="border-t pt-3 text-pretty">
          Les deux peuvent se tromper : recoupez les indices avant d'engager votre trésorerie.
        </p>
      </CardContent>
    </Card>
  );
}
