import { EditDraftContractPage } from '@/lib/edit-draft-contract-page';

export const dynamic = 'force-dynamic';

export default async function WineSpectatorEditDraftContractPage({ params }: { params: { id: string } }) {
  return EditDraftContractPage({ params, portalBasePath: '/wine-spectator' });
}
