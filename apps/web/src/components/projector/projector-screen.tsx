import { newsSources } from "@etic/content";
import type { PublicView } from "@etic/engine";
import { Expand, Pause, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { credits, regionName, timeLeft } from "@/lib/format";
import { usePublicView, useScreenInfo } from "@/lib/screen";

function Results({ results }: { results: NonNullable<PublicView["results"]> }) {
  const latest = results.ranking[0];
  return (
    <section
      className="mx-auto w-full max-w-6xl flex-1 space-y-8 py-6"
      aria-label="Révélation du classement"
      aria-live="polite"
    >
      <p className="eyebrow text-center text-milk/80">La partie est terminée</p>
      <h1 className="text-center font-display text-5xl font-bold uppercase lg:text-7xl">
        {results.revealedCount === 0
          ? "L'heure du verdict"
          : results.finished
            ? "Le classement final"
            : "La révélation"}
      </h1>
      {results.revealedCount === 0 ? (
        <p className="py-12 text-center text-2xl text-milk/80">
          L'organisateur dévoilera les entreprises de la dernière à la première place.
        </p>
      ) : (
        <ol className="space-y-3">
          {results.ranking.map((entry) => (
            <li
              key={entry.teamId}
              className={`flex flex-wrap items-center gap-6 rounded-xl px-8 py-5 ${entry.rank === 1 ? "bg-milk text-cacao shadow-dotted" : "border border-milk/30 bg-cacao/30"}`}
            >
              <span className="tabular w-16 font-display text-5xl font-bold">
                {entry.rank === 1 ? (
                  <Trophy className="size-12" aria-label="Gagnant" />
                ) : (
                  `${entry.rank}e`
                )}
              </span>
              <span className="min-w-0 flex-1 break-words font-display text-3xl font-bold uppercase lg:text-4xl">
                {entry.companyName}
              </span>
              {"final" in entry && entry.final !== undefined ? (
                <div className="text-right">
                  <p className="tabular text-4xl font-bold">
                    {entry.final.toLocaleString("fr-FR")}
                    <span className="text-xl font-normal"> /100</span>
                  </p>
                  <p className="mt-1 text-sm">
                    {credits(entry.netCash ?? 0)} nets · environnement {entry.environmental} ·
                    social {entry.social}
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {latest?.rank === 1 ? (
        <p className="text-center text-2xl">Bravo à {latest.companyName} !</p>
      ) : null}
      {results.finished && !results.breakdownShown ? (
        <p className="text-center text-xl text-milk/80">Le détail des scores arrive…</p>
      ) : null}
      {results.breakdownShown ? (
        <p className="text-center text-xl text-milk/80">
          Score final : 70 % économie · 30 % impact social et environnemental
        </p>
      ) : null}
    </section>
  );
}

/** Public data only: no private ranking, upcoming event or sealed bid enters this screen. */
export function ProjectorScreen() {
  const view = usePublicView();
  const info = useScreenInfo();
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!view)
    return (
      <div role="status" className="grid min-h-dvh place-items-center font-display text-4xl">
        Connexion à la salle…
      </div>
    );
  const { clock } = view;
  const latestNews = [...view.news].reverse().slice(0, 3);
  const announcement = view.announcements.at(-1);
  const lobby = clock.status === "lobby";
  const paused = clock.status === "paused";
  const ended = clock.status === "ended";
  const currentAnnouncement =
    announcement?.day === clock.time.day && announcement.step === clock.time.step
      ? announcement
      : null;
  const freshNews =
    latestNews[0]?.day === clock.time.day && clock.time.step === 0 ? latestNews[0] : null;
  const spotlight = currentAnnouncement
    ? { id: `announcement-${currentAnnouncement.id}`, title: currentAnnouncement.message, body: "" }
    : freshNews
      ? { id: `news-${freshNews.id}`, title: freshNews.title, body: freshNews.body }
      : null;
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast.error("Le plein écran n'est pas disponible dans ce navigateur.");
    }
  };
  return (
    <div className="flex min-h-dvh flex-col px-8 py-6 lg:px-14 lg:py-8">
      {spotlight && spotlight.id !== dismissed && !paused && !lobby && !ended ? (
        <aside
          role="status"
          className="fixed inset-0 z-30 flex flex-col justify-center bg-cacao p-[6vw] text-milk"
        >
          <p className="eyebrow text-milk/70">Dans la salle · jour {clock.time.day}</p>
          <h2 className="mt-6 max-w-6xl text-[clamp(2.5rem,5vw,6rem)] leading-tight font-bold uppercase">
            {spotlight.title}
          </h2>
          {spotlight.body ? (
            <p className="mt-6 max-w-4xl whitespace-pre-line text-[clamp(1.25rem,2vw,2rem)] leading-relaxed">
              {spotlight.body}
            </p>
          ) : null}
          <button
            type="button"
            className="mt-10 w-fit rounded-full border border-milk/50 px-5 py-3 text-lg hover:bg-milk/10 focus-visible:outline-2 focus-visible:outline-offset-4"
            onClick={() => setDismissed(spotlight.id)}
          >
            Revenir à l'actualité
          </button>
        </aside>
      ) : null}
      <header className="flex items-center justify-between gap-6 border-b border-milk/30 pb-5">
        <Logo inverted />
        <p className="text-xl font-medium">{info?.name ?? "ETIC Business Game"}</p>
        <button
          type="button"
          onClick={() => void fullscreen()}
          className="rounded-md border border-milk/40 p-2 hover:bg-milk/10 focus-visible:outline-2 focus-visible:outline-offset-4"
          aria-label="Activer ou quitter le plein écran"
        >
          <Expand className="size-5" aria-hidden />
        </button>
      </header>
      {ended && view.results ? (
        <Results results={view.results} />
      ) : (
        <main className="grid flex-1 items-center gap-10 py-10 md:grid-cols-[0.85fr_1.15fr]">
          <section className="space-y-6">
            <p className="eyebrow text-milk/80">
              {lobby
                ? "Tout commence ici"
                : paused
                  ? "Le temps s'arrête pour tous"
                  : clock.countdown
                    ? "Dernière ligne droite"
                    : "Une économie. Quatre trajectoires."}
            </p>
            <h1 className="font-display text-[clamp(4rem,9vw,10rem)] leading-[0.95] font-bold uppercase tracking-tight">
              {lobby ? (
                <>
                  À vous
                  <br />
                  de jouer.
                </>
              ) : paused ? (
                <>
                  <Pause className="mb-5 size-16" aria-hidden />
                  En pause.
                </>
              ) : (
                <>
                  Jour
                  <br />
                  <span className="tabular">{clock.time.day}</span>
                </>
              )}
            </h1>
            {lobby ? (
              <p className="max-w-sm text-2xl text-milk/90">
                Rejoignez votre équipe, nommez votre entreprise et choisissez votre région.
              </p>
            ) : (
              <p className="text-2xl text-milk/90">
                {paused
                  ? "Soufflez un peu. La partie reprendra ensemble."
                  : clock.daysRemaining === null
                    ? "Le marché est ouvert."
                    : `${clock.daysRemaining} jours simulés restants${info ? ` · ${timeLeft(clock.daysRemaining, info.msPerDay)}` : ""}`}
              </p>
            )}
            {!lobby && !paused ? (
              <progress
                className="h-2 w-full max-w-sm accent-milk"
                max={clock.stepsPerDay}
                value={clock.time.step + 1}
                aria-label={`Quart ${clock.time.step + 1} sur ${clock.stepsPerDay}`}
              />
            ) : null}
            {announcement && !lobby ? (
              <div className="max-w-lg border-t border-milk/40 pt-5">
                <p className="eyebrow text-milk/70">Dans la salle · jour {announcement.day}</p>
                <p className="mt-2 text-2xl font-semibold">{announcement.message}</p>
              </div>
            ) : null}
          </section>
          {lobby ? (
            <section aria-label="Entreprises dans le lobby" className="divide-y divide-milk/30">
              {Object.values(view.teams).map((team) => (
                <div key={team.id} className="flex items-center justify-between gap-4 py-5">
                  <div>
                    <p className="text-3xl font-bold">{team.companyName ?? team.name}</p>
                    <p className="mt-1 text-lg text-milk/80">
                      {team.region ? regionName(team.region) : "Région à choisir"} ·{" "}
                      {team.memberCount} membres
                    </p>
                  </div>
                  <span className="rounded-full border border-milk/40 px-3 py-1 text-sm">
                    {team.ready ? "Prête" : "En préparation"}
                  </span>
                </div>
              ))}
            </section>
          ) : (
            <section className="space-y-5" aria-label="Dernières nouvelles">
              <p className="eyebrow text-milk/80">Le monde en mouvement</p>
              {latestNews.length === 0 ? (
                <p className="text-2xl">Les premières nouvelles arrivent…</p>
              ) : (
                latestNews.map((news, index) => (
                  <article
                    key={news.id}
                    className={`rounded-xl bg-milk p-6 text-night lg:p-8 ${index > 0 ? "opacity-85" : "shadow-dotted"}`}
                  >
                    <p className="eyebrow text-cacao">
                      {newsSources[news.source]} · jour {news.day}
                      {news.region ? ` · ${regionName(news.region)}` : ""}
                    </p>
                    <h2 className="mt-3 text-2xl leading-tight font-bold uppercase lg:text-3xl">
                      {news.title}
                    </h2>
                    {index === 0 ? (
                      <p className="mt-3 whitespace-pre-line text-xl leading-relaxed">
                        {news.body}
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </section>
          )}
        </main>
      )}
      <footer className="flex flex-wrap justify-between gap-3 border-t border-milk/30 pt-4 text-sm text-milk/80">
        <span>ETIC · Business Game</span>
        <span>{ended ? "Merci d'avoir joué." : "Acheter. Produire. Décider ensemble."}</span>
        <span>{Object.keys(view.teams).length} entreprises dans le même monde</span>
      </footer>
    </div>
  );
}
