'use client';

import React, { createContext, useContext, useReducer, useMemo, useEffect, type ReactNode } from 'react';
import { recordStep } from '../lib/step-log';
import { normalizeRestoredKeyPeople } from '../lib/key-person-normalize';
import { primeDeviceHints } from '../utils/device-metadata';
import type { KYCState, KYCAction } from './types';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const initialKYCState: KYCState = {
  currentStep: 'consent',
  status: 'idle',
  isOpen: false,
  sessionId: null,
  selectedCountry: null,
  selectedIdType: null,
  multiIdSlotIndex: 0,
  multiIdSlots: [],
  documentFrontImage: null,
  documentBackImage: null,
  mediaIds: {},
  idNumber: '',
  userData: { firstName: '', lastName: '', dateOfBirth: '' },
  business: { country: null, product: null, registrationNumber: '', registrationName: '', contactEmail: '', address: '', email: '', phone: '', website: '', dateOfIncorporation: '', taxId: '', vatNumber: '', companyType: '', natureOfBusiness: '' },
  businessCheck: { status: 'idle', company: null, keyPeople: [], checkedNumber: null, prefilled: [] },
  businessApplication: { keyPeople: [], documents: [], applicantRole: null, applicantName: '', applicantKeyPersonIndex: null, uboUnidentifiable: false },
  selfieImage: null,
  documentFrontVideoBlob: null,
  documentBackVideoBlob: null,
  livenessVideoBlob: null,
  contact: { emailToken: null, emailAddress: null, phoneToken: null, phoneNumber: null, expired: [] },
  questionnaireAnswers: {},
  poaDocumentType: null,
  poaFileName: null,
  verificationId: null,
  error: null,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function kycReducer(state: KYCState, action: KYCAction): KYCState {
  switch (action.type) {
    case 'OPEN_MODAL':
      return { ...state, isOpen: true };

    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };

    // Rehydrate a resumed attempt. Merged field-by-field rather than spread
    // wholesale: the payload crosses the network, and blindly assigning it could
    // overwrite control state (isOpen, status) with whatever came back.
    // Previews and video blobs are absent by design — a slot with a mediaId
    // counts as captured even though its thumbnail is gone.
    case 'RESTORE_PROGRESS': {
      const { step, mediaIds, data } = action.payload;
      const d = (data ?? {}) as Partial<KYCState>;
      return {
        ...state,
        ...(step ? { currentStep: step as KYCState['currentStep'] } : {}),
        ...(mediaIds ? { mediaIds: { ...state.mediaIds, ...mediaIds } } : {}),
        ...(d.selectedCountry ? { selectedCountry: d.selectedCountry } : {}),
        ...(d.selectedIdType ? { selectedIdType: d.selectedIdType } : {}),
        ...(typeof d.multiIdSlotIndex === 'number' && d.multiIdSlotIndex > 0
          ? { multiIdSlotIndex: d.multiIdSlotIndex }
          : {}),
        ...(Array.isArray(d.multiIdSlots) && d.multiIdSlots.length > 0
          ? { multiIdSlots: d.multiIdSlots }
          : {}),
        ...(typeof d.idNumber === 'string' ? { idNumber: d.idNumber } : {}),
        ...(d.userData ? { userData: { ...state.userData, ...d.userData } } : {}),
        ...(d.business ? { business: { ...state.business, ...d.business } } : {}),
        ...(d.businessApplication
          ? {
              businessApplication: {
                ...state.businessApplication,
                ...d.businessApplication,
                // The snapshot was written by WHATEVER build saved it, and the
                // row shape has grown over time — so EVERY field is coerced
                // back to its declared type (not just the late arrivals; a
                // partial backfill left `.trim()` crashing on rows missing
                // `name`/`email`/`ownershipPct`). Degrade to restoring less,
                // never to breaking the flow.
                ...(d.businessApplication.keyPeople
                  ? {
                      keyPeople:
                        normalizeRestoredKeyPeople(d.businessApplication.keyPeople) ??
                        state.businessApplication.keyPeople,
                    }
                  : {}),
              },
            }
          : {}),
        ...(d.contact ? { contact: { ...state.contact, ...d.contact } } : {}),
        ...(d.questionnaireAnswers
          ? { questionnaireAnswers: { ...state.questionnaireAnswers, ...d.questionnaireAnswers } }
          : {}),
      };
    }

    case 'CLOSE_MODAL':
      return { ...initialKYCState };

    case 'SET_STEP':
      return { ...state, currentStep: action.payload, error: null };

    case 'SET_COUNTRY': {
      // Switching country invalidates any prior ID-type choice (ID types are
      // country-specific) — INCLUDING a multi-ID run already part-walked. Those
      // committed slots hold the previous country's IDs, which its registers
      // cannot verify, so the run restarts rather than carrying them over.
      const changed = state.selectedCountry !== action.payload;
      return {
        ...state,
        selectedCountry: action.payload,
        selectedIdType: changed ? null : state.selectedIdType,
        ...(changed && state.multiIdSlots.length > 0
          ? { multiIdSlots: [], multiIdSlotIndex: 0, idNumber: '' }
          : {}),
      };
    }

    case 'SELECT_ID_TYPE':
      return { ...state, selectedIdType: action.payload };

    // Multi-ID: commit the current slot's evidence and move on — to the next
    // slot's picker, or to liveness after the last. The run-level state
    // (selfie, contact proofs, questionnaire) is untouched: it belongs to the
    // ONE submission built at the end from these committed slots.
    case 'COMMIT_MULTI_ID_SLOT':
      return {
        ...state,
        multiIdSlots: [
          ...state.multiIdSlots,
          {
            idType: state.selectedIdType ?? '',
            idNumber: state.idNumber.trim() || undefined,
            documentFront: state.mediaIds.documentFront,
            documentBack: state.mediaIds.documentBack,
            // Kept for the back journey only — stripped from every payload.
            documentFrontImage: state.documentFrontImage,
            documentBackImage: state.documentBackImage,
            // Each check records its OWN document capture. The blobs are
            // carried here and uploaded with the submission, exactly like a
            // single-ID run: clearing them at commit (as this used to) meant a
            // multi-ID run recorded the capture and then threw it away.
            documentFrontVideoBlob: state.documentFrontVideoBlob,
            documentBackVideoBlob: state.documentBackVideoBlob,
          },
        ],
        multiIdSlotIndex: state.multiIdSlotIndex + 1,
        currentStep: action.payload.nextStep,
        selectedIdType: null,
        idNumber: '',
        documentFrontImage: null,
        documentBackImage: null,
        documentFrontVideoBlob: null,
        documentBackVideoBlob: null,
        mediaIds: {
          ...state.mediaIds,
          documentFront: undefined,
          documentBack: undefined,
          documentFrontVideo: undefined,
          documentBackVideo: undefined,
        },
      };

    // Multi-ID: back INTO the previous verification — pop it and restore what
    // was captured, so changing an earlier ID does not mean re-doing work that
    // is still perfectly good.
    case 'UNCOMMIT_MULTI_ID_SLOT': {
      const last = state.multiIdSlots[state.multiIdSlots.length - 1];
      if (!last) return state;
      return {
        ...state,
        multiIdSlots: state.multiIdSlots.slice(0, -1),
        multiIdSlotIndex: Math.max(state.multiIdSlotIndex - 1, 0),
        currentStep: action.payload.step,
        status: 'idle',
        error: null,
        selectedIdType: last.idType,
        idNumber: last.idNumber ?? '',
        documentFrontImage: last.documentFrontImage ?? null,
        documentBackImage: last.documentBackImage ?? null,
        documentFrontVideoBlob: last.documentFrontVideoBlob ?? null,
        documentBackVideoBlob: last.documentBackVideoBlob ?? null,
        mediaIds: {
          ...state.mediaIds,
          documentFront: last.documentFront,
          documentBack: last.documentBack,
        },
      };
    }

    case 'SET_ID_NUMBER':
      return { ...state, idNumber: action.payload };

    case 'SET_USER_DATA':
      return { ...state, userData: { ...state.userData, ...action.payload } };

    case 'SET_BUSINESS_DETAILS':
      return { ...state, business: { ...state.business, ...action.payload } };

    case 'SET_BUSINESS_CHECK':
      return { ...state, businessCheck: { ...state.businessCheck, ...action.payload } };

    case 'SET_BUSINESS_APPLICATION':
      return { ...state, businessApplication: { ...state.businessApplication, ...action.payload } };

    // ── Document capture ────────────────────────────────────────────────────

    case 'SET_DOCUMENT_FRONT':
      return { ...state, documentFrontImage: action.payload };

    case 'SET_DOCUMENT_BACK':
      return { ...state, documentBackImage: action.payload };

    case 'CLEAR_DOCUMENT_FRONT':
      return {
        ...state,
        documentFrontImage: null,
        documentFrontVideoBlob: null,
        mediaIds: { ...state.mediaIds, documentFront: undefined, documentFrontVideo: undefined },
      };

    case 'CLEAR_DOCUMENT_BACK':
      return {
        ...state,
        documentBackImage: null,
        documentBackVideoBlob: null,
        mediaIds: { ...state.mediaIds, documentBack: undefined, documentBackVideo: undefined },
      };

    case 'CLEAR_DOCUMENT_ALL':
      return {
        ...state,
        documentFrontImage: null,
        documentBackImage: null,
        documentFrontVideoBlob: null,
        documentBackVideoBlob: null,
        mediaIds: {
          ...state.mediaIds,
          documentFront: undefined,
          documentBack: undefined,
          documentFrontVideo: undefined,
          documentBackVideo: undefined,
        },
        idNumber: '',
      };

    // ── Media IDs ───────────────────────────────────────────────────────────

    case 'SET_MEDIA_ID':
      return {
        ...state,
        mediaIds: { ...state.mediaIds, [action.payload.mediaType]: action.payload.mediaId },
      };

    case 'CLEAR_MEDIA_IDS':
      return { ...state, mediaIds: {} };

    // ── Selfie / liveness ───────────────────────────────────────────────────

    case 'SET_SELFIE_IMAGE':
      return { ...state, selfieImage: action.payload };

    case 'CLEAR_SELFIE_IMAGE':
      return {
        ...state,
        selfieImage: null,
        mediaIds: { ...state.mediaIds, selfie: undefined },
      };

    // ── Video blobs ─────────────────────────────────────────────────────────

    case 'SET_DOCUMENT_FRONT_VIDEO':
      return { ...state, documentFrontVideoBlob: action.payload };

    case 'SET_DOCUMENT_BACK_VIDEO':
      return { ...state, documentBackVideoBlob: action.payload };

    case 'SET_LIVENESS_VIDEO':
      return { ...state, livenessVideoBlob: action.payload };

    case 'CLEAR_LIVENESS_VIDEO':
      return { ...state, livenessVideoBlob: null };

    // ── Contact verification ────────────────────────────────────────────────

    case 'SET_CONTACT_PROOF': {
      // Verified proofs survive RETRY on purpose — the user shouldn't have to
      // re-OTP after a failed submission (the server proof stays valid ~30 min).
      // A fresh proof also clears its channel's "server refused this" flag.
      const expired = (Array.isArray(state.contact.expired) ? state.contact.expired : []).filter(
        (c) => c !== action.payload.channel,
      );
      return action.payload.channel === 'email'
        ? {
            ...state,
            contact: { ...state.contact, emailToken: action.payload.token, emailAddress: action.payload.destination, expired },
          }
        : {
            ...state,
            contact: { ...state.contact, phoneToken: action.payload.token, phoneNumber: action.payload.destination, expired },
          };
    }

    case 'CLEAR_CONTACT_PROOFS':
      // The server refused these proofs at submit (single-use tokens expire
      // ~30 min after the OTP check, and session restore can resurrect a dead
      // one). Drop the tokens, keep the destinations (re-verification prefills
      // them), and flag the channels so their steps explain and resubmit.
      return {
        ...state,
        contact: {
          ...state.contact,
          ...(action.payload.channels.includes('email') ? { emailToken: null } : {}),
          ...(action.payload.channels.includes('phone') ? { phoneToken: null } : {}),
          expired: action.payload.channels,
        },
      };

    // ── Questionnaire ───────────────────────────────────────────────────────

    case 'SET_QUESTIONNAIRE_ANSWER': {
      const next = { ...state.questionnaireAnswers };
      if (action.payload.value === undefined) delete next[action.payload.key];
      else next[action.payload.key] = action.payload.value;
      return { ...state, questionnaireAnswers: next };
    }

    // ── Proof of Address ────────────────────────────────────────────────────

    case 'SET_POA_DOCUMENT':
      return {
        ...state,
        poaDocumentType: action.payload.documentType,
        poaFileName: action.payload.fileName,
      };

    case 'CLEAR_POA_DOCUMENT':
      return {
        ...state,
        poaDocumentType: null,
        poaFileName: null,
        mediaIds: { ...state.mediaIds, proofOfAddress: undefined },
      };

    // ── Submission ──────────────────────────────────────────────────────────

    case 'SUBMIT_VERIFICATION':
      return { ...state, currentStep: 'submitted', status: 'loading', error: null };

    case 'SUBMISSION_SUCCESS':
      return { ...state, status: 'success', verificationId: action.payload };

    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.payload };

    case 'CLEAR_ERROR':
      return { ...state, status: 'idle', error: null };

    case 'RETRY':
      return {
        ...state,
        currentStep: 'id-type',
        status: 'idle',
        selectedIdType: null,
        idNumber: '',
        documentFrontImage: null,
        documentBackImage: null,
        documentFrontVideoBlob: null,
        documentBackVideoBlob: null,
        livenessVideoBlob: null,
        mediaIds: {},
        selfieImage: null,
        verificationId: null,
        error: null,
      };

    case 'RESET':
      return { ...initialKYCState };
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface KYCContextValue {
  state: KYCState;
  dispatch: React.Dispatch<KYCAction>;
}

const KYCContext = createContext<KYCContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function KYCProvider({
  children,
  initialStep,
}: {
  children: ReactNode;
  /**
   * Where the flow starts. Only the rehydrated hosted screen sets it, to open
   * ON the terminal step: dispatching it after mount would paint the consent
   * screen (and a "step 1 of N" progress bar) for a frame first.
   */
  initialStep?: KYCState['currentStep'];
}) {
  const [state, dispatch] = useReducer(kycReducer, initialKYCState, (base) =>
    initialStep ? { ...base, currentStep: initialStep } : base,
  );

  // Step journey log — records every step the user reaches, at the ONE seam
  // every mount variant shares (embedded modal, config-driven, hosted page —
  // all dispatch OPEN_MODAL). recordStep collapses consecutive duplicates.
  // Reset lives at the modal-open handlers; a hosted page is a fresh module.
  useEffect(() => {
    // The slot the applicant is on, so the server can tell "next ID" from
    // "went back" (see step-log.ts).
    if (state.isOpen) {
      // Only once a slot has actually been committed: on an ordinary run the
      // field would be a constant 1 on every entry, which is noise.
      const slot = state.multiIdSlots.length > 0 ? state.multiIdSlots.length + 1 : undefined;
      recordStep(state.currentStep, slot, state.selectedIdType ?? undefined);
    }
  }, [state.isOpen, state.currentStep]);

  // Ask for the real device model as early as possible. The client-hints call
  // is async but the submit metadata is built synchronously, so it is primed
  // here — the same shared seam — and read from cache minutes later.
  useEffect(() => {
    primeDeviceHints();
  }, []);

  const value = useMemo<KYCContextValue>(() => ({ state, dispatch }), [state]);
  return <KYCContext.Provider value={value}>{children}</KYCContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKYCContext(): KYCContextValue {
  const ctx = useContext(KYCContext);
  if (!ctx) throw new Error('useKYCContext must be used within a <KYCProvider>');
  return ctx;
}
