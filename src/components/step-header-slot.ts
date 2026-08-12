'use client';

import { createContext, useContext } from 'react';

/**
 * Where a step's title row renders.
 *
 * RN and Flutter both draw the title, description, back arrow and country flag
 * INSIDE the header block, above the step indicator and below the brand row.
 * The web SDK used to render it in the step body instead, which is the single
 * biggest reason the three headers looked different.
 *
 * Rather than edit fifteen step components, the header exposes a slot and
 * `StepHeader` portals into it. Steps keep calling `<StepHeader …/>` exactly as
 * before and land in the right place.
 *
 * Three states, and the distinction between the last two matters:
 *   • `undefined` — no modal above us (e.g. the standalone biometric re-auth
 *     component). Render inline, as always.
 *   • `null` — inside the modal, but the slot node has not mounted yet. Render
 *     NOTHING, so the title doesn't flash in the body for one frame before
 *     jumping into the header.
 *   • an element — portal into it.
 */
export const StepHeaderSlotContext = createContext<HTMLElement | null | undefined>(undefined);

export function useStepHeaderSlot(): HTMLElement | null | undefined {
  return useContext(StepHeaderSlotContext);
}
