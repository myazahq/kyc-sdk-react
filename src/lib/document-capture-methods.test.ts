import { describe, expect, it } from 'vitest';
import { documentCaptureMethods, documentCaptureNeedsCamera } from './document-capture-methods';

describe('documentCaptureMethods', () => {
  it('offers both methods when the config says nothing', () => {
    expect(documentCaptureMethods({})).toEqual({ scan: true, upload: true });
    expect(documentCaptureMethods(undefined)).toEqual({ scan: true, upload: true });
    expect(documentCaptureMethods(null)).toEqual({ scan: true, upload: true });
  });

  it('reads only an explicit false as off', () => {
    expect(documentCaptureMethods({ allowDocumentScan: true, allowDocumentUpload: true })).toEqual({
      scan: true,
      upload: true,
    });
  });

  it('is camera only when upload is switched off', () => {
    expect(documentCaptureMethods({ allowDocumentUpload: false })).toEqual({ scan: true, upload: false });
  });

  it('is upload only when the scan is switched off', () => {
    expect(documentCaptureMethods({ allowDocumentScan: false })).toEqual({ scan: false, upload: true });
  });

  it('keeps the camera on when both are switched off, never a step with no way to capture', () => {
    expect(documentCaptureMethods({ allowDocumentScan: false, allowDocumentUpload: false })).toEqual({
      scan: true,
      upload: false,
    });
  });
});

describe('documentCaptureNeedsCamera', () => {
  it('needs the camera by default', () => {
    expect(documentCaptureNeedsCamera({})).toBe(true);
    expect(documentCaptureNeedsCamera(undefined)).toBe(true);
  });

  it('needs no camera when document capture is off', () => {
    expect(documentCaptureNeedsCamera({ enableDocumentCapture: false })).toBe(false);
  });

  it('needs no camera when documents are upload only', () => {
    expect(documentCaptureNeedsCamera({ allowDocumentScan: false })).toBe(false);
  });

  it('needs the camera again when both methods are off, because the camera is the fallback', () => {
    expect(documentCaptureNeedsCamera({ allowDocumentScan: false, allowDocumentUpload: false })).toBe(true);
  });

  it('needs the camera for scan only and for both on', () => {
    expect(documentCaptureNeedsCamera({ allowDocumentUpload: false })).toBe(true);
    expect(documentCaptureNeedsCamera({ allowDocumentScan: true, allowDocumentUpload: true })).toBe(true);
  });
});
