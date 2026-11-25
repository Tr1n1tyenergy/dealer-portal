import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageLoader } from "@/components/ui/brand-loaders";
import { canUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/session";
import { listDealerOptions, listStationsForPricing } from "@/lib/settings/stations-pricing";
import { listFleetTrucks } from "@/lib/settings/fleet-trucks";
import { listActivityFilterOptions, queryActivityLogs } from "@/lib/settings/activity-logs";
import { PlatformSettingsClient, type SettingsTab } from "@/components/staff/platform-settings-client";
import "@/app/intelligence/retail/staff-orders.css";
import "@/app/intelligence/retail/platform-settings.css";

export default function PlatformSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PageLoader label="Settings" />}>
      <PlatformSettingsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PlatformSettingsContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireInternal();
  if (!canUser(session.user, "settings", "view")) redirect("/intelligence/retail");

  const sp = (await searchParams) ?? {};
  const tabRaw = typeof sp.tab === "string" ? sp.tab : "stations";
  const initialTab = (
    ["stations", "tanks", "trucks", "activity", "system"].includes(tabRaw) ? tabRaw : "stations"
  ) as SettingsTab;

  const canViewActivity = canUser(session.user, "activity", "view");
  const needStations = initialTab === "stations" || initialTab === "tanks" || initialTab === "trucks";
  const needTrucks = initialTab === "trucks";
  const needActivity = initialTab === "activity" && canViewActivity;
  const needSystem = initialTab === "system";

  const [stations, dealers, trucks, storedSettings, activityBundle] = await Promise.all([
    needStations ? listStationsForPricing() : Promise.resolve([]),
    needStations ? listDealerOptions() : Promise.resolve([]),
    needTrucks ? listFleetTrucks() : Promise.resolve([]),
    needSystem
      ? prisma.systemSetting.findMany({ orderBy: { key: "asc" }, select: { key: true, value: true } })
      : Promise.resolve([]),
    needActivity
      ? Promise.all([
          listActivityFilterOptions(),
          queryActivityLogs({ datePreset: "7d", page: 1, pageSize: 8, sort: "desc" }),
        ]).then(([filterOptions, initial]) => ({ filterOptions, initial }))
      : Promise.resolve(null),
  ]);

  return (
    <div className="so ps">
      <header className="so-hero">
        <div className="so-hero__text">
          <div className="so-hero__eyebrow">Settings</div>
          <h1>Platform Settings</h1>
          <p>Manage stations, pricing, tanks, trucks, and system activity across the Trinity platform.</p>
        </div>
      </header>

      <div className="so-wrap">
        <PlatformSettingsClient
          stations={stations}
          dealers={dealers}
          trucks={trucks}
          canAct={canUser(session.user, "settings", "act")}
          canViewActivity={canViewActivity}
          activityFilterOptions={activityBundle?.filterOptions ?? null}
          activityInitial={activityBundle?.initial ?? null}
          initialTab={initialTab}
          system={{
            resendConfigured: Boolean(process.env.RESEND_API_KEY),
            storedSettings,
          }}
        />
      </div>
    </div>
  );
}
