import { newsSources, regions } from "@etic/content";
import { CircleAlert, ShieldAlert } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  CONTINENT,
  counterLabel,
  emptyFakeNews,
  type FakeNewsDraft,
  fakeNewsChecks,
  fakeNewsHint,
  fakeNewsPayload,
  fakeNewsReady,
  type LengthCheck,
  nearLimit,
  overLabel,
  parseRegionChoice,
} from "./card-math";
import { ChoiceCard } from "./choice-card";
import { NewsPreview, SourceMark, sourceBlurbs, sourceOrder } from "./news-preview";
import { PlayCardAction } from "./play-card-action";
import { usePlayCard } from "./use-play-card";

/** Label row of a text field with its live character counter (read with the field). */
function CountedLabel({
  htmlFor,
  counterId,
  check,
  children,
}: {
  htmlFor: string;
  counterId: string;
  check: LengthCheck;
  children: string;
}) {
  const over = check.over > 0;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Label htmlFor={htmlFor}>{children}</Label>
      <span
        id={counterId}
        className={cn(
          "tabular text-xs",
          over
            ? "font-medium text-destructive"
            : nearLimit(check)
              ? "text-warning"
              : "text-muted-foreground",
        )}
      >
        {counterLabel(check)}
        <span className="sr-only"> caractères</span>
      </span>
    </div>
  );
}

/** Shown under a text over its limit: the count in words, with an icon. */
function OverLimit({ id, check }: { id: string; check: LengthCheck }) {
  const label = overLabel(check);
  if (!label) return null;
  return (
    <p id={id} className="flex items-center gap-1.5 text-xs text-destructive">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden />
      {label} : raccourcissez pour pouvoir publier.
    </p>
  );
}

/**
 * Fake news (N18, story 91): the paper, the region concerned, a headline and a text within the
 * game's limits, with a live preview of the news as everyone will read it.
 */
export function FakeNewsForm() {
  const view = useView();
  const { play, locked } = usePlayCard();
  const baseId = useId();
  const [draft, setDraft] = useState<FakeNewsDraft>(emptyFakeNews);
  const checks = fakeNewsChecks(draft);
  const ready = fakeNewsReady(draft);
  const { team, clock } = view;
  const ids = {
    source: `${baseId}-source`,
    region: `${baseId}-region`,
    title: `${baseId}-title`,
    titleCount: `${baseId}-title-count`,
    titleOver: `${baseId}-title-over`,
    body: `${baseId}-body`,
    bodyCount: `${baseId}-body-count`,
    bodyOver: `${baseId}-body-over`,
  };
  const update = (patch: Partial<FakeNewsDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const describedBy = (counter: string, over: string, check: LengthCheck) =>
    check.over > 0 ? `${counter} ${over}` : counter;

  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate className="space-y-5">
      <div className="space-y-2">
        <p id={ids.source} className="text-sm font-medium">
          Journal
        </p>
        <RadioGroup
          aria-labelledby={ids.source}
          value={draft.source}
          onValueChange={(value) => {
            const source = sourceOrder.find((item) => item === value);
            if (source) update({ source });
          }}
          disabled={locked}
          className="grid gap-3 sm:grid-cols-2"
        >
          {sourceOrder.map((source) => (
            <ChoiceCard
              key={source}
              id={`${ids.source}-${source}`}
              value={source}
              selected={draft.source === source}
              disabled={locked}
            >
              <SourceMark source={source} />
              <span className="text-xs text-pretty text-muted-foreground">
                {sourceBlurbs[source]}
              </span>
            </ChoiceCard>
          ))}
        </RadioGroup>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={ids.region}>Région concernée</Label>
        <Select
          value={draft.region ?? CONTINENT}
          onValueChange={(value) => {
            const region = parseRegionChoice(value);
            if (region !== undefined) update({ region });
          }}
          disabled={locked}
        >
          <SelectTrigger id={ids.region} className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CONTINENT}>Tout le continent</SelectItem>
            <SelectSeparator />
            {regions.map((region) => (
              <SelectItem key={region.id} value={region.id}>
                {region.id === team.region ? `${region.name} (votre région)` : region.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <CountedLabel htmlFor={ids.title} counterId={ids.titleCount} check={checks.title}>
          Titre
        </CountedLabel>
        <Input
          id={ids.title}
          value={draft.title}
          onChange={(event) => update({ title: event.target.value })}
          disabled={locked}
          autoComplete="off"
          placeholder="Un titre qui accroche"
          aria-invalid={checks.title.over > 0}
          aria-describedby={describedBy(ids.titleCount, ids.titleOver, checks.title)}
        />
        <OverLimit id={ids.titleOver} check={checks.title} />
      </div>

      <div className="grid gap-1.5">
        <CountedLabel htmlFor={ids.body} counterId={ids.bodyCount} check={checks.body}>
          Texte
        </CountedLabel>
        <Textarea
          id={ids.body}
          value={draft.body}
          onChange={(event) => update({ body: event.target.value })}
          disabled={locked}
          rows={5}
          className="min-h-28"
          placeholder="Ce que les lecteurs doivent croire…"
          aria-invalid={checks.body.over > 0}
          aria-describedby={describedBy(ids.bodyCount, ids.bodyOver, checks.body)}
        />
        <OverLimit id={ids.bodyOver} check={checks.body} />
      </div>

      <section aria-labelledby={`${baseId}-preview`} className="space-y-2">
        <p id={`${baseId}-preview`} className="eyebrow text-muted-foreground">
          Aperçu dans le fil d'actualité
        </p>
        <NewsPreview
          draft={draft}
          ownRegion={team.region}
          day={clock.time.day}
          step={clock.time.step}
          stepsPerDay={clock.stepsPerDay}
        />
      </section>

      <p className="flex items-start gap-2 text-xs text-pretty text-muted-foreground">
        <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
        Restez fair-play : ni propos blessants, ni attaque personnelle. L'organisateur peut retirer
        une news inappropriée.
      </p>

      <PlayCardAction
        locked={locked}
        ready={ready}
        hint={fakeNewsHint(draft)}
        title="Publier cette fausse news ?"
        description={`Elle paraît aussitôt dans le fil d'actualité de toutes les entreprises, publiée par « ${newsSources[draft.source]} ».`}
        consequences={[
          "Rien n'indique qu'elle est fausse, ni qu'elle vient de vous.",
          "Aucun effet direct sur le marché : elle n'agit que sur ceux qui la croient.",
          "Impossible de la modifier ensuite ; l'organisateur peut la retirer si elle est inappropriée.",
        ]}
        confirmLabel="Publier"
        onConfirm={() =>
          ready
            ? play(
                fakeNewsPayload(draft),
                "Fausse news publiée. Personne ne sait qu'elle vient de vous.",
              )
            : Promise.resolve(false)
        }
      >
        <NewsPreview
          draft={draft}
          ownRegion={team.region}
          day={clock.time.day}
          step={clock.time.step}
          stepsPerDay={clock.stepsPerDay}
          compact
        />
      </PlayCardAction>
    </form>
  );
}
