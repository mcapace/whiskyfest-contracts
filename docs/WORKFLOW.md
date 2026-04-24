# Contract Workflow — WhiskyFest Contracts

This document describes how a sponsor contract moves through the WhiskyFest Contracts application, from first draft to final payment.

## Overview

A contract follows a defined path through the system. Different roles participate at different stages. The app automates all status transitions and notifications, so each party only takes action when it's their turn.

---

## 1. Contract State Machine

Every contract exists in one of these states. Transitions are controlled by app actions (clicks or webhook events).

```mermaid
stateDiagram-v2
    [*] --> draft: Sales rep creates
    
    draft --> pending_events_review: Generate Draft PDF
    draft --> cancelled: Cancel
    
    pending_events_review --> approved: Events team approves
    pending_events_review --> draft: Events team rejects (sent back)
    pending_events_review --> cancelled: Cancel
    
    approved --> sent: Send via DocuSign
    approved --> cancelled: Cancel
    
    sent --> partially_signed: Exhibitor signs
    sent --> voided: Void (admin/events)
    sent --> declined: Exhibitor declines in DocuSign
    sent --> cancelled: Cancel
    
    partially_signed --> signed: Countersigner signs
    partially_signed --> voided: Void (admin/events)
    partially_signed --> declined: Countersigner declines
    
    signed --> executed: Release to Accounting
    
    executed --> [*]
    cancelled --> [*]
    voided --> [*]
    declined --> [*]
```

### State definitions

| State | Meaning |
|-------|---------|
| **draft** | Contract is being created or edited. No external parties involved. |
| **pending_events_review** | PDF generated. Events team must review and approve before it can be sent. |
| **approved** | Events team has approved. Sales rep can now send via DocuSign. |
| **sent** | DocuSign envelope created. Exhibitor has been emailed to sign. |
| **partially_signed** | Exhibitor has signed. Awaiting M. Shanken countersignature. |
| **signed** | Both parties have signed. Contract is fully executed legally. |
| **executed** | Accounting has been notified. Contract is ready for invoicing. |
| **cancelled** | Contract was cancelled before completion. Not legally binding. |
| **voided** | Contract was voided by admin/events after being sent. DocuSign envelope is invalidated. |
| **declined** | Exhibitor or countersigner explicitly declined in DocuSign. |

---

## 2. Full Signing Sequence

End-to-end flow of a typical contract, from sales rep creation through accounting handoff.

```mermaid
sequenceDiagram
    autonumber
    participant Rep as Sales Rep
    participant App
    participant DB as Database
    participant Events as Events Team
    participant DocuSign
    participant Exhibitor
    participant Countersigner as Countersigner<br/>(Susannah Nolan)
    participant Accounting
    
    Rep->>App: Create contract (draft)
    App->>DB: Save as draft
    Rep->>App: Generate Draft PDF
    App->>App: Render template with booth + line items
    App->>DB: Save PDF to Supabase Storage
    App-->>Events: Email: contract ready for review
    App->>DB: Status = pending_events_review
    
    Events->>App: Review PDF, click Approve
    App->>DB: Status = approved
    App-->>Rep: Email: contract approved
    
    Rep->>App: Send via DocuSign
    App->>DocuSign: Create envelope (JWT Grant auth)
    DocuSign-->>Exhibitor: Email: Sign contract
    App->>DB: Status = sent
    
    Exhibitor->>DocuSign: Review and sign
    DocuSign->>App: Webhook: envelope-partially-signed
    App->>DB: Status = partially_signed
    App-->>Events: Email: needs countersignature
    DocuSign-->>Countersigner: Email: Sign contract
    
    Countersigner->>DocuSign: Sign
    DocuSign->>App: Webhook: envelope-signed
    App->>DB: Status = signed<br/>Save countersigner identity
    App->>DB: Fetch signed PDF
    App-->>Rep: Email: contract fully signed
    App-->>Events: Email: contract fully signed
    
    Events->>App: Release to Accounting
    App->>DB: Status = executed
    App-->>Accounting: Email: ready to invoice<br/>+ PDF attachment
    App-->>Rep: Email: released to accounting
    
    Accounting->>App: Mark Invoice Sent
    App->>DB: invoice_status = invoice_sent
    App-->>Rep: Email: invoice sent
    
    Accounting->>App: Mark Paid
    App->>DB: invoice_status = paid
    App-->>Rep: Email: payment received
```

---

## 3. Events Team Approval Workflow

Focused view of the approval stage — what the events team sees and does when a contract lands in their queue.

