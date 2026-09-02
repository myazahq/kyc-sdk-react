'use client';

import { useEffect, useRef } from 'react';
import { useKYCContext } from '../context/KYCContext';
import { useSessionProgress } from '../hooks/useSessionProgress';
import type { HandoffBootstrapResponse, KYCApi } from '../services/api';
import type { KYCStep } from '../types/config';

/**
 * Binds a hosted flow to its session: names it, then saves progress as the
 * applicant moves.
 *
 * BOTH halves were missing. The reducer never learned the id (a hosted mount
 * holds only the token), and useSessionProgress was mounted solely in
 * <MyazaKYC/>, so hosted links — the one place someone is most likely to close
 * the tab and come back — persisted nothing at all.
 */
export function HostedSessionSync({
  sessionId,
  progress,
  api,
}: {
  sessionId: string;
  progress?: HandoffBootstrapResponse['progress'];
  api: KYCApi;
}) {
  const { state, dispatch } = useKYCContext();
  const restored = useRef(false);

  useEffect(() => {
    if (sessionId) dispatch({ type: 'SET_SESSION_ID', payload: sessionId });
    // Put them back where they were. Once only: re-applying after they have
    // moved on would drag them backwards. Media references are pruned
    // server-side, so a restored capture slot is one whose bytes still exist.
    if (progress && !restored.current) {
      restored.current = true;
      dispatch({ type: 'RESTORE_PROGRESS', payload: progress });
    }
  }, [sessionId, progress, dispatch]);

  useSessionProgress(api, state);
  return null;
}

/**
 * The hosted flow's lifecycle callbacks — what `<MyazaKYC/>` fires from its
 * own component, mounted here instead because a hosted page has no trigger
 * component to fire them from. `onStart` once, when the flow mounts; `onStep`
 * for the step the flow opens on (a restored session opens mid-flow, and a
 * host that only ever hears CHANGES would never learn where it started) and
 * then for every change.
 */
export function HostedLifecycle({
  onStart,
  onStepChange,
}: {
  onStart?: () => void;
  onStepChange?: (step: KYCStep) => void;
}) {
  const { state } = useKYCContext();
  const started = useRef(false);
  const lastStep = useRef<KYCStep | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    onStart?.();
  }, [onStart]);

  useEffect(() => {
    if (state.currentStep === lastStep.current) return;
    lastStep.current = state.currentStep;
    onStepChange?.(state.currentStep);
  }, [state.currentStep, onStepChange]);

  return null;
}
