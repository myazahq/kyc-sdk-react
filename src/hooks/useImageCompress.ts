'use client';

import { useState, useCallback } from 'react';
import { compressImage, compressDocumentImage } from '../utils/image';

export interface UseImageCompressReturn {
  /** Generic/selfie compression — moderate quality, capped at ~1 MB. */
  compress: (base64: string) => Promise<string>;
  /** Document compression — OCR-conservative (high quality, ≥1080 px wide). */
  compressDocument: (base64: string) => Promise<string>;
  isCompressing: boolean;
  error: string | null;
}

export function useImageCompress(): UseImageCompressReturn {
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (fn: (base64: string) => Promise<string>, base64: string): Promise<string> => {
      setIsCompressing(true);
      setError(null);
      try {
        return await fn(base64);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Image compression failed';
        setError(message);
        throw err;
      } finally {
        setIsCompressing(false);
      }
    },
    [],
  );

  const compress = useCallback((base64: string) => run(compressImage, base64), [run]);
  const compressDocument = useCallback((base64: string) => run(compressDocumentImage, base64), [run]);

  return { compress, compressDocument, isCompressing, error };
}
