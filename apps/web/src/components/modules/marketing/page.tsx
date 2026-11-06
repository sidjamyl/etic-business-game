import { Link } from "@tanstack/react-router";
import { Tag } from "lucide-react";
import { PageHeader } from "@/components/game/page-header";
import { Button } from "@/components/ui/button";
import { ActiveCampaigns } from "./active-campaigns";
import { CampaignForm } from "./campaign-form";
import { MarketingOverview } from "./marketing-overview";
import { MarketingRules } from "./marketing-rules";

/**
 * Marketing module (#35, R10, N14): launch a campaign on a region or all of them, a product
 * or the whole range, for 7, 14 or 30 days, knowing its cost before paying; then follow the
 * campaigns in progress until their last day. Everything derives from the live team view.
 */
export function MarketingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketing"
        title="Campagnes"
        description="Une campagne rend vos offres plus attirantes sur sa cible : elle prend des clients à vos concurrents, sans en créer de nouveaux."
        actions={
          <Button asChild variant="outline">
            <Link to="/play/ventes">
              <Tag aria-hidden />
              Fixer les prix
            </Link>
          </Button>
        }
      />
      <MarketingOverview />
      <div className="grid items-start gap-6 xl:grid-cols-[3fr_2fr]">
        <CampaignForm />
        <div className="space-y-6">
          <ActiveCampaigns />
          <MarketingRules />
        </div>
      </div>
    </div>
  );
}
