import { PageHeader } from "@/components/game/page-header";
import { NextStep } from "./next-step";
import { ProgressionNotes } from "./progression-notes";
import { TierTree } from "./tier-tree";

/**
 * Progression (#34, R1, R2): the next step (milestone, development project, branch choice),
 * what to keep in mind before investing, and the tree of the three tiers (stories 51–54).
 */
export function ProgressionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Progression"
        title="Paliers et branches"
        description="Atteignez le jalon de ventes, puis financez le projet de développement : le palier suivant ouvre à la fin du délai. Au palier 3, vous choisirez une seule branche, Tech ou Loisirs."
      />
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <NextStep />
        <ProgressionNotes />
      </div>
      <TierTree />
    </div>
  );
}
