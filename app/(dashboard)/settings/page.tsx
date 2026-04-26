import { requireContractActorForPage } from '@/lib/auth-contract';
import { SoundFeedbackSettings } from '@/components/settings/sound-feedback-settings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireContractActorForPage();

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="font-display text-4xl font-medium tracking-tight text-oak-800">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Personal preferences for the WhiskyFest contracts workspace.</p>
      </div>
      <SoundFeedbackSettings />
    </div>
  );
}
