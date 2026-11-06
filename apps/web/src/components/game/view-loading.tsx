import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder while a live view is on its way (first stream message). */
export function ViewLoading({ label = "Connexion à la partie…" }: { label?: string }) {
  return (
    <div className="space-y-4" role="status" aria-label={label}>
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
