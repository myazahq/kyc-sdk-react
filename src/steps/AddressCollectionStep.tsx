'use client';

import React, { useEffect, useState } from 'react';
import { PencilLine } from 'lucide-react';
import { AddressMap } from '../components/AddressMap';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/ui/button';
import { useKYCContext } from '../context/KYCContext';
import { useAddressFlow } from './address/use-address-flow';
import { useAddressIntroGate } from './address/AddressIntroGate';
import { DetailsSheet } from './address/DetailsSheet';
import { CurrentLocationRow, LocateFab } from './address/CurrentLocationRow';
import { LabelDecisionRow } from './address/LabelDecisionRow';
import { displayAddressLine, shouldAskLabelDecision } from './address/flow-steps';
import { ADDRESS_FIELD_LABELS, missingRequiredAddressFields } from './address/address-field-modes';

/**
 * The PIN step of the address flow (wire name 'address-collection'): a big
 * map — near full screen on mobile, so there is room to actually find the
 * building — with the summary card and the details sheet over it. On KYB this
 * is the whole premises capture, so Continue commits (attest fix included);
 * on individual flows it advances to the entrance/review steps.
 */
// Once per page session: a dismissed or denied prompt must not re-fire every
// time the person passes through this step.
let autoLocateAttempted = false;

export function AddressCollectionStep() {
  const { state, dispatch } = useKYCContext();
  const flow = useAddressFlow();
  const [sheetOpen, setSheetOpen] = useState(false);
  const gate = useAddressIntroGate('address-collection', flow.steps[0]!);

  // Trigger Use-my-location AUTOMATICALLY the first time the pin step opens
  // with no pin (user decision 2026-08-29): most people are verifying from
  // home, so the map should land on them rather than a city-centre default.
  // The fix is usually already resolved (the search step warms it), so this
  // applies INSTANTLY — no default view flashing first, no jump. Silent by
  // contract; the button remains for retries and denials.
  const gateShowing = Boolean(gate);
  const noPin = !state.address;
  useEffect(() => {
    // The fix warms even under the welcome screen — only the APPLY waits for
    // the gate (a pin landing behind the primer would be invisible anyway).
    flow.startPrefetch();
    if (gateShowing || flow.previewMode) return;
    // A restored pin without its line (a session saved before labels existed):
    // reverse-geocode it once rather than showing raw coordinates.
    if (state.address && !state.address.label) {
      flow.relabelPin();
    }
    if (!noPin || autoLocateAttempted) return;
    autoLocateAttempted = true;
    void flow.applyCurrentFix(undefined, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateShowing, noPin]);

  if (gate) return gate;

  const { pin } = flow;
  const label = state.address?.label ?? null;
  const askLabel = state.address ? shouldAskLabelDecision(state.address) : false;
  const detailCount = [
    state.address?.propertyNumber,
    state.address?.street,
    state.address?.unit,
    state.address?.propertyName,
    state.address?.directions,
    state.address?.neighbourhood,
    state.address?.city,
    state.address?.state,
    state.address?.postcode,
  ].filter((v) => v?.trim()).length;
  const lastInFlow = flow.isBusiness;

  // Workflow-required details hold Continue until they are filled — and open
  // the sheet on the missing fields rather than pointing at a closed drawer.
  const missingRequired = missingRequiredAddressFields(flow.address, state.address ?? null);
  const [missingNudge, setMissingNudge] = useState(false);

  const handleContinue = () => {
    if (missingRequired.length > 0) {
      setMissingNudge(true);
      setSheetOpen(true);
      return;
    }
    if (lastInFlow) void flow.confirm();
    else flow.goNext('address-collection');
  };

  return (
    <div className="relative space-y-4 animate-slide-up">
      <StepHeader
        title={flow.isBusiness ? 'Is the pin on the premises?' : 'Is the pin on your building?'}
        description="Drag the map until the pin sits exactly on it. You can add details for whoever needs to find it."
        onBack={() => flow.goBack('address-collection')}
      />

      <div className="relative">
        <AddressMap
          value={pin}
          onChange={(next) => flow.setPin(next)}
          defaultCenter={flow.view.center}
          defaultZoom={flow.view.zoom}
          className="h-[52vh] min-h-[300px] sm:h-[420px]"
        />
        {pin && <LocateFab locating={flow.locating} onClick={() => void flow.locateToPin()} />}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {state.address ? displayAddressLine(state.address) : 'No pin placed yet'}
          </p>
          <p className="text-xs text-muted-foreground">
            {detailCount > 0
              ? `${detailCount} detail${detailCount === 1 ? '' : 's'} added`
              : 'A house number and directions help someone find it'}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setSheetOpen(true)}
          disabled={!pin}
          className="h-9 shrink-0 rounded-lg px-3 text-sm"
        >
          <PencilLine className="mr-1.5 h-3.5 w-3.5" /> Edit details
        </Button>
      </div>

      {askLabel && label && (
        <LabelDecisionRow label={label} onKeep={flow.keepPickedLabel} onAdopt={flow.adoptPinAddress} />
      )}
      {!pin && (
        <CurrentLocationRow
          hint={flow.currentFix?.label ?? null}
          locating={flow.locating}
          onClick={() => void flow.applyCurrentFix()}
        />
      )}

      {flow.error && <p className="text-sm text-destructive">{flow.error}</p>}
      {missingNudge && missingRequired.length > 0 && (
        <p className="text-sm text-destructive">
          This flow needs: {missingRequired.map((k) => ADDRESS_FIELD_LABELS[k].toLowerCase()).join(', ')}.
        </p>
      )}

      <Button
        onClick={handleContinue}
        disabled={!pin || flow.confirming}
        className="h-12 w-full rounded-xl text-base font-medium"
      >
        {flow.confirming ? 'Confirming…' : 'Continue'}
      </Button>

      {flow.address?.requirePin !== true && (
        <button
          type="button"
          onClick={flow.exitForward}
          className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          Skip for now
        </button>
      )}

      <DetailsSheet
        open={sheetOpen}
        isBusiness={flow.isBusiness}
        parts={state.address?.parts ?? null}
        country={flow.country ?? null}
        directionsRequired={flow.address?.directions === 'required'}
        addressConfig={flow.address}
        values={{
          propertyNumber: state.address?.propertyNumber ?? '',
          street: state.address?.street,
          unit: state.address?.unit,
          propertyName: state.address?.propertyName ?? '',
          directions: state.address?.directions ?? '',
          neighbourhood: state.address?.neighbourhood,
          city: state.address?.city,
          state: state.address?.state,
          postcode: state.address?.postcode,
        }}
        disabled={!pin}
        onChange={(patch) =>
          state.address && dispatch({ type: 'SET_ADDRESS', payload: { ...state.address, ...patch } })
        }
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
