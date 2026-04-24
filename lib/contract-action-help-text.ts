/** Exact copy for contextual help on contract lifecycle actions (tooltips). */

export const CONTRACT_ACTION_HELP = {
  voidContract:
    'Use when an error is found after sending. Voids the DocuSign envelope, invalidating signatures. Then create a new contract with corrections.',

  cancel: 'Use when the deal is off. Terminates the contract entirely.',

  sendReminder: 'Follow-up email to unsigned recipients.',

  resendWithChanges: 'Recall current envelope, edit contract, send new envelope.',

  recall: 'Pulls back the DocuSign envelope and reverts to draft. Any signatures made are invalidated.',

  approveContract: 'Approve for sending via DocuSign.',

  sendBack: 'Return to draft with feedback for the sales rep.',

  releaseToAccounting: 'Marks contract executed and hands off to AR for invoicing.',

  markInvoiceSent: 'Records invoice sent. Sales rep notified.',

  markPaid: 'Records payment received. Sales rep notified.',

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
} as const;
