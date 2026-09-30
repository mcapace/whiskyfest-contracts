# WhiskyFest portal: signing-link durability, inline amendments, second signer, admin access

Four changes, all on the WhiskyFest workflow (NYWE and Big Smoke keep today's behaviour unless noted).

## 1. DocuSign links that stop "expiring"

What actually expired: the emailed portal link (`/sign?c=…&t=…`) never expires by time. The link it
opens is DocuSign's own one-time URL (valid ~5 minutes, single use), and an open signing session
idles out after ~20 minutes. Envelope lifetime was whatever the DocuSign account default happened to be.

Changes (`lib/docusign.ts`, `app/sign/ping/route.ts`, `app/sign/page.tsx`,
`lib/exhibitor-docusign-sign-redirect.ts`):

- Every envelope is sent with its own expiration and reminder settings instead of account defaults.
  Defaults: expire after **120 days**, warning 7 days before. Override with
  `DOCUSIGN_ENVELOPE_EXPIRE_AFTER_DAYS` (0 = never expire), `DOCUSIGN_ENVELOPE_EXPIRE_WARN_DAYS`,
  `DOCUSIGN_REMINDER_DELAY_DAYS` + `DOCUSIGN_REMINDER_FREQUENCY_DAYS` (DocuSign-side reminders, off
  unless both are set), or `DOCUSIGN_ENVELOPE_NOTIFICATION=account` to go back to account defaults.
- The embedded signing session pings `/sign/ping` every 5 minutes so it no longer times out while the
  signer reads.
- The signing page no longer tells signers the emailed link is single-use, and the "invalid or expired"
  message now says what it means (the signer on file changed).

Recommended: set a dedicated `DOCUSIGN_SIGN_LINK_SECRET` in Vercel so rotating `AUTH_SECRET` never
invalidates links that are already in inboxes.

## 2. Inline amendments (Revise and Send)

Before: a revision was a blind find-and-replace, unmatched edits vanished silently, nothing was
persisted, and fallback text was appended as an unstyled block that also printed empty on every contract.

Now (`lib/google-doc-paragraph-edits.ts`, `lib/google-doc-amendment-sections.ts`,
`lib/contract-revision-plan.ts`, `lib/google.ts`, `lib/contract-revision-preview.ts`):

- **Clause-level edits.** A plan can `replace`, `delete` or `insert_after` a whole paragraph, anchored by
  a distinctive phrase. Bullets, numbering and text style of the original paragraph are kept; an inserted
  clause inherits the style of the paragraph it follows. Phrase-level `text_replacements` /
  `text_deletions` still exist for names, dates and payment terms.
- **Verified.** Every find / anchor is checked. On preview, misses are reported; on a real send the
  render fails instead of dropping an edit from a document about to be signed.
- **Persisted.** The plan is stored on `contracts.revision_plan` and applied on every render: send,
  resend-with-changes, revise-and-send, generate, NYWE live draft. Later rounds layer on top of earlier
  ones unless "Start over" is ticked in the wizard.
- **Additional Terms look finished.** Each line entered becomes a numbered item under a bold
  "ADDITIONAL TERMS AND AMENDMENTS" heading; when there are none, the whole section (and an empty
  "EXHIBITOR NOTES" block) is removed from the PDF.
- **Preview before sending.** `POST /api/contracts/[id]/revision-preview` renders the revised PDF
  without voiding or sending. The wizard has a "Preview revised contract" button; sending is blocked
  while any edit does not match.
- **AI planning** now sees the merged contract, one numbered paragraph per line, and is told when to
  use a clause edit versus a phrase swap versus Additional Terms.
- Bug fixes: the wizard no longer wipes notes, brands, CC and billing fields it did not touch; the
  payment-terms heuristic no longer turns "thirty (30) days" into "60".

Migration: `supabase/migrations/091_signer_2_and_revision_plan.sql` (adds `revision_plan` and refreshes
`contracts_with_totals`).

## 3. Optional second client signer

Some exhibitors need two signatures on their side. Contracts now carry `signer_2_name`, `signer_2_title`,
`signer_2_email` (new contract form, edit draft, "Edit exhibitor signer", Revise and Send).

- DocuSign: the second signer is recipient 4 at routing order 1, in parallel with the primary signer;
  Whisky Advocate countersigns at routing order 2 only after both. They sign from DocuSign's own email.
  Tabs anchor on `\s3\` / `\d3\`.
- Status sync (`lib/docusign-envelope-sync.ts`, webhook): the contract only moves to
  `partially_signed` when **every** client signer has signed.
- Template: one master serves both cases. The portal itself inserts `{{signer_2_block}}` on its own
  line under the exhibitor "Signature … Date" line of the WhiskyFest master the first time a two-signer
  contract is sent from it (idempotent, uses the service account that already edits template copies).
  With a second signer the token expands to an "ADDITIONAL AUTHORIZED SIGNATORY" block (name, title,
  signature, date); without one it renders as nothing. An admin can also check or run the insertion up
  front: `GET` / `POST /api/admin/templates/second-signer` (or the standalone
  `scripts/patch-wf-template-second-signer.mts`). Only if no exhibitor signature line can be found is
  the send refused with a message saying where to paste the token.

Migration: same file as above (`091_signer_2_and_revision_plan.sql`).

## 4. Katherine Brumley: WhiskyFest admin

`supabase/migrations/090_kate_brumley_whiskyfest_admin.sql` sets `role = admin`, `is_events_team = true`
and keeps her existing view-all / Big Smoke flags. That unlocks recall, revise-and-send, resend-with-changes,
void, cancel, discount approval and signer edits on WhiskyFest contracts. Her email filters
(`WHISKYFEST_KATE_NOTIFICATION_KINDS`) still apply.

## Rollout checklist

1. Run migrations 090 and 091 in Supabase (SQL editor or `supabase db push`). Done 2026-09-30.
2. Deploy. No env changes are required; set the optional DocuSign variables above if you want different
   expiration or DocuSign-side reminders.
3. Nothing to do for the template: the second-signer block is added automatically on first use.
4. Try one revision on a test contract: Revise and Send → describe the change → Analyze → Preview → send.

`npm run lint` now runs without prompting (`.eslintrc.json`, next/core-web-vitals).
