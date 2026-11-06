import { CircleCheck, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** The server's plain-language hints on what weighs on the indicators (R17, N20). */
export function HintsCard({ hints }: { hints: readonly string[] }) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Ce qui pèse sur vos indicateurs
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5">
        {hints.length === 0 ? (
          <p className="flex items-start gap-2 text-sm">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            Rien à signaler : aucune de vos décisions ne pèse lourdement sur vos indicateurs pour
            l'instant.
          </p>
        ) : (
          <ul className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            {hints.map((hint) => (
              <li key={hint} className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span className="text-pretty">{hint}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
