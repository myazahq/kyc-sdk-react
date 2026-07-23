'use client';

import React, { useEffect, useState } from 'react';

/**
 * Live "expires in m:ss" ticker for a one-time code. Ticks once a second and
 * stops at zero, so a stale challenge reads as expired instead of claiming
 * minutes that already elapsed. Mirrors the Flutter SDK's ExpiryCountdown.
 */
export function ExpiryCountdown({
  expiresAt,
  className,
  expiredLabel = 'The code has expired. Request a new one.',
}: {
  /** ISO timestamp from the send response. */
  expiresAt: string;
  className?: string;
  expiredLabel?: string;
}) {
  const target = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    // Re-seed on a resend: the new challenge carries a later expiry.
    setRemaining(Math.max(0, target - Date.now()));
    const id = setInterval(() => {
      const left = Math.max(0, target - Date.now());
      setRemaining(left);
      if (left === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  // An unparseable timestamp would render "NaN:aN" — fall back to nothing.
  if (!Number.isFinite(target)) return null;

  if (remaining === 0) return <span className={className}>{expiredLabel}</span>;

  const totalSeconds = Math.ceil(remaining / 1000);
  const label = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
  return <span className={className}>The code expires in {label}</span>;
}
