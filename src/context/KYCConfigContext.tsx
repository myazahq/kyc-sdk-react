'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SupportedCountry, IdType, KYCAppearance, KYCConsentContent, KYCSuccessContent } from '../types/config';
import type { KYCSubmission } from '../types/verification';
import { createKYCApi, KYCApiError, type KYCApi, type SdkConfigIdType, type SdkConfigResponse, type SdkConfigBranding } from '../services/api';
import { resolveBaseUrl } from '../lib/resolve-url';
import { KYCError, type KYCErrorCode } from '../types/verification';
import { safeReportError } from '../lib/errors';

// ---------------------------------------------------------------------------
// Config value — the subset of MyazaKYCConfig that steps need at runtime
// ---------------------------------------------------------------------------

export interface ServerSdkConfig {
  status: 'loading' | 'ready' | 'error';
  /** All `(country, idType)` rows the org has access to (granted + enabled). */
  idTypes: SdkConfigIdType[];
  /** Server environment — derived from the API key, reported by `/config`. */
  environment?: 'DEVELOPMENT' | 'SANDBOX' | 'PRODUCTION';
  /** Org branding (logo, name, color) returned by the config endpoint. */
  branding?: SdkConfigBranding;
  /** Loader error message, if `status === 'error'`. */
  error?: string;
  /** HTTP status of the failed config request, if `status === 'error'`. */
  statusCode?: number;
  /**
   * True when the failure is a hard, non-recoverable auth error (invalid API
   * key / forbidden) — the flow can't proceed, so the modal shows a blocking
   * error screen instead of silently falling back to the prop ID-type list.
   */
  fatal?: boolean;
}

export interface KYCConfigValue {
  /** Dev-only base-URL override; only applied for development (`pk_dev_`) keys. */
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
  /** Allow picking a document photo from the device instead of the camera. Default true. */
  allowDocumentUpload?: boolean;
  enableLiveness?: boolean;
  /**
   * Show the "continue on another device" handoff option.
   * Desktop: shown as a pre-flow gate. Mobile: shown as a subtle link on the consent step.
   * Default true.
   */
  deviceHandoff?: boolean;
  /**
   * Base path (or absolute URL) where gesture GIFs are served from.
   * Defaults to `'/kyc-assets'`. Copy `node_modules/@myazahq/kyc-sdk-react/gifs/`
   * to that path, or set an absolute CDN URL to serve them remotely.
   */
  assetsBasePath?: string;
  /** Branding: company name, logo, primary color, theme. */
  appearance?: KYCAppearance;
  /** Consent (welcome) screen copy overrides. */
  consent?: KYCConsentContent;
  /** Success (submitted) screen copy overrides. */
  success?: KYCSuccessContent;
  onSubmit?: (submission: KYCSubmission) => void;
  onClose?: () => void;
  /** Fires for technical errors — including a fatal config-load auth failure. Receives a typed {@link KYCError}. */
  onError?: (error: KYCError) => void;
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

// Map a config-load failure to a user-facing message. Auth failures (401/403)
// are "fatal": the API key is wrong or not permitted, so the flow can't run and
// the modal should block on a clear error rather than silently degrade. Other
// failures (network blips, 5xx) are non-fatal — the flow falls back to the prop
// ID-type list and any real problem resurfaces at the verify step.
function describeConfigError(err: unknown): { message: string; statusCode?: number; fatal: boolean; code: KYCErrorCode } {
  if (err instanceof KYCApiError) {
    if (err.statusCode === 401) {
      return {
        message: 'Invalid API key. Please check the API key configured in the SDK.',
        statusCode: 401,
        fatal: true,
        code: 'invalid_api_key',
      };
    }
    if (err.statusCode === 403) {
      return {
        message: err.message || 'This API key is not permitted to use the verification SDK.',
        statusCode: 403,
        fatal: true,
        code: 'feature_disabled',
      };
    }
    if (err.statusCode >= 500) {
      return {
        message: 'A server error occurred while loading verification settings. Please try again.',
        statusCode: err.statusCode,
        fatal: false,
        code: 'unknown',
      };
    }
    return { message: err.message, statusCode: err.statusCode, fatal: false, code: 'unknown' };
  }
  // fetch() throws a TypeError on network failure (DNS, offline, CORS).
  if (err instanceof TypeError) {
    return { message: 'Network error. Please check your connection and try again.', fatal: false, code: 'network_error' };
  }
  return { message: err instanceof Error ? err.message : 'Failed to load SDK config', fatal: false, code: 'unknown' };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

type KYCConfigProviderProps = Omit<KYCConfigValue, 'serverConfig' | 'getIdTypeFeatures' | 'api'> & {
  children: ReactNode;
  /**
   * Pre-built API client. Used by the hosted (continue-on-phone) entry, which
   * authenticates with a session token through a relative base URL — bypassing
   * `resolveBaseUrl` (which throws on a non-key token). When omitted the client
   * is built from the API key prefix as usual.
   */
  apiOverride?: KYCApi;
  /**
   * Pre-resolved server config. Used by the hosted entry, which already has the
   * org's idType allowlist + branding from the session bootstrap, so it should
   * NOT fetch `/config` (not in the session-token scope).
   */
  serverConfigOverride?: ServerSdkConfig;
};

export function KYCConfigProvider({ children, apiOverride, serverConfigOverride, ...config }: KYCConfigProviderProps) {
  const [serverConfig, setServerConfig] = useState<ServerSdkConfig>(
    serverConfigOverride ?? { status: 'loading', idTypes: [] },
  );

  // Resolve the base URL from the API key prefix (+ devUrl for dev keys) and
  // build a single memoized API client. Rebuilt only when the key or devUrl
  // changes. An invalid key prefix throws here (fail-loud at integration time).
  // `apiOverride` short-circuits this (hosted mode) — `resolveBaseUrl` is never
  // called, so a session token doesn't trip its key-prefix validation.
  const api = useMemo(
    () => apiOverride ?? createKYCApi(resolveBaseUrl(config.apiKey, config.devUrl), config.apiKey),
    [apiOverride, config.apiKey, config.devUrl],
  );

  // Guards onError so a fatal config failure is reported to the consumer at
  // most once per API client (StrictMode mounts the effect twice in dev).
  const reportedErrorRef = useRef<KYCApi | null>(null);

  useEffect(() => {
    // Hosted mode already has the server config from the session bootstrap —
    // don't fetch /config (and don't overwrite the provided override).
    if (serverConfigOverride) return;
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
        const { message, statusCode, fatal, code } = describeConfigError(err);
        setServerConfig({ status: 'error', idTypes: [], error: message, statusCode, fatal });
        // Surface fatal auth failures (e.g. a wrong API key) to the consumer's
        // onError handler, once, so it isn't only visible inside the modal.
        if (fatal && reportedErrorRef.current !== api) {
          reportedErrorRef.current = api;
          safeReportError(config.onError, new KYCError(code, message));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps

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
      config.devUrl,
      config.apiKey,
      api,
      config.country,
      config.idTypes,
      config.metadata,
      config.userData,
      config.enableSelfie,
      config.enableDocumentCapture,
      config.allowDocumentUpload,
      config.enableLiveness,
      config.deviceHandoff,
      config.assetsBasePath,
      config.appearance,
      config.consent,
      config.success,
      config.onSubmit,
      config.onClose,
      config.onError,
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
