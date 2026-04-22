import { NextResponse } from 'next/server';

/**
 * Legacy endpoint — sales rep / admin "Approve for Sending" is replaced by the events team
 * approval flow (`pending_events_review` → `events-approve`).
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Contract approval for DocuSign is handled by the events team. Generate or regenerate the PDF to submit for review, then an events team member approves.',
    },
    { status: 400 },
  );
}
