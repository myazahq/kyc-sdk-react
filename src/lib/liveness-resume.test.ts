import { describe, expect, it } from 'vitest';
import { withoutUnrecordedSelfie } from './liveness-resume';
import {
  getIntegrityMetadata,
  recordLivenessSignals,
  recordRecorderFailure,
  resetIntegritySignals,
  settleLivenessVideo,
} from './integrity-signals';

describe('withoutUnrecordedSelfie', () => {
  it('drops a restored selfie with no recording and sends a later step back to liveness', () => {
    expect(withoutUnrecordedSelfie({ step: 'submitted', mediaIds: { selfie: 'm1', documentFront: 'd1' } })).toEqual({
      step: 'liveness',
      mediaIds: { documentFront: 'd1' },
    });
    expect(withoutUnrecordedSelfie({ step: 'questionnaire', mediaIds: { selfie: 'm1' } }).step).toBe('liveness');
  });

  it('leaves an earlier step alone: the person walks into liveness on the way', () => {
    expect(withoutUnrecordedSelfie({ step: 'id-type', mediaIds: { selfie: 'm1' } })).toEqual({
      step: 'id-type',
      mediaIds: {},
    });
  });

  it('drops a restored recording with it: the claim behind them cannot be restored', () => {
    expect(withoutUnrecordedSelfie({ step: 'submitted', mediaIds: { selfie: 'm1', livenessVideo: 'v1' } })).toEqual({
      step: 'liveness',
      mediaIds: {},
    });
  });

  it('changes nothing when no selfie was restored', () => {
    const none = { step: 'document-capture', mediaIds: { documentFront: 'd1' } };
    expect(withoutUnrecordedSelfie(none)).toBe(none);
  });
});

describe('settleLivenessVideo', () => {
  const video = () => getIntegrityMetadata()?.liveness?.video;

  it('reports nothing when no liveness check ran', () => {
    resetIntegritySignals();
    settleLivenessVideo({ hadRecording: false, uploaded: false });
    expect(getIntegrityMetadata()).toBeUndefined();
  });

  it('reports a recording that reached the server', () => {
    resetIntegritySignals();
    recordLivenessSignals({ mode: 'gestures' });
    settleLivenessVideo({ hadRecording: true, uploaded: true });
    expect(video()).toEqual({ recorded: true });
  });

  it('names the cause when it did not', () => {
    resetIntegritySignals();
    recordLivenessSignals({ mode: 'flash' });
    settleLivenessVideo({ hadRecording: true, uploaded: false });
    expect(video()).toEqual({ recorded: false, failure: 'upload_failed' });

    resetIntegritySignals();
    recordLivenessSignals({ mode: 'flash' });
    recordRecorderFailure('recorder_unsupported');
    settleLivenessVideo({ hadRecording: false, uploaded: false });
    expect(video()).toEqual({ recorded: false, failure: 'recorder_unsupported' });

    resetIntegritySignals();
    recordLivenessSignals({ mode: 'gestures' });
    settleLivenessVideo({ hadRecording: false, uploaded: false });
    expect(video()).toEqual({ recorded: false, failure: 'recording_missing' });
  });
});
