# Troubleshooting

## DocuSign auth failures

### `USER_AUTHENTICATION_FAILED`

- Confirm JWT user (`DOCUSIGN_USER_ID`) belongs to target account and has consent.
- Confirm app resolves `base_uri` from `/oauth/userinfo`.
- Ensure production env vars point to production auth domain.

### `invalid_grant`

- Re-check RSA private key formatting/base64 encoding in env.
- Verify keypair is registered on the integration key.
- Ensure server clock skew is small.

### `consent_required`

- Re-run consent flow for user + integration key in target environment.

## Webhook failures

### HMAC verification fails

- Compare DocuSign Connect key with `DOCUSIGN_CONNECT_HMAC_SECRET`.
- Ensure no accidental whitespace/newline mismatch.

### Webhook not firing

- Verify Connect configuration, subscribed events, and endpoint URL.
- Check DocuSign Connect logs/retries.

## PDF preview issues

### “You need access” or unavailable preview

- Contract may be legacy Google-Drive-first data.
- Use `/api/contracts/[id]/pdf` route fallback or regenerate if appropriate.

## Orphaned temp Google Docs

- Run dry-run first:
  - `/api/admin/cleanup-drive-temps?dryRun=true`
- Then execute cleanup:
  - `/api/admin/cleanup-drive-temps`
- Ensure service account has shared-drive rights sufficient for delete.

## Sales rep cannot see expected contracts

- Confirm user exists/active in `app_users`.
- Confirm matching entry in `sales_reps` with same email.
- Confirm contract `sales_rep_id` points to expected rep.
- For assistants, verify `rep_assistants` mapping.

## Performance concerns

- Inspect Vercel function durations for slow routes.
- Check heavy dashboard filters/queries and index coverage.
- Validate auth/session update patterns are not over-refreshing.

## Common DB/migration issues

### Migration says column already exists

- DB may be ahead in that environment; validate schema and continue.

### RLS/policy behavior unexpected

- Verify session identity email and role flags.
- For storage access, confirm `user_can_read_contract_pdf` logic and object path format.
