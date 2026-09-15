# Response for Tobi - What to Do About "Nowhere to Sign" Issues

## Quick Answer

**Use "Send Reminder"** first — it emails a secure portal link to review and sign the same agreement.

Use **"Send personal note"** when you need a custom message or want to CC a colleague.

---

## Why This Happens

When exhibitors say "nowhere to sign," it's usually:

1. **They're stuck on page 1** - Need to click yellow "Start", then "Next" to page 2, then look mid-left for "Sign Here"
2. **Wrong person opened it** - e.g., CC recipient (like Jennifer at Kobrand) gets view-only; only the actual signer (like Ellie) can sign
3. **Forwarded DocuSign link** - Often breaks or opens as view-only
4. **DocuSign email blocked** - Some company filters block DocuSign; the portal reminder link still works

---

## What Each Button Does

### ✅ "Send Reminder" (Default — use this)

**One click.** Emails the signer a branded message with a **Review and sign agreement** button.

- Opens the **same** DocuSign envelope (not a new contract)
- Works even when DocuSign’s own emails are blocked
- Includes short instructions (Start → page 2 → Sign Here)
- Does **not** change who can sign

**When to use:** They forgot, didn’t get DocuSign mail, or say there’s nowhere to sign.

---

### ✅ "Send personal note" (Custom message)

Same signing link as Reminder, plus:

- Your own written message
- Optional CC to a colleague

**When to use:** You want a personal touch or need to explain something specific.

---

## How to Use "Send Reminder"

1. **Open the contract** in the portal (e.g. bigsmokecontracts.cigaraficionado.com, nywecontracts.winespectator.com, or wacontracts.whiskyadvocate.com)

2. **Click "Send Reminder"** in Actions

3. The signer gets an email with **Review and sign agreement** — they click it, then **Continue to sign** on the landing page to open DocuSign

---

## How to Use "Send personal note"

1. Open the contract → **Send personal note**

2. Write your message (optional CC)

3. Click **Send**

The email automatically includes:

> "This link opens the same agreement we originally sent you — not a new contract. Click the button below, then press 'Continue to sign' on the next page to open DocuSign. In DocuSign, click Start if prompted; your signature is on page 2 (use Next if you do not see it). No Shanken login is required. This works even if your company email blocks messages from DocuSign."

---

## Sample Message for Personal Note

```
Hi [Exhibitor Name],

Thanks for reaching out about the signing issue. I'm sending you a direct
link to sign your agreement.

The "Sign Here" box is on page 2 of the DocuSign document:

1. Click the button in this email
2. Click the yellow "Start" button
3. Click "Next" to go to page 2
4. Look for the "Sign Here" box on the mid-left of the page

Let me know if you still can't find it and I'll walk you through it!

Best,
Tobi
```

---

## Technical Details (For Reference)

- **Send Reminder** (`sent`): SendGrid email with portal `/sign?c=…&t=…` link → DocuSign recipient view
- **Send Reminder** (`partially_signed`): DocuSign native resend (countersigners)
- **Send personal note**: Same portal link + custom body + optional CC

**Location in portal:** Contract Actions (DocuSign group)

---

## Summary for Tobi

**When exhibitors haven’t signed or say "nowhere to sign":**

✅ **Use:** Send Reminder (default)  
✅ **Or:** Send personal note (custom message / CC)

Both include a proper signing link that opens the live envelope.
