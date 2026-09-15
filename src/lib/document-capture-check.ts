// Reading the server's capture check into what the applicant is asked to fix.
//
// After a document is uploaded, `POST /api/kyc/document-capture/check` says
// whether the verification can read it: a face on the printed photo, a barcode
// that decodes. `false` means a detector looked and found nothing, which is worth
// a retake; `null` means it was not checked or could not look, which is not. A
// detector can miss, so the applicant can always continue anyway.
//
// Mirrored word for word by the React Native (`lib/documentCaptureCheck.ts`) and
// Flutter (`config/document_capture_check.dart`) SDKs. Pure; unit-tested.

export type CaptureSide = 'front' | 'back';

export interface DocumentCaptureCheckResult {
  side: CaptureSide;
  face: boolean | null;
  barcode: boolean | null;
}

export type CaptureProblemKind = 'no_face' | 'no_barcode';

export interface CaptureProblem {
  side: CaptureSide;
  kind: CaptureProblemKind;
}

export const CAPTURE_CHECK_TITLE = 'Check your photos';
export const CAPTURE_CHECK_CONTINUE_ANYWAY = 'Continue anyway';

const MESSAGES: Record<CaptureProblemKind, string> = {
  no_face:
    "We couldn't see the face in the photo on the front of your ID. Retake it in good light, with the ID out of any plastic cover and no glare over the photo.",
  no_barcode:
    "We couldn't read the barcode on the back of your ID. Retake it with the ID out of any plastic cover, flat, filling the frame and with no glare over the barcode.",
};

/** What to fix, front before back and the face before the barcode. */
export function captureCheckProblems(results: Array<DocumentCaptureCheckResult | null>): CaptureProblem[] {
  const problems: CaptureProblem[] = [];
  for (const side of ['front', 'back'] as const) {
    for (const result of results) {
      if (!result || result.side !== side) continue;
      if (result.face === false) problems.push({ side, kind: 'no_face' });
      if (result.barcode === false) problems.push({ side, kind: 'no_barcode' });
    }
  }
  return problems;
}

export function captureProblemMessage(kind: CaptureProblemKind): string {
  return MESSAGES[kind];
}

/** One sentence per kind of problem, in the order found. */
export function captureProblemMessages(problems: CaptureProblem[]): string[] {
  return [...new Set(problems.map((p) => p.kind))].map(captureProblemMessage);
}

/** The sides to offer a retake for, front first. */
export function captureProblemSides(problems: CaptureProblem[]): CaptureSide[] {
  return (['front', 'back'] as const).filter((side) => problems.some((p) => p.side === side));
}

/** A photo picked from the device is replaced, not retaken. */
export function captureRetakeLabel(side: CaptureSide, uploadOnly: boolean): string {
  const verb = uploadOnly ? 'Replace' : 'Retake';
  return `${verb} ${side}`;
}
