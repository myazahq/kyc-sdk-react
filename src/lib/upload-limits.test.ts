import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { IMAGE_MAX_BYTES, PDF_MAX_BYTES, UPLOAD_HINT, uploadSizeError } from './upload-limits';

// ─── The shared vectors (kyc-sdk-flutter/test/upload_limits_vectors.json) ────
//
// The size rule and the hint under every drop zone are data the three SDKs
// must agree on; one file holds them and each mirror's test reads it.

interface Vectors {
  hint: string;
  imageMaxBytes: number;
  pdfMaxBytes: number;
  cases: Array<{ name: string; mime: string | null; bytes: number | null; error: string | null }>;
}

const vectors: Vectors = JSON.parse(
  readFileSync(
    new URL('../../../kyc-sdk-flutter/test/upload_limits_vectors.json', import.meta.url).pathname,
    'utf8',
  ),
);

describe('upload limits', () => {
  it('carry the shared caps and hint', () => {
    expect(IMAGE_MAX_BYTES).toBe(vectors.imageMaxBytes);
    expect(PDF_MAX_BYTES).toBe(vectors.pdfMaxBytes);
    expect(UPLOAD_HINT).toBe(vectors.hint);
    expect(UPLOAD_HINT).not.toContain('—');
  });

  for (const c of vectors.cases) {
    it(c.name, () => {
      expect(uploadSizeError(c.mime, c.bytes)).toBe(c.error);
    });
  }

  it('the drop zones read the hint from the one constant', () => {
    for (const rel of ['../steps/ProofOfAddressParts.tsx', '../steps/BusinessDocumentSlot.tsx']) {
      const src = readFileSync(new URL(rel, import.meta.url).pathname, 'utf8');
      expect(src).toContain('UPLOAD_HINT');
      expect(src).not.toMatch(/up to 20MB/);
    }
  });
});
