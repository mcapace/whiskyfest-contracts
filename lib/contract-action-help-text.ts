/** Exact copy for contextual help on contract lifecycle actions (tooltips). */

export const CONTRACT_ACTION_HELP = {
  voidContract:
    'Use when an error is found after sending. Voids the DocuSign envelope, invalidating any signatures already made. The original signer(s) will be notified automatically. Then create a new contract with corrections.',

  cancel:
    'Use when the deal is off — sponsor backed out, contract no longer relevant, or created by mistake. Terminates the contract entirely. If a DocuSign envelope exists, it\'s also voided. Different from Void in intent: Void = fix an error, Cancel = end the deal.',

  sendReminder:
    'Sends a follow-up email from DocuSign to any recipients who haven\'t signed yet. Useful if a contract has been sitting unsigned for a few days.',

  resendWithChanges:
    'Recalls the current envelope and lets you make edits before sending a new envelope. Any signatures already made on the current envelope are invalidated. Use when you need to update contract details before completing signing.',

  recall:
    'Pulls back the current DocuSign envelope and reverts the contract to draft. Any signatures already made are invalidated. Use if you need to stop the signing process without creating a new contract.',

  approveContract:
    'Reviews and approves this contract for sending via DocuSign. After approval, the sales rep can send it to the exhibitor.',

  sendBack:
    'Sends the contract back to draft status with your reason. The sales rep will receive the feedback and can make changes, then regenerate the PDF for review.',

  releaseToAccounting:
    'Marks the contract as executed and hands it off to the accounting team. An email with the signed PDF is sent to AR. Contract is ready for invoicing.',

  markInvoiceSent:
    'Records that you have sent the invoice to the exhibitor. Sales rep is automatically notified. Use when your invoice is out the door.',

  markPaid:
    'Records that payment has been received from the exhibitor. Sales rep is automatically notified. Marks the contract complete from an accounting standpoint.',

  generateDraftPdf:
    'Creates a PDF version of the contract from the current data. Submits to the events team for approval before DocuSign sending.',

  editContract:
    'Open the draft editor to change booth count, pricing, line items, exhibitor names, or signer contact — then regenerate the PDF before resubmitting.',

  regeneratePdf:
    'Rebuilds the contract PDF from the latest saved data. Use after edits while the contract is still under review.',

  approveDiscount:
    'Permits this below-standard booth rate so the contract can move forward to events review and DocuSign.',

  approveForSendingDisabled:
    'This action unlocks after an admin approves the discounted booth rate.',

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
} as const;
