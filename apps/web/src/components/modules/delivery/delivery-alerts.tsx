import { deliveryRules, hrRules, salesRules } from "@etic/content";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  type LucideIcon,
  PackageX,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { credits, formatNumber, percent } from "@/lib/format";
import { useView } from "@/lib/game";
import { type DeliveryPlan, relativeDay } from "./logistics";

const linkClass = "font-medium text-foreground underline underline-offset-4";

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);
const discount = percent(deliveryRules.lateDiscount);
const failedPoints = Math.abs(salesRules.reputation.failed);

function Warning({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <Alert className="border-warning/40 text-warning">
      <Icon aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

function Danger({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <Alert variant="destructive" className="border-destructive/40">
      <Icon aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/** Why nothing leaves the warehouse: strike, logisticians not there yet, or none at all. */
function BlockedAlert({ plan }: { plan: DeliveryPlan }) {
  const { team } = useView();
  if (team.hr.unpaidWages > 0) {
    return (
      <Danger icon={PackageX} title="Grève : aucune expédition ne part">
        <p>
          Vos employés attendent {credits(team.hr.unpaidWages)} de salaires. Les arriérés sont
          versés automatiquement dès que votre trésorerie disponible les couvre ; d'ici là, la file
          reste bloquée et les échéances continuent de courir.{" "}
          <Link to="/play/finance" className={linkClass}>
            Voir la finance
          </Link>
        </p>
      </Danger>
    );
  }
  if (plan.logisticiansArriveOn !== null) {
    return (
      <Warning icon={UserRound} title="Logisticiens en route">
        <p>
          Aucun logisticien n'est encore au travail : les premières expéditions partiront le jour{" "}
          {plan.logisticiansArriveOn} ({relativeDay(plan.logisticiansArriveOn, plan.today)}).
        </p>
      </Warning>
    );
  }
  return (
    <Danger icon={PackageX} title="Aucun logisticien">
      <p>
        Personne ne prépare vos expéditions : elles restent dans la file. Recrutez des logisticiens,
        chacun en prépare {hrRules.shipmentsPerLogisticianPerDay} par jour.{" "}
        <Link to="/play/equipe" className={linkClass}>
          Recruter dans Équipe
        </Link>
      </p>
    </Danger>
  );
}

/** Late and failed deliveries the team can still see coming (stories 62, 68). */
export function DeliveryAlerts({ plan }: { plan: DeliveryPlan }) {
  const blocked = plan.capacity === 0 && plan.queue.length + plan.toShip.length > 0;
  const overdue = plan.toShip.flatMap((entry) =>
    entry.outlook.kind === "overdue" ? [entry.outlook.cancelDay] : [],
  );
  const lateOnTheRoad = plan.onTheRoad.filter((entry) => entry.onTime === false).length;
  const lateInQueue = plan.queue.filter((entry) => entry.onTime === false).length;
  const lateToShip = plan.toShip.filter((entry) => entry.outlook.kind === "late").length;
  const late = lateOnTheRoad + lateInQueue + lateToShip;
  const delays = plan.onTheRoad.map((entry) => entry.eventDelay).filter((days) => days > 0);

  if (!blocked && overdue.length === 0 && late === 0 && delays.length === 0) return null;

  const lateParts = [
    lateOnTheRoad > 0 ? `${formatNumber(lateOnTheRoad)} en route` : null,
    lateInQueue > 0 ? `${formatNumber(lateInQueue)} dans la file` : null,
    lateToShip > 0 ? `${formatNumber(lateToShip)} à expédier` : null,
  ].filter(Boolean);

  return (
    <div className="grid gap-3">
      {blocked ? <BlockedAlert plan={plan} /> : null}
      {overdue.length > 0 ? (
        <Danger
          icon={AlertTriangle}
          title={`Échéance dépassée : ${formatNumber(overdue.length)} ${plural(overdue.length, "commande non expédiée", "commandes non expédiées")}`}
        >
          <p>
            {overdue.length > 1
              ? `Expédiées maintenant, elles seront payées ${discount} moins cher. Sinon, elles seront annulées sans paiement et votre réputation perdra ${failedPoints} points par commande : première annulation le jour ${Math.min(...overdue)}.`
              : `Expédiée maintenant, elle sera payée ${discount} moins cher. Sinon, elle sera annulée sans paiement le jour ${Math.min(...overdue)} et votre réputation perdra ${failedPoints} points.`}
          </p>
        </Danger>
      ) : null}
      {late > 0 ? (
        <Warning
          icon={Clock}
          title={`Retard prévu : ${formatNumber(late)} ${plural(late, "livraison", "livraisons")}`}
        >
          <p>
            {lateParts.join(", ")}. Chaque livraison en retard est payée {discount} moins cher et
            coûte {Math.abs(salesRules.reputation.late)} points de réputation.
          </p>
        </Warning>
      ) : null}
      {delays.length > 0 ? (
        <Warning icon={CalendarClock} title="Livraisons ralenties par un événement">
          <p>
            {delays.length > 1
              ? `${formatNumber(delays.length)} expéditions en route arriveront jusqu'à ${Math.max(...delays)} j plus tard que prévu.`
              : `Une expédition en route arrivera ${Math.max(...delays)} j plus tard que prévu.`}{" "}
            Les pénalités de retard s'appliquent si l'échéance est dépassée.
          </p>
        </Warning>
      ) : null}
    </div>
  );
}
