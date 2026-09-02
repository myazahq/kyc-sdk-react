'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { KYCAction, KYCState } from '../../context/types';
import type { KYCConfigValue } from '../../context/KYCConfigContext';
import { pickedAddressState } from '../address-helpers';
import { KEEP_PICKED_LABEL_RADIUS_M, metersBetween } from './flow-steps';
import { currentFix, locating, prefetchCurrentFix, type CurrentFix } from './current-location';

// The pin's mechanics — labelling, the shared current-location fix, and every
// way the pin can move — extracted from use-address-flow.ts (200-line rule).
// One rule runs through all of it: a HUMAN-CONFIRMED label is never silently
// discarded; the applicant decides its fate.

const REVERSE_DEBOUNCE_MS = 700;

interface PinActionDeps {
  config: KYCConfigValue;
  state: KYCState;
  dispatch: Dispatch<KYCAction>;
  setError: (message: string | null) => void;
}

export function usePinActions({ config, state, dispatch, setError }: PinActionDeps) {
  // ── Reverse geocoding: the pin's human-readable line ──────────────────────
  // A moved pin invalidates a DERIVED label; the fresh one arrives debounced
  // and is dropped if the pin moved again meanwhile. Display only.
  const addressRef = useRef(state.address);
  addressRef.current = state.address;
  const stepRef = useRef(state.currentStep);
  stepRef.current = state.currentStep;
  const stateRef = useRef(state);
  stateRef.current = state;
  const stepStillInAddressFlow = () => String(stepRef.current).startsWith('address-');
  const reverseTimer = useRef<number | null>(null);
  const labelPin = (lat: number, lng: number, delay = REVERSE_DEBOUNCE_MS) => {
    if (reverseTimer.current) window.clearTimeout(reverseTimer.current);
    reverseTimer.current = window.setTimeout(() => {
      config.api
        .addressReverse(lat, lng)
        .then((r) => {
          const current = addressRef.current;
          if (!r.line || !current || current.lat !== lat || current.lng !== lng) return;
          dispatch({
            type: 'SET_ADDRESS',
            payload: {
              ...current,
              label: r.line,
              ...(r.parts ? { parts: r.parts } : {}),
              // A resolved street retires the typed one (its input hides) —
              // back to UNDEFINED, never '': the details sheet reads '' as
              // deliberately cleared, which suppressed the resolved-street
              // prefill it should be showing.
              ...(r.parts?.street ? { street: undefined } : {}),
            },
          });
          // The pin's own country outranks a locale/IP GUESS: on a local dev
          // box the geo default falls back to the browser locale (en-US ->
          // US) while the pin sits in Nigeria, and the declaration drives the
          // search filter, the PoA market and the submission's country. An
          // explicit pick is never overridden, and the org's accepted list
          // still gates it like the geo default.
          const pinCountry = r.parts?.country?.toUpperCase();
          if (
            pinCountry &&
            stateRef.current.countryAutoPicked &&
            pinCountry !== stateRef.current.selectedCountry &&
            (!config.proofOfAddress?.countries?.length ||
              config.proofOfAddress.countries.some((c) => c.toUpperCase() === pinCountry))
          ) {
            dispatch({ type: 'SET_COUNTRY_AUTO', payload: pinCountry as never });
          }
        })
        .catch(() => undefined);
    }, delay);
  };
  useEffect(() => () => {
    if (reverseTimer.current) window.clearTimeout(reverseTimer.current);
  }, []);

  // ── The shared current-location fix ───────────────────────────────────────
  // Started once (per page session) as soon as any address step mounts, so the
  // GPS warms up while the person is still reading.
  const [fix, setFix] = useState<CurrentFix | null>(currentFix());
  const [fixPending, setFixPending] = useState(locating());
  const startPrefetch = () => {
    setFixPending(true);
    void prefetchCurrentFix(config.api, config.previewMode).then((f) => {
      setFix(f);
      setFixPending(false);
    });
  };

  /** Land the pin on the current fix — instant when the prefetch already
   *  resolved; otherwise awaits it (starting it if needed). */
  const applyCurrentFix = async (onDone?: () => void, opts?: { silent?: boolean }) => {
    setError(null);
    setFixPending(true);
    const f = await prefetchCurrentFix(config.api, config.previewMode, {
      // A TAP is allowed to retry a previously failed attempt; the silent
      // auto path never re-prompts.
      retry: !opts?.silent,
    });
    setFix(f);
    setFixPending(false);
    // The fix can take up to eight seconds, and "Skip for now" is a decision
    // the applicant may make inside that window. A late fix writing an
    // address they declined to give (and an onDone navigating them back onto
    // a step they just left) undoes that decision — a continuation whose
    // step has left the address flow drops everything on the floor.
    if (!stepStillInAddressFlow()) return;
    // The AUTO apply resolves seconds after it started, and the person may
    // have picked a searched address meanwhile — a late GPS fix must never
    // overwrite a choice they made. An explicit tap still overrides.
    if (opts?.silent && addressRef.current) {
      onDone?.();
      return;
    }
    if (f) {
      dispatch({
        type: 'SET_ADDRESS',
        payload: {
          ...pickedAddressState(addressRef.current, { lat: f.lat, lng: f.lng, houseNumber: null }),
          accuracy: f.accuracy,
          ...(addressRef.current?.streetView ? { streetView: addressRef.current.streetView } : {}),
          ...(f.label ? { label: f.label } : {}),
          ...(f.parts ? { parts: f.parts } : {}),
        },
      });
    } else if (!opts?.silent) {
      setError('We could not read your location. Drag the map to place the pin instead.');
    }
    onDone?.();
  };

  // A map settle within ~a metre of the current pin is the tile roundtrip
  // drifting, not a move: acting on it rebuilt the address WITHOUT its label,
  // and the reverse geocoder then overwrote a searched-and-picked address
  // with the area line. Ignore it entirely.
  const PIN_EPSILON = 1e-5;
  const setPin = (next: { lat: number; lng: number }, accuracy: number | null = null) => {
    const cur = addressRef.current;
    if (cur && Math.abs(cur.lat - next.lat) < PIN_EPSILON && Math.abs(cur.lng - next.lng) < PIN_EPSILON) {
      return;
    }
    // A PICKED label names the property; the pin refines where its roof is.
    // The label is NEVER silently discarded on a move — the applicant decides
    // via the pin screen's keep/update prompt (shouldAskLabelDecision).
    // Crossing the credibility radius only resets a prior "keep", so the
    // question is asked again exactly once out there.
    if (cur?.pickedAt && cur.label) {
      const beyond = metersBetween(cur.pickedAt, next) > KEEP_PICKED_LABEL_RADIUS_M;
      dispatch({
        type: 'SET_ADDRESS',
        payload: {
          ...cur,
          lat: next.lat,
          lng: next.lng,
          accuracy,
          ...(beyond && cur.labelKept ? { labelKept: false } : {}),
        },
      });
      return;
    }
    dispatch({
      type: 'SET_ADDRESS',
      // Typed fields AND a captured Street View frame survive a re-pin; the
      // coordinates always win. A DERIVED label dies with the old spot.
      payload: {
        ...pickedAddressState(state.address, { lat: next.lat, lng: next.lng, houseNumber: null }),
        accuracy,
        ...(state.address?.streetView ? { streetView: state.address.streetView } : {}),
      },
    });
    labelPin(next.lat, next.lng);
  };

  /** The applicant keeps the picked label despite the moved pin. */
  const keepPickedLabel = () => {
    const cur = addressRef.current;
    if (cur) dispatch({ type: 'SET_ADDRESS', payload: { ...cur, labelKept: true } });
  };

  /** The applicant adopts the PIN's address: drop the pick, re-derive. */
  const adoptPinAddress = () => {
    const cur = addressRef.current;
    if (!cur) return;
    const { label: _l, parts: _p, pickedAt: _a, labelKept: _k, ...rest } = cur;
    dispatch({ type: 'SET_ADDRESS', payload: rest });
    labelPin(cur.lat, cur.lng, 0);
  };

  /** Reverse-geocode the CURRENT pin's line (restored sessions without one). */
  const relabelPin = () => {
    const cur = addressRef.current;
    if (cur && !cur.label) labelPin(cur.lat, cur.lng, 0);
  };

  /** The on-map locate button: moves the PIN to the current fix through
   *  setPin, so a picked address is protected by the same keep/update prompt
   *  as any other pin move — a mistaken tap destroys nothing. Contrast
   *  applyCurrentFix, the bootstrap override for when no address exists yet. */
  const locateToPin = async () => {
    setError(null);
    setFixPending(true);
    const f = await prefetchCurrentFix(config.api, config.previewMode, { retry: true });
    setFix(f);
    setFixPending(false);
    if (f) setPin({ lat: f.lat, lng: f.lng }, f.accuracy);
    else setError('We could not read your location. Drag the map to place the pin instead.');
  };

  return {
    currentFix: fix,
    locating: fixPending,
    startPrefetch,
    applyCurrentFix,
    setPin,
    keepPickedLabel,
    adoptPinAddress,
    relabelPin,
    locateToPin,
  };
}
