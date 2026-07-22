/** Exact copy for contextual help on contract lifecycle actions (tooltips). */

export const CONTRACT_ACTION_HELP = {
  voidContract:
    'Invalidate this contract when the deal is dead or the executed terms are wrong. For executed deals, void first, then use Edit and re-send to fix the amount and send a new DocuSign. Accounting is notified when an executed contract is voided.',

  voidExecutedContract:
    'Void a fully executed contract so you can correct the dollar amount (or other terms) and re-send. Accounting is alerted not to invoice the prior PDF. Then use Edit and re-send on this same record.',

  cancel: 'Use when the deal is off. Terminates the contract entirely.',

  sendReminder:
    'Ask DocuSign to resend its standard signing email to outstanding recipients on the same envelope. Use when the client can receive @docusign.net mail; pair with Send personal note when they cannot.',

  sendPersonalNudge:
    'Send a personal follow-up to the unsigned signer with a secure link to sign the same original DocuSign agreement (bulk or individual send). Does not void or resend the envelope. Optionally CC a colleague.',

  syncFromDocusign:
    'Pull the latest signature status from DocuSign and update this contract if a webhook was missed (exhibitor signed or fully executed).',

  resendWithChanges: 'Recall current envelope, edit contract, send new envelope.',

  recall:
    'Pull the envelope back to make edits. Returns the contract to draft so booths, brands, pricing, and signer can change before you generate a new PDF and send again.',

  approveContract: 'Approve for sending via DocuSign.',

  sendBack: 'Return to draft with feedback for the sales rep.',

  releaseToAccounting: 'Marks contract executed and hands off to AR for invoicing.',

  releaseImported:
    'Releases this legacy imported agreement to accounting — same AR email handoff as fully signed DocuSign contracts.',

  editImportedContract: 'Fix typos or amounts on an imported record before it is released to accounting.',
  editVoidedContract:
    'Reopen this voided deal for edits (including after voiding an executed contract). Saving moves it back to draft so you can update pricing, regenerate the PDF, and re-send.',
  redraftCancelled:
    'Return this cancelled contract to draft, void any linked DocuSign envelope, and open the editor so you can regenerate and send again.',

  voidImportedRecord:
    'Permanently marks this imported record void when the deal should not continue in the system. No DocuSign envelope is involved.',

  markInvoiceSent: 'Records invoice sent. Sales rep (or configured NYWE ops inbox) notified.',

  recallInvoiceSent:
    'Undo Invoice Sent and return this contract to Pending Invoice. Use if it was marked sent by mistake or the invoice needs to be corrected and re-sent. Does not notify the sales rep.',

  voidInvoiceSent:
    'Permanently void a sent invoice (accounting/admin only). Removes it from the billed export and marks Invoice Voided. Requires a reason. Accounting can Mark Invoice Sent again (then Mark Paid) or Restore to Pending.',

  restoreVoidedInvoice:
    'Return a voided invoice to Pending without marking it sent yet.',

  markPaid: 'Records payment received. Sales rep (or configured NYWE ops inbox) notified.',

  generateDraftPdf:
    'Creates a PDF version of the contract from the current data. Submits to the events team for approval before DocuSign sending.',

  editContract:
    'Open the draft editor to change booth count, pricing, line items, exhibitor names, or signer contact — then regenerate the PDF before resubmitting.',

  regeneratePdf:
    'Rebuilds the contract PDF from the latest saved data. Use after edits while the contract is still under review.',

  approveDiscount:
    'Admin approval for below-minimum booth rate. Required before contract proceeds.',

  approveForSendingDisabled:
    'Discount approval required first. An admin must approve the discounted booth rate.',

  viewDraftPdf:
    'Opens the latest draft PDF in a new tab for review before approval or sending.',

  sendViaDocusign:
    'Creates the DocuSign envelope and emails the exhibitor signer to complete the agreement.',

  viewSignedPdf:
    'Opens the fully executed contract PDF in a new tab.',

  viewErrorDetails:
    'Shows technical details stored when send or PDF generation failed.',

  resetToDraft:
    'Clears the error state and returns the contract to draft so you can fix issues and try again. Internal notes may be cleared.',

  reviseAndSend:
    'Void the in-flight DocuSign envelope, analyze client change requests with AI, apply edits throughout the master contract template (names, payment terms, deletions), and send a new envelope — or send an uploaded PDF as-is.',
} as const;
