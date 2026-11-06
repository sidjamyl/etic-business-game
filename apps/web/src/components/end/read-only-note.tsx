import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";

const linkClass = "font-medium text-foreground underline underline-offset-2 hover:opacity-80";

/** After the end every page stays open, read-only (O1): point to the figures behind the score. */
export function ReadOnlyNote() {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="text-pretty">
        Les autres pages restent consultables, en lecture seule : revoyez par exemple votre{" "}
        <Link to="/play/finance" className={linkClass}>
          trésorerie
        </Link>{" "}
        ou le détail de votre{" "}
        <Link to="/play/impact" className={linkClass}>
          impact
        </Link>
        .
      </span>
    </p>
  );
}
