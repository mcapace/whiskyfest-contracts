export type SignerCcFields = {
  signer_cc_name?: string | null;
  signer_cc_email?: string | null;
};

export function parseSignerCc(input: SignerCcFields): { name: string; email: string } | null {
  const email = input.signer_cc_email?.trim();
  if (!email) return null;
  const name = input.signer_cc_name?.trim() || email.split('@')[0] || 'Assistant';
  return { name, email };
}

export function validateSignerCcDistinct(params: {
  signerEmail: string;
  countersignerEmail: string;
  cc: { email: string } | null;
}): string | null {
  if (!params.cc) return null;
  const cc = params.cc.email.trim().toLowerCase();
  if (cc === params.signerEmail.trim().toLowerCase()) {
    return 'CC email must differ from the exhibitor signer email.';
  }
  if (cc === params.countersignerEmail.trim().toLowerCase()) {
    return 'CC email must differ from the Shanken countersigner email.';
  }
  return null;
}

export function normalizeSignerCcEmail(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeSignerCcName(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}
