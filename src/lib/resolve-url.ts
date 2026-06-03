import type { SdkEnvironment } from '../types/config';

/** Hardcoded base URLs for the non-development environments. */
const BASE_URLS = {
  staging: 'https://identity.myaza.app',
  production: 'https://identity.myaza.app',
} as const;

/** Default base URL used in development when no `devUrl` is provided. */
const DEFAULT_DEV_URL = 'http://localhost:3000';

/**
 * Resolves the API base URL for the given environment.
 * - `development` → `devUrl` if provided, otherwise `http://localhost:3000`.
 * - `staging` / `production` → the hardcoded URL (`devUrl` is ignored).
 */
export function resolveBaseUrl(environment: SdkEnvironment, devUrl?: string): string {
  if (environment === 'development') {
    return devUrl ?? DEFAULT_DEV_URL;
  }
  return BASE_URLS[environment];
}
