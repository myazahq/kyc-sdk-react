import { describe, it, expect } from 'vitest';
import { isFrontFacingStream } from './capture-settings';

/** Minimal stand-in for a MediaStream carrying one video track. */
function streamWith(track: {
  facingMode?: string;
  label?: string;
} | null): MediaStream {
  return {
    getVideoTracks: () => (track === null ? [] : [
      {
        label: track.label ?? '',
        getSettings: () => ({ facingMode: track.facingMode }),
      },
    ]),
  } as unknown as MediaStream;
}

describe('isFrontFacingStream', () => {
  it('mirrors when the track reports a user-facing camera', () => {
    expect(isFrontFacingStream(streamWith({ facingMode: 'user' }))).toBe(true);
  });

  it('does not mirror when the track reports an environment camera', () => {
    expect(isFrontFacingStream(streamWith({ facingMode: 'environment' }))).toBe(
      false,
    );
  });

  it('mirrors a desktop webcam, which reports no facingMode at all', () => {
    expect(
      isFrontFacingStream(streamWith({ label: 'FaceTime HD Camera' })),
    ).toBe(true);
  });

  it('does not mirror a rear camera that omits facingMode but says so in its label', () => {
    // The regression this guards: treating an absent facingMode as "front"
    // mirrored rear cameras on every browser that omits it.
    expect(
      isFrontFacingStream(streamWith({ label: 'camera2 0, facing back' })),
    ).toBe(false);
    expect(isFrontFacingStream(streamWith({ label: 'Rear Camera' }))).toBe(
      false,
    );
  });

  it('mirrors a front camera whose label merely mentions a word containing "back"', () => {
    // Word-bounded, so "Backlit" is not read as "back".
    expect(isFrontFacingStream(streamWith({ label: 'Backlit Webcam' }))).toBe(
      true,
    );
  });

  it('does not mirror when there is no stream or no video track', () => {
    expect(isFrontFacingStream(null)).toBe(false);
    expect(isFrontFacingStream(streamWith(null))).toBe(false);
  });

  it('survives a track with no label', () => {
    expect(isFrontFacingStream(streamWith({}))).toBe(true);
  });
});
