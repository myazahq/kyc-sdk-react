'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Loader2, RefreshCcw, Smartphone } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from './ui/drawer';
import { Button } from './ui/button';
import { useKYCConfig } from '../context/KYCConfigContext';
import { useKYCContext } from '../context/KYCContext';
import { useDeviceHandoff } from '../hooks/useDeviceHandoff';
import { isDesktopDevice } from '../lib/device';
import type { HandoffSessionSnapshot } from '../services/api';

/**
 * Mobile-only. Renders an unobtrusive "Continue on a different device" trigger
 * at the bottom of the consent step; tapping it opens a bottom-sheet drawer
 * with a QR code + copyable link. Returns null on desktop (DeviceHandoffGate
 * handles that path instead).
 */
export function MobileHandoffSheet() {
  const config = useKYCConfig();
  const { dispatch } = useKYCContext();
  const [isDesktop, setIsDesktop] = useState(true); // SSR-safe: assume desktop until after mount
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => { setIsDesktop(isDesktopDevice()); }, []);

  const snapshot = useMemo<HandoffSessionSnapshot>(() => ({
    country: config.country,
    ...(config.idTypes ? { idTypes: config.idTypes } : {}),
    ...(config.enableSelfie !== undefined ? { enableSelfie: config.enableSelfie } : {}),
    ...(config.enableDocumentCapture !== undefined ? { enableDocumentCapture: config.enableDocumentCapture } : {}),
    ...(config.allowDocumentUpload !== undefined ? { allowDocumentUpload: config.allowDocumentUpload } : {}),
    ...(config.enableLiveness !== undefined ? { enableLiveness: config.enableLiveness } : {}),
    ...(config.appearance ? { appearance: config.appearance as Record<string, unknown> } : {}),
    ...(config.consent ? { consent: config.consent as Record<string, unknown> } : {}),
    ...(config.success ? { success: config.success as Record<string, unknown> } : {}),
    ...(config.metadata ? { metadata: config.metadata } : {}),
  }), [
    config.country, config.idTypes, config.enableSelfie, config.enableDocumentCapture,
    config.allowDocumentUpload, config.enableLiveness, config.appearance,
    config.consent, config.success, config.metadata,
  ]);

  // Session is only created when the drawer is open (enabled=open).
  const handoff = useDeviceHandoff(config.api, snapshot, open);

  // When the other device completes, fire onSubmit once and close this flow.
  useEffect(() => {
    if (handoff.phase === 'submitted' && handoff.verificationId && !submittedRef.current) {
      submittedRef.current = true;
      config.onSubmit?.({
        verificationId: handoff.verificationId,
        status: 'pending',
        metadata: { ...(config.metadata ?? {}) },
        submittedAt: new Date().toISOString(),
      });
      setTimeout(() => {
        setOpen(false);
        dispatch({ type: 'CLOSE_MODAL' });
      }, 1500);
    }
  }, [handoff.phase, handoff.verificationId, config, dispatch]);

  const copyLink = () => {
    if (!handoff.url) return;
    navigator.clipboard?.writeText(handoff.url).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => { /* ignore */ },
    );
  };

  if (isDesktop || config.deviceHandoff === false) return null;

  return (
    <>
      {/* Subtle trigger — icon + label, low-contrast so it doesn't compete with the primary CTA */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors hover:underline underline-offset-2"
      >
        <Smartphone className="h-3 w-3" />
        Continue on a different device
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="flex flex-col items-center gap-5 px-6 pb-8 pt-4">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <DrawerTitle className="font-heading text-lg">Continue on another device</DrawerTitle>
              <DrawerDescription className="text-xs leading-relaxed max-w-[260px]">
                Scan the QR code with another device to continue your verification there.
              </DrawerDescription>
            </div>

            {/* QR / loading / error / submitted */}
            {handoff.phase === 'submitted' ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-(--kyc-success)/10">
                  <svg className="h-8 w-8 text-(--kyc-success)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12l5 5L20 6" strokeDasharray="100" strokeDashoffset="100" className="animate-checkmark" />
                  </svg>
                </div>
                <p className="text-sm font-medium">Completed on the other device</p>
                <p className="text-xs text-muted-foreground">Closing this flow…</p>
              </div>
            ) : handoff.phase === 'error' ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-xs text-muted-foreground text-center max-w-60">
                  Couldn't create a handoff link. Check your connection and try again.
                </p>
                <Button size="sm" variant="outline" className="gap-2" onClick={handoff.regenerate}>
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Try again
                </Button>
              </div>
            ) : (
              <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-border bg-white p-3.5">
                {handoff.url ? (
                  <QRCodeSVG value={handoff.url} size={172} level="M" marginSize={0} />
                ) : (
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                )}
              </div>
            )}

            {/* Short code + copy link — shown while QR is live */}
            {handoff.code && handoff.phase !== 'submitted' && handoff.phase !== 'error' && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Or enter this code</span>
                <span className="font-heading text-lg font-semibold tracking-[0.22em]">{handoff.code}</span>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={copyLink}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              </div>
            )}

            {handoff.phase === 'opened' && (
              <p className="flex items-center gap-1.5 text-xs text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Continuing on the other device…
              </p>
            )}

            {handoff.phase !== 'submitted' && (
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setOpen(false)}>
                I'll stay on this device
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