```mermaid
sequenceDiagram
    autonumber
    participant Rep as Sales Rep
    participant App
    participant DB as Database
    participant Events as Events Team<br/>(Liz, Jen, Susannah, etc.)
    
    Rep->>App: Generate Draft PDF
    App->>App: Create Google Doc from template<br/>Replace placeholders with contract data<br/>Insert line items as table rows<br/>Export as PDF
    App->>DB: Save PDF to Supabase Storage<br/>Status = pending_events_review
    App-->>Events: Email notification<br/>"Contract needs review"
    
    Note over Events: Click email link<br/>Opens contract detail page
    Events->>App: View PDF
    
    alt Approve
        Events->>App: Click Approve
        App->>DB: Status = approved<br/>events_approved_at = now<br/>events_approved_by = reviewer email
        App-->>Rep: Email: approved, ready to send
    else Send back for changes
        Events->>App: Click Send Back with reason
        App->>DB: Status = draft<br/>events_sent_back_reason = provided reason
        App-->>Rep: Email: sent back, reason explained
        Note over Rep: Make changes, regenerate PDF
    else Reject entirely
        Events->>App: Click Cancel
        App->>DB: Status = cancelled<br/>cancelled_reason = provided reason
        App-->>Rep: Email: cancelled, reason explained
    end
```

---

## 4. Accounting Handoff

What happens after a contract is fully signed and moves into the accounting phase.

```mermaid
sequenceDiagram
    autonumber
    participant Events as Events Team
    participant App
    participant DB as Database
    participant Accounting as Accounting<br/>(AR Team, Danielle Bixler)
    participant Rep as Sales Rep
    
    Note over App: Contract is fully signed<br/>Status = signed
    
    Events->>App: Click Release to Accounting
    App->>DB: Status = executed<br/>executed_at = now<br/>accounting_notified_at = now
    App-->>Accounting: Email with signed PDF attached<br/>+ contract summary table<br/>+ total amount
    App-->>Rep: Email: contract released to accounting
    
    Note over Accounting: Opens email<br/>Reviews contract details<br/>Prepares invoice
    
    Accounting->>App: Open contract in accounting dashboard
    Accounting->>App: Click Mark Invoice Sent<br/>(optional: add invoice number in notes)
    App->>DB: invoice_status = invoice_sent<br/>invoice_sent_at = now<br/>invoice_sent_by = user email
    App-->>Rep: Email: invoice sent to exhibitor
    
    Note over Accounting: Payment arrives
    Accounting->>App: Click Mark Paid
    App->>DB: invoice_status = paid<br/>paid_at = now<br/>paid_by = user email
    App-->>Rep: Email: payment received
```

### Accounting contract states

| Invoice Status | Meaning |
|---------------|---------|
| **pending** | Contract is executed, ready to invoice. Default state when contract moves to executed. |
| **invoice_sent** | Invoice has been sent to the exhibitor. Awaiting payment. |
| **paid** | Payment has been received. Contract is closed from the accounting perspective. |

---

## 5. Void Flow

When an error is discovered after a contract has been sent (but before full execution), an admin or events team member can void it.

```mermaid
sequenceDiagram
    autonumber
    participant Admin as Admin or Events Team
    participant App
    participant DocuSign
    participant DB as Database
    participant Sheet as Google Sheet Tracker
    participant Rep as Sales Rep
    
    Note over App: Contract is in sent or<br/>partially_signed status
    
    Admin->>App: Open contract, click Void
    App->>App: Show confirmation dialog<br/>"This will void the envelope.<br/>Reason (required)"
    Admin->>App: Enter reason, confirm
    
    App->>DocuSign: PUT envelope status=voided<br/>voidedReason=reason
    DocuSign->>DocuSign: Invalidate envelope<br/>Notify signers automatically
    
    App->>DB: Status = voided<br/>voided_at = now<br/>voided_by = admin email<br/>voided_reason = reason
    App->>DB: Write to audit_log
    
    App->>Sheet: Update row<br/>Status/Notes = Voided MM/DD<br/>RSVP = No
    
    App-->>Rep: Email: contract voided<br/>+ reason
    App-->>Admin: Email: void confirmation
    
    Note over Rep: Create new contract<br/>with corrections
```

### Void availability

Void is ONLY available when:
- Contract status is `sent` OR `partially_signed`
- User has admin or events team role

Void is NOT available when:
- Contract is in draft, pending_events_review, approved → use cancel instead
- Contract is signed or executed → too late, use accounting/cancellation workflow
- Contract is already voided, cancelled, or declined → terminal states

---

## 6. Role-Based Views

What each role sees and can do in the app.

