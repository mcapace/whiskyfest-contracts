# Workflow

## Contract lifecycle

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> pending_events_review
  pending_events_review --> approved
  pending_events_review --> draft: sent back for changes
  approved --> sent
  sent --> partially_signed
  partially_signed --> signed
  signed --> executed

  draft --> cancelled
  pending_events_review --> cancelled
  approved --> cancelled
  sent --> cancelled
  partially_signed --> cancelled

  sent --> voided
  partially_signed --> voided

  cancelled --> [*]
  voided --> [*]
  executed --> [*]
```

## Full signing sequence

```mermaid
sequenceDiagram
  participant SR as Sales Rep
  participant APP as WhiskyFest App
  participant EV as Events Team
  participant DS as DocuSign
  participant EX as Exhibitor
  participant CS as Countersigner
  participant AC as Accounting

  SR->>APP: Create contract
  APP->>APP: Store draft in Supabase
  SR->>APP: Generate draft PDF
  APP->>APP: Render template + upload PDF
  SR->>EV: Submit for review
  EV->>APP: Approve
  APP->>DS: Create envelope
  DS->>EX: Signature request email
  EX->>DS: Signs
  DS->>APP: Connect webhook (partially signed)
  CS->>DS: Countersigns
  DS->>APP: Connect webhook (completed/signed)
  APP->>APP: Store signed PDF + update status
  EV->>APP: Release to accounting
  APP->>AC: Contract available in AR dashboard
```

## Approval workflow

```mermaid
sequenceDiagram
  participant SR as Sales Rep / Assistant
  participant APP as WhiskyFest App
  participant EV as Events Team/Admin

  SR->>APP: Mark contract ready for review
  APP->>APP: status = pending_events_review
  EV->>APP: Review terms, pricing, details
  alt Needs changes
    EV->>APP: Send back with notes
    APP->>APP: status = draft
  else Approved
    EV->>APP: Approve
    APP->>APP: status = approved
  end
```

## Accounting handoff

```mermaid
sequenceDiagram
  participant EV as Events/Admin
  participant APP as WhiskyFest App
  participant AR as Accounting User

  EV->>APP: Release signed contract
  APP->>APP: status = executed
  APP->>AR: Contract appears in accounting dashboard
  AR->>APP: Mark invoice sent
  APP->>APP: invoice_status = invoice_sent
  AR->>APP: Mark paid
  APP->>APP: invoice_status = paid
```

## Void flow

```mermaid
sequenceDiagram
  participant ST as Staff (Admin/Events)
  participant APP as WhiskyFest App
  participant DS as DocuSign

  ST->>APP: Void contract (sent/partially signed)
  APP->>DS: Void envelope with reason
  DS-->>APP: Envelope voided
  APP->>APP: status = voided + audit log
  APP->>APP: Optional sheets + notifications update
```

## Role-specific behavior

- **Admin**: full pipeline visibility and action rights, including approval/release/void and user management.
- **Events team**: operational reviewers; can approve/send back/release and void in active signing states.
- **Sales rep**: creates/manages scoped contracts, generates/sends, tracks signer progress.
- **Assistant**: scoped to assigned reps; can monitor and assist with contract prep/send workflow.
- **Accounting**: focuses on executed contracts and invoice lifecycle progression.
