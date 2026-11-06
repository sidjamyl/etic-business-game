import { useMutation } from "@tanstack/react-query";
import { Newspaper, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { EmptyState } from "@/components/game/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { type AdminStreamView, useAdminGameId, useAdminView } from "@/lib/admin";
import { dayLabel } from "@/lib/format";
import { useTRPC } from "@/lib/trpc";
import { companyLabel } from "./card-math";

type CardNews = AdminStreamView["cardNews"][number];

function authorOf(view: AdminStreamView, news: CardNews): string {
  if (news.teamId === null) return "Auteur inconnu";
  return companyLabel(view.companies[news.teamId], "Entreprise retirée");
}

/**
 * Moderation of the fake news written with the « Fake news » card (R14, story 98), for the
 * organizer's control room (#43 mounts it inside AdminGameProvider). Players never see who
 * wrote them; the organizer does, to talk to the team if needed.
 */
export function FakeNewsModeration() {
  const view = useAdminView();
  const gameId = useAdminGameId();
  const trpc = useTRPC();
  const mutation = useMutation(trpc.admin.deleteNews.mutationOptions());
  if (!view) return null;
  const items = view.cardNews.toSorted((a, b) => b.id - a.id);

  async function remove(news: CardNews): Promise<boolean> {
    try {
      const result = await mutation.mutateAsync({ gameId, newsId: news.id });
      if (!result.ok) {
        toast.error(result.refusal.message);
        return false;
      }
      toast.success(`News « ${news.title} » supprimée.`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible, réessayez.");
      return false;
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="eyebrow font-sans text-muted-foreground">Fausses news des cartes</h2>
        <CardDescription className="text-pretty">
          Publiées avec la carte « Fake news » : les joueurs ignorent qu'elles sont fausses.
          Supprimez celles qui sont inappropriées.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={Newspaper} title="Aucune fausse news publiée">
            Elles apparaîtront ici dès qu'une équipe jouera sa carte « Fake news ».
          </EmptyState>
        ) : (
          <ol
            className="divide-y border-t"
            aria-label="Fausses news, des plus récentes aux plus anciennes"
          >
            {items.map((news) => (
              <li key={news.id} className="flex items-start gap-4 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="tabular text-xs text-muted-foreground">
                    {dayLabel(news.day)} · {authorOf(view, news)}
                  </p>
                  <p className="font-semibold text-pretty break-words">{news.title}</p>
                  <p className="text-sm text-pretty break-words text-muted-foreground">
                    {news.body}
                  </p>
                </div>
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={mutation.isPending}
                      aria-label={`Supprimer la news « ${news.title} »`}
                    >
                      <Trash2 aria-hidden />
                      Supprimer
                    </Button>
                  }
                  title="Supprimer cette fausse news ?"
                  description={`« ${news.title} »`}
                  consequences={[
                    "Elle disparaît du fil de toutes les entreprises et de l'écran de la salle.",
                    "L'équipe qui l'a publiée ne récupère pas sa carte.",
                    "Suppression définitive.",
                  ]}
                  confirmLabel="Supprimer"
                  tone="danger"
                  onConfirm={() => remove(news)}
                />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
