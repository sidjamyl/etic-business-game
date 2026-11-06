import { Link } from "@tanstack/react-router";
import { Boxes, PackageOpen } from "lucide-react";
import { EmptyState } from "@/components/game/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, itemLabel, percent } from "@/lib/format";
import { useView } from "@/lib/game";
import { materialLines, productLines } from "./warehouse-math";

function Count({ value, muted = false }: { value: number; muted?: boolean }) {
  return (
    <span className={muted && value === 0 ? "tabular text-muted-foreground" : "tabular"}>
      {formatNumber(value)}
    </span>
  );
}

/** Units on their way ("+200"), or a muted 0. */
function Incoming({ value }: { value: number }) {
  if (value <= 0) return <Count value={0} muted />;
  return <span className="tabular">+{formatNumber(value)}</span>;
}

function MaterialsCard({ capacity }: { capacity: number }) {
  const { team } = useView();
  const lines = materialLines(team);
  const total = lines.reduce((sum, line) => sum + line.quantity, 0);
  const incoming = lines.reduce((sum, line) => sum + line.incoming, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">Matières premières</CardTitle>
        <CardDescription>Consommées au début de chaque cycle de production.</CardDescription>
      </CardHeader>
      <CardContent>
        {lines.length === 0 ? (
          <EmptyState icon={PackageOpen} title="Aucune matière en stock">
            Commandez auprès des fournisseurs dans{" "}
            <Link to="/play/achats" className="font-medium text-foreground underline">
              Achats
            </Link>
            .
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Matière</TableHead>
                <TableHead className="text-right">En stock</TableHead>
                <TableHead className="text-right">En route</TableHead>
                <TableHead className="text-right">Part de l'entrepôt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-medium">{itemLabel(line.id)}</TableCell>
                  <TableCell className="text-right font-medium">
                    <Count value={line.quantity} muted />
                  </TableCell>
                  <TableCell className="text-right">
                    <Incoming value={line.incoming} />
                  </TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">
                    {percent(capacity > 0 ? line.quantity / capacity : 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">
                  <Count value={total} />
                </TableCell>
                <TableCell className="text-right">
                  <Incoming value={incoming} />
                </TableCell>
                <TableCell className="tabular text-right">
                  {percent(capacity > 0 ? total / capacity : 0)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ProductsCard() {
  const { team } = useView();
  const lines = productLines(team);
  const showIncoming = lines.some((line) => line.incoming > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">Produits finis</CardTitle>
        <CardDescription>
          Réservé : bloqué par vos commandes clients acceptées. Disponible : libre pour de nouvelles
          commandes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {lines.length === 0 ? (
          <EmptyState icon={Boxes} title="Aucun produit fini">
            Vos produits arrivent ici à la fin de chaque cycle de production.
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">En stock</TableHead>
                <TableHead className="text-right">Réservé</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                {showIncoming ? <TableHead className="text-right">En route</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-medium">{itemLabel(line.id)}</TableCell>
                  <TableCell className="text-right">
                    <Count value={line.quantity} muted />
                  </TableCell>
                  <TableCell className="text-right">
                    <Count value={line.reserved} muted />
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <Count value={line.available} muted />
                  </TableCell>
                  {showIncoming ? (
                    <TableCell className="text-right">
                      <Incoming value={line.incoming} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** What the warehouse holds: raw materials and finished products (R9, O2). */
export function InventoryTables() {
  const view = useView();
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <MaterialsCard capacity={view.team.warehouse.capacity} />
      <ProductsCard />
    </div>
  );
}
