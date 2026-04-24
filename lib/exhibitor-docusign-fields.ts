export type ExhibitorFieldMergeMode = 'draft' | 'docusign';

/**
 * Google Doc merge tokens for exhibitor-captured fields. In `docusign` mode each resolves to a
 * unique anchor string (same as DocuSign text tab `anchorString`).
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
      anchorYOffset: '-0.06',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'exhibitor_address_line2',
      required: 'false',
      anchorString: ANCHOR.exhibitor_address_line2,
      anchorXOffset: '0',
      anchorYOffset: '-0.06',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'exhibitor_city',
      required: 'true',
      anchorString: ANCHOR.exhibitor_city,
      anchorXOffset: '0',
      anchorYOffset: '-0.06',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'exhibitor_state',
      required: 'true',
      anchorString: ANCHOR.exhibitor_state,
      anchorXOffset: '0.12',
      anchorYOffset: '-0.06',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'exhibitor_zip',
      required: 'true',
      anchorString: ANCHOR.exhibitor_zip,
      anchorXOffset: '0.12',
      anchorYOffset: '-0.06',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'exhibitor_country',
      required: 'true',
      anchorString: ANCHOR.exhibitor_country,
      anchorXOffset: '0',
      anchorYOffset: '-0.06',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'exhibitor_telephone',
      required: 'true',
      anchorString: ANCHOR.exhibitor_telephone,
      anchorXOffset: '0.12',
      anchorYOffset: '-0.06',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'billing_contact_name',
      required: 'true',
      anchorString: ANCHOR.billing_contact_name,
      anchorXOffset: '0.15',
      anchorYOffset: '-0.08',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'billing_contact_email',
      required: 'true',
      validationPattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
      anchorString: ANCHOR.billing_contact_email,
      anchorXOffset: '0.15',
      anchorYOffset: '-0.08',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'billing_address_line1',
      required: 'true',
      anchorString: ANCHOR.billing_address_line1,
      anchorXOffset: '0',
      anchorYOffset: '-0.06',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'billing_address_line2',
      required: 'false',
      anchorString: ANCHOR.billing_address_line2,
      anchorXOffset: '0',
      anchorYOffset: '-0.06',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'billing_city',
      required: 'true',
      anchorString: ANCHOR.billing_city,
      anchorXOffset: '0',
      anchorYOffset: '-0.06',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'billing_state',
      required: 'true',
      anchorString: ANCHOR.billing_state,
      anchorXOffset: '0.12',
      anchorYOffset: '-0.06',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'billing_zip',
      required: 'true',
      anchorString: ANCHOR.billing_zip,
      anchorXOffset: '0.12',
      anchorYOffset: '-0.06',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'billing_country',
      required: 'true',
      anchorString: ANCHOR.billing_country,
      anchorXOffset: '0',
      anchorYOffset: '-0.06',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'event_contact_name',
      required: 'false',
      anchorString: ANCHOR.event_contact_name,
      anchorXOffset: '0.15',
      anchorYOffset: '-0.08',
      anchorUnits: 'inches',
      documentId: '1',
    },
    {
      tabLabel: 'event_contact_email',
      required: 'false',
      anchorString: ANCHOR.event_contact_email,
      anchorXOffset: '0.15',
      anchorYOffset: '-0.08',
      anchorUnits: 'inches',
      documentId: '1',
    },
  ];
  return { textTabs: tabs };
}
