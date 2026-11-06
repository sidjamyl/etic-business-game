import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed px-6 py-10 text-center">
      {Icon ? <Icon className="mb-3 size-6 text-muted-foreground" /> : null}
      <p className="font-medium">{title}</p>
      {children ? (
        <div className="mt-1 max-w-md text-sm text-muted-foreground">{children}</div>
      ) : null}
    </div>
  );
}
