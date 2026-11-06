import type { ClockView } from "@etic/engine";
import { CalendarClock, Zap } from "lucide-react";
import { useId } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { EmptyLine, SectionTitle, SubTitle } from "./bits";
import { type AdminEvents, activeEventLabel, inDaysLabel } from "./control-room-helpers";

/**
 * Scenario events (R12, story 127): they fire on their own, the organizer only narrates them.
 * Upcoming events are never shown to the teams.
 */
export function EventsCard({
  events,
  clock,
  msPerDay,
}: {
  events: AdminEvents;
  clock: ClockView;
  msPerDay: number;
}) {
  const activeId = useId();
  const upcomingId = useId();
  const today = clock.time.day;
  const active = Object.entries(events.active)
    .map(([id, event]) => ({ id, ...event }))
    .sort((a, b) => b.startDay - a.startDay);
  const upcoming = [...events.upcoming].sort((a, b) => a.day - b.day);
  const ended = clock.status === "ended";

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <SectionTitle>Événements du scénario</SectionTitle>
        <CardDescription>
          Ils se déclenchent seuls : à vous de les raconter. Les équipes ne voient jamais ceux à
          venir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-5">
        <section aria-labelledby={activeId} className="space-y-2">
          <SubTitle id={activeId}>En cours</SubTitle>
          {active.length === 0 ? (
            <EmptyLine>Aucun événement en cours.</EmptyLine>
          ) : (
            <ul className="space-y-2.5">
              {active.map((event) => (
                <li key={event.id} className="flex gap-2.5">
                  <Zap className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium text-pretty">{event.title}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {activeEventLabel(event, today)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        {ended ? null : (
          <section aria-labelledby={upcomingId} className="space-y-2">
            <SubTitle id={upcomingId}>À venir</SubTitle>
            {upcoming.length === 0 ? (
              <EmptyLine>Plus aucun événement prévu au scénario.</EmptyLine>
            ) : (
              <ul className="space-y-2.5">
                {upcoming.map((event) => {
                  const afterEnd = clock.endDay !== null && event.day > clock.endDay;
                  return (
                    <li key={event.id} className="flex gap-2.5">
                      <CalendarClock
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-pretty">{event.title}</p>
                        <p className="tabular text-xs text-muted-foreground">
                          Jour {event.day} · {inDaysLabel(event.day, today, msPerDay)}
                          {afterEnd ? " · après la fin prévue" : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
