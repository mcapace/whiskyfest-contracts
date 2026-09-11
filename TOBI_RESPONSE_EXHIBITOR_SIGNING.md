# Response for Tobi - What to Do About "Nowhere to Sign" Issues

## Quick Answer

**Use "Send personal note"** instead of "Send Reminder" when exhibitors say they can't find where to sign.

---

## Why This Happens

Based on Mike's email, when exhibitors say "nowhere to sign," it's usually:

1. **They're stuck on page 1** - Need to click yellow "Start", then "Next" to page 2, then look mid-left for "Sign Here"
2. **Wrong person opened it** - e.g., CC recipient (like Jennifer at Kobrand) gets view-only; only the actual signer (like Ellie) can sign
3. **Forwarded DocuSign link** - Often breaks or opens as view-only

---

## What Each Button Does

### ❌ "Send Reminder" (Don't Use for This)
- Just re-sends DocuSign's standard email
- Goes to the same people already on the envelope
- **Does NOT help** if they're confused about where to sign
- **Does NOT change** who can sign

**When to use:** Only if they genuinely forgot and need the same DocuSign email again.

---

### ✅ "Send personal note" (Use This!)
**This is what Tobi should use!**

**What it does:**
- Sends a **custom email from you** (not generic DocuSign)
- Includes your personal message
- Gives them a **special signing link** that works even if they can't find DocuSign emails
- Includes **clear instructions** on exactly how to sign
- Can CC a colleague

**The email automatically includes:**
> "This link opens the same agreement we originally sent you — not a new contract. Click the button below, then press 'Continue to sign' on the next page to open DocuSign. In DocuSign, click Start if prompted; your signature is on page 2 (use Next if you do not see it). No Shanken login is required. This works even if your company email blocks messages from DocuSign."

**Perfect for:**
- "I can't find where to sign" issues ✅
- "I didn't get the DocuSign email" ✅
- Need to explain something specific ✅
- Want to add personal touch ✅

---

## How to Use "Send personal note"

1. **Open the contract** in the portal (bigsmokecontracts.cigaraficionado.com)

2. **Click "Send personal note"** button

3. **Write your message**, for example:
   ```
   Hi [Name],

   I wanted to personally reach out about your Big Smoke Las Vegas agreement. 
   I know the DocuSign emails can be confusing sometimes.

   Click the button below for a direct link to sign. Once you're in DocuSign:
   - Click the yellow "Start" button
   - Click "Next" to go to page 2
   - Look for the "Sign Here" box on the mid-left of the page
   - That's it!

   Let me know if you have any questions.

   Best,
   Tobi
   ```

4. **Optional:** Add a CC email if you want someone else to see it

5. **Click "Send"**

---

## Sample Message for Tobi

For exhibitors saying "nowhere to sign":

```
Hi [Exhibitor Name],

Thanks for reaching out about the signing issue. I'm sending you a direct 
link to sign your Big Smoke Las Vegas agreement.

The "Sign Here" box is on page 2 of the DocuSign document. Here's exactly 
how to find it:

1. Click the button in this email to open DocuSign
2. Click the yellow "Start" button
3. Click "Next" to go to page 2
4. Look for the "Sign Here" box on the mid-left of the page

The system may also guide you through with yellow highlights. Let me know if 
you still can't find it and I'll walk you through it!

Best,
Tobi
```

---

## Technical Details (For Reference)

**From the code:**
- "Send Reminder" just calls DocuSign API to resend their standard email
- "Send personal note" sends a custom SendGrid email with:
  - Your personal message
  - Clear signing instructions (automatically added)
  - Special signing link that bypasses common issues
  - Optional CC to colleague

**Location in portal:** Contract actions area (same place as Send Reminder button)

---

## Summary for Tobi

**When exhibitors say "nowhere to sign":**

❌ **Don't use:** Send Reminder (doesn't help)  
✅ **Use:** Send personal note (solves the problem)

**The personal note email automatically includes the instructions they need!**
