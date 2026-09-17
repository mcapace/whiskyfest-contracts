# Suggested Response to Susannah & Danielle

---

**To:** Susannah, Danielle, Tobi, Jake  
**Subject:** Re: 2026 NYWE Open Contracts - Investigation

---

Hi team,

I've reviewed the contract issues Danielle reported. There appear to be data integrity problems in the portal where contracts are getting cross-linked. Let me investigate and resolve.

## Issues to Investigate:

### 1. **Allegrini → Showing Fontodi Contract**
- Allegrini marked as executed
- But viewing it displays Fontodi's contract instead
- Likely cause: Shared Google Drive PDF ID or DocuSign envelope ID

### 2. **Château Pichon → Showing First Drop Contract**
- Château Pichon Longueville Comtesse de Lalande shows First Drop instead
- Same type of cross-linking issue

### 3. **Jermann Portal Assignment**
- Appearing under "Stag's Leap Wine Cellars" portal
- Should this be reassigned to match Gallo's portal?

### 4. **Missing Gallo Contracts (5 total)**
Confirmed list:
- Louis M. Martini
- Massican
- Pahlmeyer
- Rombauer
- Jermann

## Next Steps:

**I need to run database diagnostics to determine:**
1. Are Allegrini/Fontodi sharing the same contract PDF/envelope ID?
2. Are Château Pichon/First Drop sharing the same contract PDF/envelope ID?
3. What is the actual execution status of these contracts?
4. What is Jermann's correct portal assignment?

**Then I will:**
1. Fix any cross-linked contract IDs
2. Correct Jermann's portal assignment
3. Verify execution status for all affected contracts
4. Send Danielle the correct Allegrini contract for invoicing

## Questions for Susannah:

1. **Jermann Portal:** Since Jermann is a Gallo winery, should it use the same portal as other Gallo brands, or remain separate?

2. **Château Pichon:** Do you have the DocuSign envelope ID for this contract? This will help me trace the correct document.

## Timeline:

I'll run the diagnostics queries now and report back with:
- Root cause analysis
- Affected contracts list
- Proposed fixes
- Timeline to resolve

**Danielle:** Once I identify the correct Allegrini contract, I'll send it directly to you for invoicing.

Let me investigate and I'll follow up shortly.

Mike

---

## Internal Notes (for Mike's reference):

- Run `INVESTIGATE_CONTRACT_MISMATCHES.sql` to find the issues
- Check for shared google_drive_pdf_id or docusign_envelope_id
- Look for contract record duplicates
- Verify portal_host assignments
- May need to update contract IDs or relationships
