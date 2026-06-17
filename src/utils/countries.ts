import type { IdTypesByCountry } from '../types/config';

export const ID_TYPES: IdTypesByCountry = {
  NG: [
    { key: 'bvn',             label: 'BVN',                                 digits: 11,                    requiresDocumentCapture: false },
    { key: 'bvn-premium',     label: 'BVN Premium',                         digits: 11,                    requiresDocumentCapture: false },
    { key: 'tax-id',          label: 'Tax ID', inputLabel: 'NIN',           digits: 11,                    requiresDocumentCapture: false },
    { key: 'nin',             label: 'NIN',                                 digits: 11,                    requiresDocumentCapture: false },
    { key: 'vnin',            label: 'Virtual NIN (vNIN)',                  digits: 16,                    requiresDocumentCapture: false },
    { key: 'passport',        label: 'International Passport',              pattern: /^[A-Z]\d{8}$/,       requiresDocumentCapture: true, scanSides: 'front_only'      },
    { key: 'drivers-license', label: "Driver's License",                    pattern: /^[A-Z]{3}\d{5,12}$/, requiresDocumentCapture: true, scanSides: 'front_and_back'  },
    { key: 'pvc',             label: "Permanent Voter's Card",              pattern: /^\d{19}$/,            requiresDocumentCapture: true, scanSides: 'front_and_back'  },
  ],
  GH: [
    { key: 'ghana-card',      label: 'Ghana Card',                          pattern: /^GHA-\d{9}-\d$/,     requiresDocumentCapture: true, scanSides: 'front_and_back'  },
    { key: 'voters',          label: "Voter's Card",                        digits: 10,                    requiresDocumentCapture: true, scanSides: 'front_and_back'  },
    { key: 'drivers-license', label: "Driver's License",                                                   requiresDocumentCapture: true, scanSides: 'front_and_back'  },
    { key: 'ssnit',           label: 'SSNIT',                               digits: 13,                    requiresDocumentCapture: true, scanSides: 'front_only'      },
    { key: 'passport',        label: 'Passport',                            pattern: /^[A-Z]\d{7}$/,       requiresDocumentCapture: true, scanSides: 'front_only'      },
  ],
  KE: [
    { key: 'national-id',     label: 'National ID',                         digits: 8,                     requiresDocumentCapture: true, scanSides: 'front_and_back'  },
    { key: 'passport',        label: 'Passport',                                                           requiresDocumentCapture: true, scanSides: 'front_only'      },
  ],
  ZA: [
    { key: 'national-id',     label: 'National ID',                         digits: 13,                    requiresDocumentCapture: true, scanSides: 'front_and_back'  },
  ],
  CI: [
    { key: 'cni',             label: "CNI (Carte Nationale d'Identité)",                                   requiresDocumentCapture: true, scanSides: 'front_and_back'  },
    { key: 'residence-card',  label: 'Residence Card',                                                     requiresDocumentCapture: true, scanSides: 'front_and_back'  },
  ],
} as const;

/**
 * Returns true for IDs that should skip document capture and go straight to
 * the id-input form (user types their number manually).
 * Nigeria: BVN, NIN, vNIN.
 */
export function isNumberOnlyIdType(idType: string): boolean {
  const def = Object.values(ID_TYPES).flat().find((t) => t.key === idType);
  return def ? !def.requiresDocumentCapture : false;
}

/**
 * Returns true when the selected ID type requires a physical document scan.
 */
export function requiresDocumentCapture(idType: string): boolean {
  const def = Object.values(ID_TYPES).flat().find((t) => t.key === idType);
  return def ? def.requiresDocumentCapture : true;
}

/**
 * Returns the scan-sides configuration for a document ID type.
 * Defaults to 'front_only' when not explicitly set.
 */
export function getScanSides(idType: string): 'front_only' | 'front_and_back' {
  const def = Object.values(ID_TYPES).flat().find((t) => t.key === idType);
  return (def as { scanSides?: 'front_only' | 'front_and_back' })?.scanSides ?? 'front_only';
}

export const COUNTRY_LABELS: Record<string, string> = {
  NG: 'Nigeria',
  GH: 'Ghana',
  KE: 'Kenya',
  ZA: 'South Africa',
  CI: "Côte d'Ivoire",
};
