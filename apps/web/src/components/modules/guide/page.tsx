import { guide } from "@etic/content";
import { Search } from "lucide-react";
import { useId, useState } from "react";
import { AcrosticEgg } from "@/components/eggs/acrostic-egg";
import { PageHeader } from "@/components/game/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");

export function GuidePage() {
  const [search, setSearch] = useState("");
  const id = useId();
  const query = normalize(search.trim());
  const sections = guide.filter((section) =>
    normalize([section.title, ...section.paragraphs].join(" ")).includes(query),
  );
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Le guide"
        title="Prenez les commandes."
        description="Une règle à vérifier, une décision à prendre : retrouvez l'essentiel de chaque module."
      />
      <div className="max-w-lg space-y-2">
        <Label htmlFor={id}>Rechercher dans le guide</Label>
        <div className="relative">
          <Search className="absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden />
          <Input
            id={id}
            className="pl-10"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Production, salaires, livraisons…"
          />
        </div>
        <p role="status" className="text-xs text-muted-foreground">
          {sections.length} rubriques
        </p>
      </div>
      <div className="grid items-start gap-10 md:grid-cols-[11rem_minmax(0,1fr)]">
        <nav
          aria-label="Sommaire du guide"
          className="sticky top-28 flex flex-col gap-1 border-l pl-4 text-sm"
        >
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#guide-${section.id}`}
              className="rounded py-1.5 text-muted-foreground hover:text-primary focus-visible:outline-2"
            >
              {section.title}
            </a>
          ))}
        </nav>
        <div className="max-w-3xl divide-y">
          {sections.length === 0 ? (
            <p className="py-6 text-muted-foreground">
              Aucune rubrique ne correspond. Essayez un autre mot.
            </p>
          ) : (
            sections.map((section) => (
              <section
                key={section.id}
                id={`guide-${section.id}`}
                className="scroll-mt-28 py-7 first:pt-0"
              >
                <div className="grid grid-cols-[2.5rem_1fr] gap-4">
                  <span className="tabular pt-1 font-display text-xl font-bold text-primary">
                    {String(guide.indexOf(section) + 1).padStart(2, "0")}
                  </span>
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold uppercase">{section.title}</h2>
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph} className="leading-relaxed text-muted-foreground">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </section>
            ))
          )}
          <AcrosticEgg />
        </div>
      </div>
    </div>
  );
}
