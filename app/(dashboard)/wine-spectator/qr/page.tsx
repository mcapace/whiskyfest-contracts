import { requireWineSpectatorPageAccess } from '@/lib/auth-wine-spectator';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import { listNyweExecutedBoothQrContracts, refreshNyweQrClicks } from '@/lib/nywe-booth-qr';
import { NyweBoothQrWorkspace } from '@/components/wine-spectator/nywe-booth-qr-workspace';
import { NYWE_EVENT_NAME } from '@/lib/nywe-copy';

export const dynamic = 'force-dynamic';

export default async function NyweBoothQrPage() {
  await requireWineSpectatorPageAccess();
  const event = await getActiveWineSpectatorEvent();
  if (!event) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-medium">QR codes</h1>
        <p className="text-sm text-muted-foreground">No active NYWE event configured.</p>
      </div>
    );
  }

  await refreshNyweQrClicks(event.id).catch((err) => {
    console.warn('[nywe-qr] click refresh skipped', err instanceof Error ? err.message : err);
  });

  const contracts = await listNyweExecutedBoothQrContracts(event.id);

  return (
    <NyweBoothQrWorkspace
      eventName={event.name || NYWE_EVENT_NAME}
      eventYear={event.year}
      rows={contracts.map((c) => ({
        id: c.id,
        exhibitorCompanyName: c.exhibitor_company_name,
        websiteUrl: c.exhibitor_website_url,
        shortUrl: c.rebrandly_short_url,
        artCode: c.art_code,
        boothNumber: c.booth_number,
        clicks: c.qr_clicks ?? 0,
        lastClickAt: c.qr_last_click_at,
      }))}
    />
  );
}
