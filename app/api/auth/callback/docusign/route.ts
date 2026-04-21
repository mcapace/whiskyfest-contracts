import { NextResponse } from 'next/server';

/**
 * DocuSign OAuth consent callback — intentional no-op.
 *
 * This route exists only to absorb the browser redirect that happens
 * after a user grants consent to our DocuSign integration. We don't
 * actually need to handle the `code` param because we use JWT Grant
 * (not Authorization Code Grant). Consent is already recorded on
 * DocuSign's side by the time this route is hit.
 *
 * Without this explicit route, NextAuth's catch-all handler at
 * /api/auth/[...nextauth] intercepts the redirect and throws a
 * "Configuration" error because there is no `docusign` provider.
 */
export async function GET() {
  return new NextResponse(
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>DocuSign consent granted</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #fdf8f3; color: #3a1c10; }
    .card { max-width: 420px; padding: 32px; border: 1px solid #ecc28e;
            background: white; border-radius: 8px; text-align: center; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    p  { font-size: 14px; color: #555; margin: 8px 0; }
    a  { color: #a35327; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✓ DocuSign consent granted</h1>
    <p>You can close this tab and return to the app.</p>
    <p><a href="/">Back to WhiskyFest Contracts</a></p>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
}
