import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAccessToken, getDocuSignAccountId, restBase } from '@/lib/docusign';

export const runtime = 'nodejs';

/**
 * GET /api/debug/envelopes
 *
 * Diagnostic: same JWT as production code, lists envelopes in `DOCUSIGN_ACCOUNT_ID`
 * for the last 7 days. Requires an app login session.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Must be logged in' }, { status: 401 });
  }

  try {
    const accountId = getDocuSignAccountId();
    const baseUrl = restBase();
    const accessToken = await getAccessToken();

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    const fromDateStr = fromDate.toISOString().split('T')[0]!;

    const listUrl = new URL(`${baseUrl}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes`);
    listUrl.searchParams.set('from_date', fromDateStr);
    listUrl.searchParams.set('include', 'recipients,custom_fields');

    const envResp = await fetch(listUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!envResp.ok) {
      const err = await envResp.text();
      return NextResponse.json(
        {
          step: 'list envelopes',
          error: err,
          status: envResp.status,
          account_id: accountId,
          base_url: baseUrl,
        },
        { status: 200 },
      );
    }

    const data = (await envResp.json()) as {
      envelopes?: Record<string, unknown>[];
      totalSetSize?: number;
    };

    const summary = (data.envelopes ?? []).map((e: Record<string, unknown>) => {
      const recipients = e.recipients as { signers?: Record<string, unknown>[] } | undefined;
      const customFields = e.customFields as { textCustomFields?: Record<string, unknown>[] } | undefined;
      return {
        envelopeId: e.envelopeId,
        status: e.status,
        emailSubject: e.emailSubject,
        sentDateTime: e.sentDateTime,
        lastModifiedDateTime: e.lastModifiedDateTime,
        recipients: (recipients?.signers ?? []).map((s: Record<string, unknown>) => ({
          name: s.name,
          email: s.email,
          routingOrder: s.routingOrder,
          status: s.status,
        })),
        customFields: (customFields?.textCustomFields ?? []).map((f: Record<string, unknown>) => ({
          name: f.name,
          value: f.value,
        })),
      };
    });

    return NextResponse.json(
      {
        account_id: accountId,
        base_url: baseUrl,
        from_date: fromDateStr,
        total_envelopes: data.totalSetSize ?? summary.length,
        envelopes: summary,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        step: 'caught exception',
        error: message,
        stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5) : undefined,
      },
      { status: 200 },
    );
  }
}
