import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAccessToken, getDocuSignAccountId, restBase } from '@/lib/docusign';

export const runtime = 'nodejs';

/**
 * GET /api/debug/envelopes
 * GET /api/debug/envelopes?id=<envelopeId>
 *
 * Diagnostic: same JWT as production. List mode: last 7 days. By-id mode: single envelope.
 * Requires an app login session.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Must be logged in' }, { status: 401 });
  }

  const envelopeIdParam = new URL(req.url).searchParams.get('id')?.trim();
  if (envelopeIdParam) {
    return lookupEnvelopeById(envelopeIdParam);
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

async function lookupEnvelopeById(envelopeId: string) {
  let accountId: string;
  let baseUrl: string;
  try {
    accountId = getDocuSignAccountId();
    baseUrl = restBase();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        lookup_mode: 'by_id',
        envelope_id: envelopeId,
        error: message,
        docusign_status: 500,
      },
      { status: 200 },
    );
  }

  try {
    const accessToken = await getAccessToken();
    const singleUrl = new URL(
      `${baseUrl}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}`,
    );
    singleUrl.searchParams.set('include', 'recipients,custom_fields,documents');

    const envResp = await fetch(singleUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    const text = await envResp.text();

    if (!envResp.ok) {
      return NextResponse.json(
        {
          lookup_mode: 'by_id',
          envelope_id: envelopeId,
          account_id: accountId,
          error: text,
          docusign_status: envResp.status,
        },
        { status: 200 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = { _nonJsonBody: text };
    }

    return NextResponse.json(
      {
        lookup_mode: 'by_id',
        envelope_id: envelopeId,
        account_id: accountId,
        docusign_response: parsed,
        docusign_status: envResp.status,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        lookup_mode: 'by_id',
        envelope_id: envelopeId,
        account_id: accountId,
        error: message,
        docusign_status: 500,
      },
      { status: 200 },
    );
  }
}
