// ---------------------------------------------------------------------------
// Business (KYB) product catalog + flow helpers
//
// Mirrors the server's business-products catalog (kyc-core
// src/lib/business-products.ts) for display purposes only — labels and input
// hints. The server remains the source of truth: an unknown/unoffered product
// is rejected at POST /verify with `product_unsupported`.
// ---------------------------------------------------------------------------

import type { SubjectType, WorkflowBusinessConfig } from '../types/business';

export interface BusinessProductDef {
  key: string;
  label: string;
  /** What the user types — drives the input label/placeholder. */
  inputLabel: string;
  placeholder: string;
  /** Countries offering this product; absent = every supported country. */
  countries?: string[];
}

export const DEFAULT_BUSINESS_PRODUCT = 'business';

export const BUSINESS_PRODUCTS: readonly BusinessProductDef[] = [
  {
    key: 'business',
    label: 'Business verification',
    inputLabel: 'Registration number',
    placeholder: 'e.g. RC0000000',
  },
  {
    key: 'business-tax',
    label: 'Business + Tax ID',
    inputLabel: 'Registration number',
    placeholder: 'e.g. RC0000000',
    countries: ['NG'],
  },
  {
    key: 'business-taxid',
    label: 'Tax ID',
    inputLabel: 'Registration number',
    placeholder: 'e.g. RC0000000',
    countries: ['NG'],
  },
  {
    key: 'business-tin',
    label: 'TIN',
    inputLabel: 'TIN',
    placeholder: 'e.g. 01234567-0001',
    countries: ['NG'],
  },
];

/** Display definition for a product key (unknown keys get a generic fallback). */
export function getBusinessProductDef(key: string): BusinessProductDef {
  return (
    BUSINESS_PRODUCTS.find((p) => p.key === key) ?? {
      key,
      label: key,
      inputLabel: 'Registration number',
      placeholder: 'Enter your registration number',
    }
  );
}

/** The product keys a business workflow offers (default product when unset). */
export function businessProductsFor(business: WorkflowBusinessConfig | undefined): string[] {
  const products = business?.products;
  return products && products.length > 0 ? products : [DEFAULT_BUSINESS_PRODUCT];
}

/**
 * The products offered for one picked country — the configured list narrowed
 * by each product's country availability, with the global default product as
 * the backstop (mirrors the server's businessProductsForCountry).
 */
export function businessProductsForCountry(
  business: WorkflowBusinessConfig | undefined,
  country: string,
): string[] {
  const offered = businessProductsFor(business).filter((key) => {
    const def = BUSINESS_PRODUCTS.find((p) => p.key === key);
    return !def?.countries || def.countries.includes(country);
  });
  return offered.length > 0 ? offered : [DEFAULT_BUSINESS_PRODUCT];
}

/** Registry countries the visitor may pick (primary always included, first). */
export function businessCountriesFor(business: WorkflowBusinessConfig | undefined): string[] {
  if (!business) return [];
  if (business.countries && business.countries.length > 0) {
    return business.countries.includes(business.country)
      ? business.countries
      : [business.country, ...business.countries];
  }
  return [business.country];
}

/** English country name for an ISO-2 code (falls back to the code itself). */
export function businessCountryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

// Continent per supported registry country — display grouping only (the server
// owns the real catalogue; unknown codes land in "Other"). Africa first.
const REGIONS: Array<{ label: string; codes: string[] }> = [
  { label: 'Africa', codes: ['CI', 'KE', 'MA', 'NG', 'TN', 'TZ', 'YT', 'ZA'] },
  { label: 'Europe', codes: ['BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'FI', 'FR', 'GB', 'GG', 'GR', 'IE', 'LV', 'MD', 'MT', 'NL', 'NO', 'PL', 'RO', 'SI', 'SK', 'UA'] },
  { label: 'Asia', codes: ['AE', 'IL', 'IN', 'JP', 'KZ', 'NP', 'SA', 'TR', 'UZ'] },
  { label: 'North America', codes: ['CA', 'PR', 'US'] },
  { label: 'South America', codes: ['AR'] },
  { label: 'Oceania', codes: ['AU', 'NZ'] },
];

export interface BusinessCountryGroup {
  label: string;
  countries: Array<{ code: string; name: string }>;
}

/** Group offered registry countries by continent, names A→Z within a group. */
export function groupBusinessCountries(codes: string[]): BusinessCountryGroup[] {
  const entries = codes.map((code) => ({ code: code.toUpperCase(), name: businessCountryName(code) }));
  const groups: BusinessCountryGroup[] = [];
  const placed = new Set<string>();
  for (const region of REGIONS) {
    const countries = entries
      .filter((e) => region.codes.includes(e.code))
      .sort((a, b) => a.name.localeCompare(b.name));
    countries.forEach((c) => placed.add(c.code));
    if (countries.length > 0) groups.push({ label: region.label, countries });
  }
  const other = entries.filter((e) => !placed.has(e.code)).sort((a, b) => a.name.localeCompare(b.name));
  if (other.length > 0) groups.push({ label: 'Other', countries: other });
  return groups;
}

/**
 * Whether the resolved config runs the business (KYB) flow: consent →
 * business-details → (questionnaire) → submitted. Single source of truth for
 * the gate — the step order, consent routing, and submission all read this.
 */
export function isBusinessFlow(config: {
  subjectType?: SubjectType;
  business?: WorkflowBusinessConfig;
}): boolean {
  return config.subjectType === 'business' && !!config.business;
}
