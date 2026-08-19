import { isNyweEventsManagedEvent } from '@/lib/contract-template-profile';
import { usesSingleSignerEnvelope } from '@/lib/single-signer-envelope';
import { WF_BS_COUNTERSIGN_GROUP_LABEL } from '@/lib/wf-bslv-countersigner';
import type { Event } from '@/types/db';

/** Portal copy for who countersigns (signing group vs named NYWE signatory). */
export function countersignUiForEvent(
  event: Pick<Event, 'product_key' | 'workflow_profile' | 'shanken_signatory_email' | 'shanken_signatory_name'> | null | undefined,
): { name: string | null; email: string | null } {
  if (!event) return { name: null, email: null };
  if (isNyweEventsManagedEvent(event) || usesSingleSignerEnvelope(event)) {
    return {
      name: event.shanken_signatory_name?.trim() || null,
      email: event.shanken_signatory_email?.trim() || null,
    };
  }
  return { name: WF_BS_COUNTERSIGN_GROUP_LABEL, email: null };
}
