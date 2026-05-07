export type ExhibitorFieldMergeMode = 'draft' | 'docusign';

/**
 * Google Doc merge tokens for exhibitor-captured fields. In `docusign` mode each resolves to a
 * unique anchor string (same as DocuSign text tab `anchorString`).
 *
 * Tab `anchorXOffset` / `anchorYOffset` are kept at (or near) zero so fields sit on the anchor
 * text the template places at the start of each fill line. Large positive X offsets were
 * shifting tabs into a staircase / overlap when the PDF layout did not match an older inline
 * mock-up.
 *
 * Add to contract Google Doc (alongside existing billing/event blocks):
 *   MAILING / CORPORATE ADDRESS
 *   {{exhibitor_address_line1}}
 *   {{exhibitor_address_line2}}
 *   {{exhibitor_city}}, {{exhibitor_state}} {{exhibitor_zip}}
 *   {{exhibitor_country}}
 *   {{exhibitor_telephone}}   (near "Telephone:" in FESTIVAL SPONSOR block)
 */
export const EXHIBITOR_DOCUSIGN_TAB_LABELS = [
  'exhibitor_address_line1',
  'exhibitor_address_line2',
  'exhibitor_city',
  'exhibitor_state',
  'exhibitor_zip',
  'exhibitor_country',
  'exhibitor_telephone',
  'billing_contact_name',
  'billing_contact_email',
  'billing_address_line1',
  'billing_address_line2',
  'billing_city',
  'billing_state',
  'billing_zip',
  'billing_country',
  'event_contact_name',
  'event_contact_email',
] as const;

export type ExhibitorDocuSignTabLabel = (typeof EXHIBITOR_DOCUSIGN_TAB_LABELS)[number];

const ANCHOR: Record<ExhibitorDocuSignTabLabel, string> = {
  exhibitor_address_line1: '\\mal1\\',
  exhibitor_address_line2: '\\mal2\\',
  exhibitor_city: '\\mct\\',
  exhibitor_state: '\\mst\\',
  exhibitor_zip: '\\mzp\\',
  exhibitor_country: '\\mcy\\',
  exhibitor_telephone: '\\mtl\\',
  billing_contact_name: '\\bcn\\',
  billing_contact_email: '\\bce\\',
  billing_address_line1: '\\ba1\\',
  billing_address_line2: '\\ba2\\',
  billing_city: '\\bct\\',
  billing_state: '\\bst\\',
  billing_zip: '\\bzp\\',
  billing_country: '\\bcy\\',
  event_contact_name: '\\ecn\\',
  event_contact_email: '\\ece\\',
};

export function exhibitorFieldMergeTokens(mode: ExhibitorFieldMergeMode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of EXHIBITOR_DOCUSIGN_TAB_LABELS) {
    out[`{{${key}}}`] = mode === 'draft' ? '' : ANCHOR[key];
  }
  return out;
}

type TextTabDef = {
  tabLabel: ExhibitorDocuSignTabLabel;
  anchorString: string;
  anchorXOffset: string;
  anchorYOffset: string;
  anchorUnits: 'inches';
  documentId: string;
  required: 'true' | 'false';
  width: string;
  height: string;
  font: 'Arial';
  fontSize: 'Size11' | 'Size12';
  validationPattern?: string;
};

/** DocuSign REST textTabs for routing-order-1 (exhibitor) recipient — mailing first, then billing, then optional event. */
export function buildExhibitorDataTextTabs(): { textTabs: TextTabDef[] } {
  const tabs: TextTabDef[] = [
    {
      tabLabel: 'exhibitor_address_line1',
      required: 'true',
      anchorString: ANCHOR.exhibitor_address_line1,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '240',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'exhibitor_address_line2',
      required: 'false',
      anchorString: ANCHOR.exhibitor_address_line2,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '240',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'exhibitor_city',
      required: 'true',
      anchorString: ANCHOR.exhibitor_city,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '180',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'exhibitor_state',
      required: 'true',
      anchorString: ANCHOR.exhibitor_state,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '60',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'exhibitor_zip',
      required: 'true',
      anchorString: ANCHOR.exhibitor_zip,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '100',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'exhibitor_country',
      required: 'true',
      anchorString: ANCHOR.exhibitor_country,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '140',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'exhibitor_telephone',
      required: 'true',
      anchorString: ANCHOR.exhibitor_telephone,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '160',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'billing_contact_name',
      required: 'true',
      anchorString: ANCHOR.billing_contact_name,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '220',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'billing_contact_email',
      required: 'true',
      validationPattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
      anchorString: ANCHOR.billing_contact_email,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '260',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'billing_address_line1',
      required: 'true',
      anchorString: ANCHOR.billing_address_line1,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '240',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'billing_address_line2',
      required: 'false',
      anchorString: ANCHOR.billing_address_line2,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '240',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'billing_city',
      required: 'true',
      anchorString: ANCHOR.billing_city,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '180',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'billing_state',
      required: 'true',
      anchorString: ANCHOR.billing_state,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '60',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'billing_zip',
      required: 'true',
      anchorString: ANCHOR.billing_zip,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '100',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'billing_country',
      required: 'true',
      anchorString: ANCHOR.billing_country,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '140',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'event_contact_name',
      required: 'false',
      anchorString: ANCHOR.event_contact_name,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '220',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
    {
      tabLabel: 'event_contact_email',
      required: 'false',
      anchorString: ANCHOR.event_contact_email,
      anchorXOffset: '0',
      anchorYOffset: '0.01',
      anchorUnits: 'inches',
      documentId: '1',
      width: '260',
      height: '16',
      font: 'Arial',
      fontSize: 'Size11',
    },
  ];
  return { textTabs: tabs };
}
