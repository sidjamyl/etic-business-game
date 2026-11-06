import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthPanel } from "@/components/auth-panel";
import { Logo } from "@/components/logo";
import { homeFor, loadSession } from "@/lib/session";

/** Home and sign-in (P6, N30). Signed-in visitors go straight to their space. */
export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const user = await loadSession(context);
    if (user) throw redirect({ to: homeFor(user.role) });
  },
  component: Home,
});

function Home() {
  return (
    <main className="grid min-h-dvh bg-power-red text-milk md:grid-cols-[1.2fr_1fr]">
      <section className="flex flex-col justify-between p-10 md:p-16">
        <Logo inverted />
        <div>
          <p className="eyebrow opacity-80">Club ETIC · Journée d'intégration</p>
          <h1 className="mt-4 text-5xl leading-[0.95] font-bold uppercase md:text-7xl">
            Business
            <br />
            <span className="text-cacao">Game</span>
          </h1>
          <p className="mt-6 max-w-md text-lg opacity-90">
            Le monde se relève d'une crise. Votre entreprise aussi. Achetez, produisez, vendez — et
            gardez un œil sur vos concurrents.
          </p>
        </div>
        <p className="text-sm opacity-70">Une minute réelle, un jour simulé.</p>
      </section>
      <section className="grid place-items-center bg-milk p-10 text-night">
        <AuthPanel />
      </section>
    </main>
  );
}
