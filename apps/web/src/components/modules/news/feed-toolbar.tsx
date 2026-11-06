import { newsSources, type RegionId } from "@etic/content";
import { Search, X } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  isFiltered,
  type NewsFilters,
  noFilters,
  parseRegionFilter,
  parseSourceFilter,
  regionOptions,
  sourceOrder,
} from "./news-feed";
import { sourceIcon } from "./news-marks";

/**
 * Search and filters of the archive (story 74): words, paper and region. Reading is never a
 * game decision, so nothing here is disabled during a pause.
 */
export function FeedToolbar({
  filters,
  onChange,
  ownRegion,
}: {
  filters: NewsFilters;
  onChange: (filters: NewsFilters) => void;
  ownRegion: RegionId | null;
}) {
  const searchId = useId();
  const regionId = useId();
  const sourceId = useId();
  const update = (patch: Partial<NewsFilters>) => onChange({ ...filters, ...patch });
  // A single toggle group can be emptied: clicking the active choice again keeps it.
  const selectSource = (value: string) => {
    if (value) update({ source: parseSourceFilter(value) });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-60 flex-1 gap-1.5">
          <Label htmlFor={searchId}>Rechercher</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id={searchId}
              type="search"
              autoComplete="off"
              placeholder="Un mot du titre ou du texte"
              className="pl-8"
              value={filters.query}
              onChange={(event) => update({ query: event.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={regionId}>Région</Label>
          <Select
            value={filters.region}
            onValueChange={(value) => update({ region: parseRegionFilter(value) })}
          >
            <SelectTrigger id={regionId} className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {regionOptions(ownRegion).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span id={sourceId} className="text-sm font-medium">
          Source
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-labelledby={sourceId}
          value={filters.source}
          onValueChange={selectSource}
        >
          <ToggleGroupItem value="all">Toutes</ToggleGroupItem>
          {sourceOrder.map((source) => {
            const Icon = sourceIcon[source];
            return (
              <ToggleGroupItem key={source} value={source}>
                <Icon aria-hidden />
                {newsSources[source]}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        {isFiltered(filters) ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(noFilters)}>
            <X aria-hidden />
            Effacer les filtres
          </Button>
        ) : null}
      </div>
    </div>
  );
}
