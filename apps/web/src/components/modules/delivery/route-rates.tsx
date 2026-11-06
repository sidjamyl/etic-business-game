import { type RegionId, regionIds, shippingCostFactor, transportOptions } from "@etic/content";
import { TransportImpactBadge } from "@/components/game/impact-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { credits, percent, regionName } from "@/lib/format";
import { useView } from "@/lib/game";
import { optionMode, optionShortName, routeRates } from "./logistics";

/** Travel time and price from the home region to every region (story 66). */
export function RouteRates({ from }: { from: RegionId }) {
  const { team, market } = useView();
  const perk = team.perks.shippingFactor;
  const regional = shippingCostFactor[from];
  const destinations = [from, ...regionIds.filter((id) => id !== from)];
  const discounts = [
    regional < 1 ? `avantage de ${regionName(from)} (−${percent(1 - regional)})` : null,
    perk < 1 ? `avantage remporté aux enchères (−${percent(1 - perk)})` : null,
  ].filter(Boolean);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">
          Barème depuis {regionName(from)}
        </CardTitle>
        <CardDescription>
          Durée du trajet et prix d'une expédition : un forfait plus un montant par unité, payés à
          l'expédition. Retards d'événements en cours inclus
          {discounts.length > 0 ? ` ; ${discounts.join(" et ")} inclus` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destination</TableHead>
              {transportOptions.map((option) => (
                <TableHead key={option}>
                  <span className="flex items-center gap-2">
                    {optionShortName(option)}
                    <span className="font-normal text-muted-foreground">{optionMode(option)}</span>
                    <TransportImpactBadge option={option} />
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {destinations.map((to) => (
              <TableRow key={to}>
                <TableCell className="font-medium">
                  {regionName(to)}
                  {to === from ? (
                    <span className="font-normal text-muted-foreground"> · locale</span>
                  ) : null}
                </TableCell>
                {routeRates(from, to, perk, market.transportDelays).map((rate) => (
                  <TableCell key={rate.option}>
                    <span className="tabular block font-medium">{rate.days} j</span>
                    <span className="tabular block text-xs text-muted-foreground">
                      {credits(rate.fixed)} + {credits(rate.perUnit)} / unité
                    </span>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
