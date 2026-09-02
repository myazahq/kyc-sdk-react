'use client';

import { useEffect, useState } from 'react';
import { useKYCConfig } from '../../context/KYCConfigContext';
import { useKYCContext } from '../../context/KYCContext';
import { configScope } from '../../lib/scope';
import { isBusinessFlow } from '../../lib/business';
import { inferredCountry } from '../../lib/inferred-country';
import { defaultMapView } from '../../lib/map-tiles';
import { addressBackStep, addressNextStep } from '../../lib/address-step-nav';
import { deviceFixFields, uploadAddressPhoto } from '../address-helpers';
import { addressFlowOptions, addressFlowSteps, nextAddressStep, prevAddressStep } from './flow-steps';
import { usePinActions } from './use-pin-actions';
import type { KYCStep } from '../../types/config';

// The address flow's shared brain: every address step mounts this hook and
// gets the same derived flags, the same step list, and the same actions —
// which is what keeps four separate step components telling one story.

const REVERSE_DEBOUNCE_MS = 700;

export function useAddressFlow() {
  const { state, dispatch } = useKYCContext();
  const config = useKYCConfig();
  const address = config.addressCollection;
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusiness = isBusinessFlow(config);
  const pin = state.address ? { lat: state.address.lat, lng: state.address.lng } : null;
  const googleKey = config.serverConfig?.googleMapsBrowserKey ?? null;
  // KYB: the single premises step — its pin + directions ARE the capture, so
  // the flow options collapse to none of the optional steps.
  const flow = isBusiness
    ? { searchAvailable: false, photoMode: 'off' as const, streetViewOffered: false }
    : addressFlowOptions({
        photo: address?.photo,
        streetView: address?.streetView,
        serverSearch: Boolean(config.serverConfig?.addressSearch),
        previewMode: Boolean(config.previewMode),
        hasGoogleKey: Boolean(googleKey),
      });
  const { photoMode, streetViewOffered, searchAvailable } = flow;
  const steps = isBusiness ? (['address-collection'] as KYCStep[]) : addressFlowSteps(flow);

  const country = isBusiness
    ? (state.business.country ?? undefined)
    : (state.selectedCountry ?? config.country);
  const view = defaultMapView(country);

  // ADDRESS SCOPE: default the declared country to the visitor's inferred one
  // (IP-derived geoCountry, else the browser locale's region — guesses and
  // only ever defaults) so one link works worldwide: the search filters to and
  // the map opens on where they actually are, not the workflow's configured
  // market. Runs once (a set selectedCountry never re-defaults); the
  // AddressCountryControl on the PoA step is where the applicant corrects a
  // wrong guess. Preview mode stays deterministic on the configured country.
  const isAddressScope = configScope(config) === 'address';
  const geoCountry = inferredCountry(config.serverConfig?.geoCountry);
  // The org's accepted-country list (proofOfAddress.countries): a guess the
  // submission gate would refuse must never become the default.
  const acceptedList = config.proofOfAddress?.countries;
  const geoAccepted =
    !acceptedList?.length || (geoCountry != null && acceptedList.some((c) => c.toUpperCase() === geoCountry));
  useEffect(() => {
    if (!isAddressScope || config.previewMode || state.selectedCountry) return;
    if (geoCountry && geoAccepted && geoCountry !== config.country) {
      dispatch({ type: 'SET_COUNTRY_AUTO', payload: geoCountry });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddressScope, geoCountry, geoAccepted]);

  // Pin mechanics (labelling, current-location fix, every way the pin can
  // move) live in use-pin-actions.ts — split per the 200-line rule.
  const pinActions = usePinActions({ config, state, dispatch, setError });

  const pickPhoto = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const mediaId = await uploadAddressPhoto(config.api, file);
      dispatch({ type: 'SET_MEDIA_ID', payload: { mediaType: 'addressPhoto', mediaId } });
      dispatch({ type: 'SET_ADDRESS_PHOTO_PREVIEW', payload: URL.createObjectURL(file) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () =>
    dispatch({ type: 'SET_MEDIA_ID', payload: { mediaType: 'addressPhoto', mediaId: undefined } });

  /** Leave the address flow forwards (after review, or a skip). */
  const exitForward = () => {
    const next = addressNextStep(config);
    dispatch(next === 'submit' ? { type: 'SUBMIT_VERIFICATION' } : { type: 'SET_STEP', payload: next });
  };

  /** The step after `current` within the address flow, else the flow exit. */
  const goNext = (current: KYCStep) => {
    const next = nextAddressStep(steps, current);
    if (next) dispatch({ type: 'SET_STEP', payload: next });
    else exitForward();
  };

  /** The step before `current`, else back out of the address flow entirely. */
  const goBack = (current: KYCStep) => {
    const prev = prevAddressStep(steps, current);
    if (prev) {
      dispatch({ type: 'SET_STEP', payload: prev });
      return;
    }
    const requiresCapture = state.selectedIdType
      ? config.getIdTypeDefinition(state.selectedIdType)?.requiresDocumentCapture
      : undefined;
    dispatch({ type: 'SET_STEP', payload: addressBackStep(config, requiresCapture) });
  };

  /** Commit: the one-shot attest fix (best-effort), then leave the flow. */
  const confirm = async () => {
    if (!state.address) return;
    setConfirming(true);
    if (address?.attestPresence && !config.previewMode) {
      dispatch({ type: 'SET_ADDRESS', payload: { ...state.address, ...(await deviceFixFields()) } });
    }
    setConfirming(false);
    exitForward();
  };

  return {
    address,
    isBusiness,
    previewMode: Boolean(config.previewMode),
    ...pinActions,
    pin,
    view,
    country,
    photoMode,
    googleKey,
    streetViewOffered,
    steps,
    uploading,
    confirming,
    error,
    setError,
    pickPhoto,
    removePhoto,
    goNext,
    goBack,
    exitForward,
    confirm,
  };
}
