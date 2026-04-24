# WhiskyFest Contracts

Internal contract management system for M. Shanken Communications — automates the sponsor contract workflow for WhiskyFest events from creation through accounting release.

## Tech stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Database**: Supabase (PostgreSQL with RLS)
- **Storage**: Supabase Storage
- **Auth**: NextAuth.js with Google OAuth (domain-restricted to @mshanken.com)
- **E-signature**: DocuSign (JWT Grant auth, Connect webhooks)
- **Templates & PDFs**: Google Docs API -> PDF export
- **Email**: SendGrid
- **Hosting**: Vercel
- **Additional**: Google Drive (backup archive), Google Sheets (team tracker)

## Quick links

- [Architecture](./docs/ARCHITECTURE.md) — system overview + diagrams
- [Workflow](./docs/WORKFLOW.md) — contract lifecycle with state + sequence diagrams
- [Deployment](./docs/DEPLOYMENT.md) — how to deploy + environment setup
- [API Reference](./docs/API.md) — endpoints + webhook handlers
- [Schema](./docs/SCHEMA.md) — database tables + relationships
- [Permissions](./docs/PERMISSIONS.md) — role-based access rules
- [Integrations](./docs/INTEGRATIONS.md) — external services explained
- [Troubleshooting](./docs/TROUBLESHOOTING.md) — common issues + fixes

## Getting started

### Prerequisites

- Node.js 20+
- pnpm (or npm)
- Vercel CLI (`npm i -g vercel`)
- Supabase account (for DB access)
- Access to Google Cloud project for service account
- Access to DocuSign developer account

### Local development

```bash
git clone https://github.com/mcapace/whiskyfest-contracts
cd whiskyfest-contracts
pnpm install

# Copy env template and fill in values
cp .env.example .env.local
# Edit .env.local with your credentials (see DEPLOYMENT.md)

pnpm dev
```

App runs at http://localhost:3000

### Google Docs contract template (line items)

After applying migration `025_contract_line_items.sql`, update the **Google Doc** used for PDFs (`GOOGLE_TEMPLATE_DOC_ID` in your env). Reference template document ID: `1W5wJvMPZUlHfIkZ7yscYBFQrVATzrvwNhHTNrupeQP4`.

1. Open that template in Google Drive (or the doc your `GOOGLE_TEMPLATE_DOC_ID` points to).
2. After the booth / pricing section, add a **new paragraph** containing exactly: `{{LINE_ITEMS_SECTION}}` (plain text placeholder; not a table). When the contract has no line items, this token is replaced with nothing so no blank block appears.
3. Optionally add `{{TOTAL_AMOUNT}}` anywhere you want the full contract total (booth + line items); `{{grand_total}}` is updated the same way.

### Key contacts

- **Owner / Product**: Michael Capace (mcapace@mshanken.com)
- **Events team**: Liz Mott, Jennifer Arcella, Susannah Nolan, Nicole Mazza, Tobi Alper
- **Finance/Accounting**: Danielle Bixler, AR Team

## Contributing

Pull requests welcome. Follow the existing patterns. Add tests where it makes sense.
