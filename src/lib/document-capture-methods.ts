// ─── Document capture methods ─────────────────────────────────────────────────
//
// A workflow chooses how the applicant supplies a photo of each document side:
// scanned live with the camera (`allowDocumentScan`), picked from the device
// (`allowDocumentUpload`), or either. Both default ON when absent.
//
// At least one must stay on. The server refuses to publish a workflow with both
// switched off, but a stored config or a consumer prop can still carry that
// pair, and a document step with no way to capture is a dead end. So when
// upload is off, the camera is on, whatever `allowDocumentScan` says.
//
// Components read the pair through here, never the raw keys, so the rule lives
// in exactly one place.

export interface DocumentCaptureMethodFlags {
  allowDocumentScan?: boolean;
  allowDocumentUpload?: boolean;
}

export interface DocumentCaptureMethods {
  /** The live camera scan: viewfinder, auto-capture, per-side video. */
  scan: boolean;
  /** Picking a photo from the device: file picker, drag and drop. */
  upload: boolean;
}

export function documentCaptureMethods(
  config: DocumentCaptureMethodFlags | null | undefined,
): DocumentCaptureMethods {
  const upload = config?.allowDocumentUpload !== false;
  // Only an explicit `false` switches the scan off, and never while upload is
  // also off: that pair would leave the step with no way to capture.
  const scan = config?.allowDocumentScan !== false || !upload;
  return { scan, upload };
}

/**
 * Whether the document step would open the camera. False when document capture
 * is off, and when documents are upload-only: a photo picked from the device
 * needs no camera, so the document step alone gives no reason to move the flow
 * to a phone or to disclose a recording.
 */
export function documentCaptureNeedsCamera(
  config: (DocumentCaptureMethodFlags & { enableDocumentCapture?: boolean }) | null | undefined,
): boolean {
  return config?.enableDocumentCapture !== false && documentCaptureMethods(config).scan;
}
