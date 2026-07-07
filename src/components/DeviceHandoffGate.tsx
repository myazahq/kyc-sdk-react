'use client';

import React, { useEffect, useReducer, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  Copy,
  Loader2,
  Monitor,
  Moon,
  RefreshCcw,
  Smartphone,
  Sun,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { VisuallyHidden } from './VisuallyHidden';
import { useKYCConfig } from '../context/KYCConfigContext';
import { useBranding } from '../hooks/useBranding';
import { useDeviceHandoff } from '../hooks/useDeviceHandoff';
import { hasNoWebcam } from '../lib/device';
import { buildThemeVars } from '../lib/theme';
import { cn } from '../lib/utils';
import type { HandoffSessionSnapshot } from '../services/api';

interface DeviceHandoffGateProps {
  /** PII-free config snapshot sent to the server to mint the session. */
  snapshot: HandoffSessionSnapshot;
  /** User chose to verify on this computer — close the gate, open the flow. */
  onContinueHere: () => void;
  /** Gate dismissed (X / backdrop / completed-on-phone "Done"). */
  onClose: () => void;
  /** Mirror the modal's controls. */
  showThemeToggle?: boolean;
  disableClose?: boolean;
}

// Minimal theme toggle, mirroring KYCModal's (kept local — the modal's isn't
// exported and the gate renders outside it).
function ThemeToggle() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('myaza-kyc-theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
    rerender();
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function HeaderBrand() {
  const { logo, companyName } = useBranding();
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(logo) && !failed;
  return (
    <div className="flex min-w-0 items-center gap-2">
      {showLogo && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5">
          <img src={logo} alt={companyName ? `${companyName} logo` : 'Company logo'} className="h-full w-full object-cover" onError={() => setFailed(true)} />
        </div>
      )}
      {showLogo && companyName && <span className="truncate text-sm font-semibold text-foreground">{companyName}</span>}
    </div>
  );
}

export default function DeviceHandoffGate({
  snapshot,
  onContinueHere,
  onClose,
  showThemeToggle,
  disableClose,
}: DeviceHandoffGateProps) {
  const config = useKYCConfig();
  const handoff = useDeviceHandoff(config.api, snapshot, true);
  const [copied, setCopied] = useState(false);
  const [noCamera, setNoCamera] = useState(false);
  const submittedRef = useRef(false);
  const themeVars = buildThemeVars(config.appearance);

  // Apply the configured initial theme, matching KYCModal.
  useEffect(() => {
    const theme = config.appearance?.theme;
    if (theme) document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [config.appearance?.theme]);

  // Best-effort: if there's no webcam, lead harder with the QR.
  useEffect(() => {
    let active = true;
    hasNoWebcam().then((v) => { if (active) setNoCamera(v); });
    return () => { active = false; };
  }, []);

  // If the session can't be created (server not running, endpoint not deployed,
  // network error), silently fall through to the local flow. The user sees a
  // brief spinner, then the normal modal opens — no error screen.
  useEffect(() => {
    if (handoff.phase === 'error') onContinueHere();
  }, [handoff.phase, onContinueHere]);

  // Fire onSubmit EXACTLY ONCE when the phone completes. The desktop never
  // enters the verification flow, so it never calls api.verify — this is the
  // only submission signal on this device.
  useEffect(() => {
    if (handoff.phase === 'submitted' && handoff.verificationId && !submittedRef.current) {
      submittedRef.current = true;
      config.onSubmit?.({
        verificationId: handoff.verificationId,
        status: 'pending',
        metadata: { ...(config.metadata ?? {}) },
        submittedAt: new Date().toISOString(),
      });
    }
  }, [handoff.phase, handoff.verificationId, config]);

  const copyLink = () => {
    if (!handoff.url) return;
    navigator.clipboard?.writeText(handoff.url).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => { /* ignore */ },
    );
  };

  const isTerminal = handoff.phase === 'submitted';
  const dismissBlocked = disableClose === true && !isTerminal;

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !dismissBlocked) onClose(); }}>
      <DialogContent
        className="kyc-root"
        style={themeVars}
        onPointerDownOutside={(e) => { if (dismissBlocked) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (dismissBlocked) e.preventDefault(); }}
      >
        <VisuallyHidden>
          <DialogTitle>Continue your verification</DialogTitle>
          <DialogDescription>Continue on your phone or this device</DialogDescription>
        </VisuallyHidden>

        <div className="flex h-full flex-col overflow-hidden rounded-[inherit]">
          <div className="relative flex min-h-12 items-center justify-between gap-2 px-3 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
            <HeaderBrand />
            <div className="flex shrink-0 items-center gap-1">
              {showThemeToggle !== false && <ThemeToggle />}
              {!dismissBlocked && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
            <GateBody
              phase={handoff.phase}
              url={handoff.url}
              code={handoff.code}
              noCamera={noCamera}
              copied={copied}
              onCopyLink={copyLink}
              onContinueHere={onContinueHere}
              onRegenerate={handoff.regenerate}
              onDone={onClose}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Body — one render per phase
// ---------------------------------------------------------------------------

interface GateBodyProps {
  phase: ReturnType<typeof useDeviceHandoff>['phase'];
  url: string | null;
  code: string | null;
  noCamera: boolean;
  copied: boolean;
  onCopyLink: () => void;
  onContinueHere: () => void;
  onRegenerate: () => void;
  onDone: () => void;
}

function GateBody({
  phase, url, code, noCamera, copied,
  onCopyLink, onContinueHere, onRegenerate, onDone,
}: GateBodyProps) {
  if (phase === 'submitted') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--kyc-success)]/10">
          <svg className="h-10 w-10 text-[var(--kyc-success)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12l5 5L20 6" strokeDasharray="100" strokeDashoffset="100" className="animate-checkmark" />
          </svg>
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-xl font-semibold font-heading">Completed on your phone</h2>
          <p className="text-sm text-muted-foreground">Your verification has been submitted for review. You can close this window.</p>
        </div>
        <Button className="w-full" onClick={onDone}>Done</Button>
      </div>
    );
  }

  if (phase === 'expired') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <RefreshCcw className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold font-heading">Link expired</h2>
          <p className="text-sm text-muted-foreground">This verification link timed out. Generate a new one, or continue on this device.</p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button className="w-full" onClick={onRegenerate}>Generate a new link</Button>
          <Button variant="ghost" className="w-full" onClick={onContinueHere}>Continue on this device</Button>
        </div>
      </div>
    );
  }

  // error: useEffect in the parent calls onContinueHere() — keep showing the
  // spinner so there’s no flash of error UI before the gate closes.

  // creating | waiting | opened | error
  return (
    <div className="flex flex-col items-center gap-6 py-2 animate-fade-in">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Smartphone className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold font-heading">Continue on your phone</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {noCamera
            ? 'This device has no camera. Scan the QR code with your phone to finish your verification there.'
            : 'Scan the QR code with your phone to continue your verification there — handy for capturing your ID and selfie.'}
        </p>
      </div>

      {/* QR */}
      <div className="flex h-[232px] w-[232px] items-center justify-center rounded-2xl border border-border bg-white p-4">
        {url ? (
          <QRCodeSVG value={url} size={200} level="M" marginSize={0} />
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Short code + copy link */}
      {code && (
        <div className="flex w-full flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Or enter this code</span>
          <span className="font-heading text-lg font-semibold tracking-[0.2em] text-foreground">{code}</span>
          <Button variant="outline" className="mt-1 gap-2" onClick={onCopyLink}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Link copied' : 'Copy link'}
          </Button>
        </div>
      )}

      {phase === 'opened' && (
        <p className="flex items-center gap-2 text-sm text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Continuing on your phone…
        </p>
      )}

      {/* Continue here — disabled once the phone has opened the link */}
      <div className="w-full border-t border-border pt-4">
        <Button
          variant="ghost"
          className={cn('w-full gap-2', phase === 'opened' && 'pointer-events-none opacity-50')}
          onClick={onContinueHere}
          disabled={phase === 'opened'}
        >
          <Monitor className="h-4 w-4" />
          Continue on this device
        </Button>
      </div>
    </div>
  );
}
