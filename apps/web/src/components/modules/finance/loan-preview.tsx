import type { ReactNode } from "react";

export interface PreviewRow {
  label: string;
  now: string;
  /** Null while no valid amount is typed. */
  after: string | null;
}

/** What a loan or a repayment would change, before the player commits (stories 106–107). */
export function LoanPreview({
  caption,
  rows,
  note,
}: {
  caption: string;
  rows: PreviewRow[];
  note?: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="eyebrow text-muted-foreground">
            <th scope="col" className="pb-1 text-left font-semibold">
              <span className="sr-only">Indicateur</span>
            </th>
            <th scope="col" className="pb-1 text-right font-semibold">
              Maintenant
            </th>
            <th scope="col" className="pb-1 text-right font-semibold">
              Après
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal text-muted-foreground">
                {row.label}
              </th>
              <td className="tabular py-1.5 pl-3 text-right">{row.now}</td>
              <td className="tabular py-1.5 pl-3 text-right font-semibold">{row.after ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
