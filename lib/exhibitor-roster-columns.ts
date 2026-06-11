export type RosterColumnMode = 'essential' | 'extended' | 'all';

export type RosterColumnDef = {
  id: string;
  label: string;
  /** Shown in essential (default) view */
  essential?: boolean;
  /** Shown in extended view */
  extended?: boolean;
  /** Sheet field label used in "all" view — must match header text from Google Sheet */
  sheetLabel?: string;
  /** Only show list column when viewing all exhibitor lists together */
  onlyAllLists?: boolean;
  minWidth?: string;
};

/** Canonical sheet headers shared across NYWE exhibitor forms (for "all columns" mode). */
export const ROSTER_SHEET_FIELD_ORDER: string[] = [
  'Timestamp',
  'Email Address',
  'NAME OF PARTICIPATING WINERY',
  'PLEASE CONFIRM YOUR PARTICIPATION:',
  'NAME OF WINERY OWNER(S)*',
  'NAME OF WINEMAKER(S) *',
  'STREET ADDRESS OF WINERY *',
  'WINERY WEBSITE URL *',
  'YEAR WINERY WAS ESTABLISHED',
  'PRIMARY CONTACT FIRST NAME',
  'PRIMARY CONTACT LAST NAME',
  'PRIMARY CONTACT EMAIL',
  'PRIMARY CONTACT PHONE (must be a US cell#)',
  'SECONDARY CONTACT EMAIL (Who should we CC?)',
  'WINE NAME ',
  'VINTAGE ',
  'IMPORTER CONTACT NAME ',
  'IMPORTER CONTACT PHONE NUMBER',
  'IMPORTER EMAIL ADDRESS',
  'BILLING CONTACT FIRST NAME',
  'BILLING CONTACT LAST NAME',
  'BILLING CONTACT EMAIL',
  'BILLING COMPANY NAME',
  'BILLING STREET ADDRESS/ P.O BOX #',
  'CITY',
  'STATE',
  'COUNTRY (IF APPLICABLE)',
  'ZIP CODE/POSTAL CODE',
  'CONTRACT REPRESENTATIVE FIRST NAME',
  'CONTRACT REPRESENTATIVE LAST NAME',
  'CONTRACT REPRESENTATIVE COMPANY NAME',
  'CONTRACT REPRESENTATIVE EMAIL ADDRESS',
  'LICENSE STATUS',
  'CONTRACT ID',
  'LAST UPDATED',
];

export const ROSTER_UI_COLUMNS: RosterColumnDef[] = [
  { id: 'winery', label: 'Winery', essential: true, extended: true, minWidth: '12rem' },
  { id: 'list', label: 'List', essential: true, extended: true, onlyAllLists: true, minWidth: '9rem' },
  { id: 'wine', label: 'Wine / Vintage', essential: true, extended: true, minWidth: '11rem' },
  { id: 'signer', label: 'Contract signer', essential: true, extended: true, minWidth: '11rem' },
  { id: 'licenseStatus', label: 'License status', essential: true, extended: true, minWidth: '8rem' },
  { id: 'billingCompany', label: 'Billing company', extended: true, sheetLabel: 'BILLING COMPANY NAME', minWidth: '10rem' },
  { id: 'billingContact', label: 'Billing contact', extended: true, minWidth: '10rem' },
  { id: 'primaryContact', label: 'Primary contact', extended: true, minWidth: '10rem' },
  { id: 'billingLocation', label: 'Billing city / state', extended: true, minWidth: '9rem' },
  { id: 'importer', label: 'Importer', extended: true, minWidth: '9rem' },
  { id: 'sheetStatus', label: 'Sheet status', extended: true, sheetLabel: 'LICENSE STATUS', minWidth: '8rem' },
  { id: 'sheetUpdated', label: 'Sheet updated', extended: true, sheetLabel: 'LAST UPDATED', minWidth: '8rem' },
];

export function visibleUiColumns(mode: RosterColumnMode, showListColumn: boolean): RosterColumnDef[] {
  return ROSTER_UI_COLUMNS.filter((col) => {
    if (col.onlyAllLists && !showListColumn) return false;
    if (mode === 'essential') return col.essential;
    if (mode === 'extended') return col.essential || col.extended;
    return false;
  });
}

export function visibleSheetColumns(mode: RosterColumnMode): string[] {
  if (mode !== 'all') return [];
  return ROSTER_SHEET_FIELD_ORDER;
}

export function rosterColumnModeLabel(mode: RosterColumnMode): string {
  switch (mode) {
    case 'essential':
      return 'Essential';
    case 'extended':
      return 'More columns';
    case 'all':
      return 'All sheet fields';
  }
}
