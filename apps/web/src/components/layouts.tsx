import { Link, type LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BookOpen,
  Boxes,
  Factory,
  Gavel,
  Handshake,
  LayoutDashboard,
  Leaf,
  Megaphone,
  Milestone,
  Newspaper,
  ShoppingCart,
  Skull,
  Spade,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { EasterEggs } from "@/components/eggs/easter-eggs";
import { LogoEgg } from "@/components/eggs/logo-egg";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { useUnreadNewsCount } from "@/lib/news-read";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  to: LinkProps["to"];
}

/** Player modules (PRD #1): one page per module under /play. */
export const playerNav: NavItem[] = [
  { label: "Tableau de bord", icon: LayoutDashboard, to: "/play" },
  { label: "Achats", icon: ShoppingCart, to: "/play/achats" },
  { label: "Entrepôt", icon: Boxes, to: "/play/entrepot" },
  { label: "Production", icon: Factory, to: "/play/production" },
  { label: "Équipe", icon: Users, to: "/play/equipe" },
  { label: "Ventes", icon: TrendingUp, to: "/play/ventes" },
  { label: "Livraisons", icon: Truck, to: "/play/livraisons" },
  { label: "Progression", icon: Milestone, to: "/play/progression" },
  { label: "Marketing", icon: Megaphone, to: "/play/marketing" },
  { label: "News", icon: Newspaper, to: "/play/news" },
  { label: "Enchères", icon: Gavel, to: "/play/encheres" },
  { label: "Échanges", icon: Handshake, to: "/play/echanges" },
  { label: "Finance", icon: Banknote, to: "/play/finance" },
  { label: "Impact", icon: Leaf, to: "/play/impact" },
  { label: "Carte secrète", icon: Spade, to: "/play/carte" },
  { label: "Marché noir", icon: Skull, to: "/play/marche-noir" },
  { label: "Guide", icon: BookOpen, to: "/play/guide" },
];

function PlayerNav() {
  const unreadNews = useUnreadNewsCount();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Modules">
      {playerNav.map(({ label, icon: Icon, to }) => (
        <Link
          key={label}
          to={to}
          activeOptions={{ exact: to === "/play" }}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/10"
          activeProps={{ className: "bg-white/12 font-semibold" }}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{label}</span>
          {to === "/play/news" && unreadNews > 0 ? (
            <span className="tabular rounded-full bg-power-red px-1.5 text-xs font-semibold text-milk">
              {unreadNews}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Player layout (DESIGN.md §6): Night sidebar, clock bar always visible, banners (pause,
 * countdown, end) under it, Milk content. Rendered inside GameProvider.
 */
export function PlayerLayout({
  clock,
  banners,
  children,
}: {
  clock: ReactNode;
  banners?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh grid-cols-[15rem_1fr]">
      <EasterEggs />
      <aside className="sticky top-0 flex h-dvh flex-col gap-6 overflow-y-auto bg-sidebar p-4 text-sidebar-foreground">
        <LogoEgg>
          <Logo inverted className="px-2" />
        </LogoEgg>
        <PlayerNav />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center gap-4 px-6">
            {clock}
            <UserMenu />
          </div>
          {banners}
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

/** Organizer layout (DESIGN.md §6): dark theme to tell it apart from a player screen. */
export function OrganizerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <Link to="/admin" aria-label="Parties">
          <Logo inverted />
        </Link>
        <div className="flex items-center gap-4">
          <span className="eyebrow text-muted-foreground">Salle de contrôle</span>
          <UserMenu />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}

/** Projector layout (DESIGN.md §6): full screen, readable from the back of the room. */
export function ProjectorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col overflow-hidden bg-power-red text-milk">{children}</div>
  );
}