```mermaid
graph LR
    subgraph "Sales Rep"
        A1[Own contracts only]
        A2[Create new contracts]
        A3[Generate PDFs]
        A4[Send via DocuSign]
        A5[Track status]
    end
    
    subgraph "Assistant"
        B1[Contracts for assigned reps]
        B2[Create on their behalf]
        B3[Same actions as reps]
    end
    
    subgraph "Events Team"
        C1[All contracts]
        C2[Review approval queue]
        C3[Approve / Reject / Send back]
        C4[Release to Accounting]
        C5[Void contracts]
    end
    
    subgraph "Accounting"
        D1[Executed contracts only]
        D2[Mark Invoice Sent]
        D3[Mark Paid]
        D4[Accounting dashboard]
    end
    
    subgraph "Admin"
        E1[Full access]
        E2[All of the above]
        E3[User management]
        E4[View as... any user]
        E5[System settings]
    end
```

### Permission matrix (summary)

| Action | Sales Rep | Assistant | Events Team | Accounting | Admin |
|--------|-----------|-----------|-------------|------------|-------|
| Create contract | ✓ own | ✓ for their reps | ✓ | ✗ | ✓ |
| Edit contract (draft) | ✓ own | ✓ for their reps | ✓ | ✗ | ✓ |
| Approve contract | ✗ | ✗ | ✓ | ✗ | ✓ |
| Send via DocuSign | ✓ own | ✓ for their reps | ✓ | ✗ | ✓ |
| Release to Accounting | ✗ | ✗ | ✓ | ✗ | ✓ |
| Void contract | ✗ | ✗ | ✓ | ✗ | ✓ |
| Cancel contract | ✗ | ✗ | ✓ | ✗ | ✓ |
| Mark Invoice Sent | ✗ | ✗ | ✗ | ✓ | ✓ |
| Mark Paid | ✗ | ✗ | ✗ | ✓ | ✓ |
| Impersonate users | ✗ | ✗ | ✗ | ✗ | If flagged |
| User management | ✗ | ✗ | ✗ | ✗ | ✓ |

---

## 7. External Integrations at a Glance

How the app interacts with external services during the workflow.

```mermaid
graph TB
    App[WhiskyFest Contracts App]
    
    App -->|Create contract PDF| GDocs[Google Docs API<br/>Template rendering]
    GDocs -->|Export PDF| Drive[Google Drive<br/>Backup archive]
    App -->|Store signed PDF| SBStorage[Supabase Storage<br/>Private bucket]
    
    App -->|JWT Grant<br/>Create envelope| DocuSign[DocuSign<br/>E-signature]
    DocuSign -->|Connect webhook<br/>Status events| App
    
    App -->|Append/update row<br/>on partial-sig| Sheets[Google Sheets<br/>Team tracker]
    
    App -->|Transactional email| SendGrid[SendGrid<br/>Notifications]
    
    App -->|Google OAuth<br/>@mshanken.com only| Auth[NextAuth<br/>Session]
    
    App <-->|Contract records<br/>User auth<br/>Audit log| Supabase[Supabase PostgreSQL<br/>Primary database]
```

---

## 8. Status Transition Triggers

Quick reference: what causes each status change?

| From | To | Trigger |
|------|-----|--------|
| (none) | draft | Sales rep creates contract |
| draft | pending_events_review | Sales rep generates Draft PDF |
| pending_events_review | approved | Events team clicks Approve |
| pending_events_review | draft | Events team sends back with reason |
| approved | sent | Sales rep clicks Send via DocuSign |
| sent | partially_signed | DocuSign webhook: exhibitor signed |
| partially_signed | signed | DocuSign webhook: countersigner signed |
| signed | executed | Events team clicks Release to Accounting |
| executed | invoice_sent (invoice_status) | Accounting clicks Mark Invoice Sent |
| invoice_sent | paid (invoice_status) | Accounting clicks Mark Paid |
| sent or partially_signed | voided | Admin/events clicks Void + provides reason |
| any active state | cancelled | Admin/events clicks Cancel |

---

## Glossary

**Contract** — A legal agreement between M. Shanken and an exhibitor for WhiskyFest sponsorship.

**Envelope** — DocuSign terminology for a signable document package. One contract = one envelope.

**Events team** — Internal team responsible for reviewing and approving contracts before they go to exhibitors. Also countersigns on behalf of M. Shanken.

**Countersignatory** — The M. Shanken representative who signs after the exhibitor. Currently: Susannah Nolan, Senior Event Director.

**Executed** — A signed contract that has been released to the accounting team for invoicing.

**Paid** — The exhibitor has paid their invoice. Final state for the contract.

**JWT Grant** — DocuSign's service-to-service authentication mechanism using signed JSON Web Tokens.

**Connect Webhook** — DocuSign's system for pushing envelope events (signed, declined, voided, etc.) to the app in real time.

---

*Last updated: [date of last deploy]*
*Contact: Michael Capace — mcapace@mshanken.com*
