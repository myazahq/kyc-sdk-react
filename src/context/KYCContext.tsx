'use client';

import React, { createContext, useContext, useReducer, useMemo, type ReactNode } from 'react';
import type { KYCState, KYCAction } from './types';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const initialKYCState: KYCState = {
  currentStep: 'consent',
  status: 'idle',
  isOpen: false,
  selectedIdType: null,
  documentFrontImage: null,
  documentBackImage: null,
  mediaIds: {},
  idNumber: '',
  userData: { firstName: '', lastName: '', dateOfBirth: '' },
  selfieImage: null,
  documentFrontVideoBlob: null,
  documentBackVideoBlob: null,
  livenessVideoBlob: null,
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

    case 'CLOSE_MODAL':
      return { ...initialKYCState };

    case 'SET_STEP':
      return { ...state, currentStep: action.payload, error: null };

    case 'SELECT_ID_TYPE':
      return { ...state, selectedIdType: action.payload };

    case 'SET_ID_NUMBER':
      return { ...state, idNumber: action.payload };

    case 'SET_USER_DATA':
      return { ...state, userData: { ...state.userData, ...action.payload } };

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

export function KYCProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(kycReducer, initialKYCState);
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
