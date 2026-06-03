'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SupportedCountry, IdType, SdkEnvironment, KYCAppearance, KYCConsentContent } from '../types/config';
import type { KYCSubmission } from '../types/verification';
import { createKYCApi, type KYCApi, type SdkConfigIdType, type SdkConfigResponse, type SdkConfigBranding } from '../services/api';
import { resolveBaseUrl } from '../lib/resolve-url';

// ---------------------------------------------------------------------------
// Config value — the subset of MyazaKYCConfig that steps need at runtime
// ---------------------------------------------------------------------------

export interface ServerSdkConfig {
  status: 'loading' | 'ready' | 'error';
  /** All `(country, idType)` rows the org has access to (granted + enabled). */
  idTypes: SdkConfigIdType[];
  /** Server environment (STAGING/PRODUCTION) — derived from the API key. */
  environment?: 'STAGING' | 'PRODUCTION';
  /** Org branding (logo, name, color) returned by the config endpoint. */
  branding?: SdkConfigBranding;
  /** Loader error message, if `status === 'error'`. */
  error?: string;
}

export interface KYCConfigValue {
  /** Target backend; resolved to a base URL on mount. */
  environment: SdkEnvironment;
  /** Dev-only override; only used when environment is 'development'. */
  devUrl?: string;
  apiKey: string;
  /** Memoized API client, built from the resolved base URL + apiKey. */
  api: KYCApi;
  country: SupportedCountry;
  /** Subset of ID types to offer. Only types valid for `country` will appear. */
  idTypes?: IdType[];
  metadata?: Record<string, string>;
  /** Pre-populated user data from the consuming app */
  userData?: { firstName?: string; lastName?: string; dateOfBirth?: string };
  enableSelfie?: boolean;
  enableDocumentCapture?: boolean;
  enableLiveness?: boolean;
  /** Branding: company name, logo, primary color, theme. */
  appearance?: KYCAppearance;
  /** Consent (welcome) screen copy overrides. */
  consent?: KYCConsentContent;
  onSubmit?: (submission: KYCSubmission) => void;
  onClose?: () => void;
  /**
   * Server-driven config (fetched on mount): which IDs the org may use and
   * which SDK features are enabled per ID. Steps should consult this — it
   * overrides the props above.
   */
  serverConfig: ServerSdkConfig;
  /**
   * Helper: returns the per-ID feature flags from the server config, or null
   * when the ID isn't granted (or config hasn't loaded yet).
   */
  getIdTypeFeatures: (
    country: string,
    idType: string,
  ) => SdkConfigIdType['features'] | null;
}

const KYCConfigContext = createContext<KYCConfigValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

type KYCConfigProviderProps = Omit<KYCConfigValue, 'serverConfig' | 'getIdTypeFeatures' | 'api'> & {
  children: ReactNode;
};

export function KYCConfigProvider({ children, ...config }: KYCConfigProviderProps) {
  const [serverConfig, setServerConfig] = useState<ServerSdkConfig>({
    status: 'loading',
    idTypes: [],
  });

  // Resolve the base URL from the environment (+ devUrl) and build a single
  // memoized API client. Rebuilt only when the key or environment changes.
  const api = useMemo(
    () => createKYCApi(resolveBaseUrl(config.environment, config.devUrl), config.apiKey),
    [config.apiKey, config.environment, config.devUrl],
  );

  useEffect(() => {
    let cancelled = false;
    api
      .config()
      .then((res: SdkConfigResponse) => {
        if (cancelled) return;
        setServerConfig({
          status: 'ready',
          idTypes: res.idTypes,
          environment: res.environment,
          branding: res.branding,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load SDK config';
        setServerConfig({ status: 'error', idTypes: [], error: message });
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const idTypesByKey = useMemo(() => {
    const map = new Map<string, SdkConfigIdType>();
    for (const row of serverConfig.idTypes) {
      map.set(`${row.country}/${row.idType}`, row);
    }
    return map;
  }, [serverConfig.idTypes]);

  const value = useMemo<KYCConfigValue>(
    () => ({
      ...config,
      api,
      serverConfig,
      getIdTypeFeatures: (country, idType) =>
        idTypesByKey.get(`${country}/${idType}`)?.features ?? null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      config.environment,
      config.devUrl,
      config.apiKey,
      api,
      config.country,
      config.idTypes,
      config.metadata,
      config.userData,
      config.enableSelfie,
      config.enableDocumentCapture,
      config.enableLiveness,
      config.appearance,
      config.consent,
      config.onSubmit,
      config.onClose,
      serverConfig,
      idTypesByKey,
    ],
  );

  return <KYCConfigContext.Provider value={value}>{children}</KYCConfigContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKYCConfig(): KYCConfigValue {
  const ctx = useContext(KYCConfigContext);
  if (!ctx) {
    throw new Error('useKYCConfig must be used within a <KYCConfigProvider>');
  }
  return ctx;
}
