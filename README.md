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

### Contract PDFs and line items

Optional **line items** (sponsorships, activations, etc.) are stored in Postgres and merged into the existing **CONTRACT ORDER** Google Doc table at PDF time: the app inserts table rows above the **GRAND TOTAL** row via the Google Docs API—no manual template changes are required for line-item layout. Apply migrations through `026_contract_line_items_view_rename.sql` (includes `025` for the `contract_line_items` table).

### Key contacts

- **Owner / Product**: Michael Capace (mcapace@mshanken.com)
- **Events team**: Liz Mott, Jennifer Arcella, Susannah Nolan, Nicole Mazza, Tobi Alper
- **Finance/Accounting**: Danielle Bixler, AR Team

## Contributing

Pull requests welcome. Follow the existing patterns. Add tests where it makes sense.
