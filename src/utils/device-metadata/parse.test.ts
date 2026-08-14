import { describe, it, expect } from 'vitest';
import { parseDeviceModel } from './parse';

// The real UA Chrome sends on Android since version 110: the OS version is
// frozen to "10" and the model is the literal placeholder "K", on every device.
const REDUCED_ANDROID =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36';

// What a pre-reduction Chrome, and other Android browsers, still send.
const FULL_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36';

describe('parseDeviceModel', () => {
  it('reports nothing for Chrome’s reduced-UA placeholder', () => {
    // "K" is a redaction, not a name. Reporting it produced a dashboard
    // reading "K K" for most Android traffic, which looks like a parsing bug.
    expect(parseDeviceModel(REDUCED_ANDROID)).toEqual({});
  });

  it('still reads a full Android UA', () => {
    expect(parseDeviceModel(FULL_ANDROID)).toEqual({
      vendor: 'Pixel',
      model: 'Pixel 7',
    });
  });

  it('does not mistake a model that merely starts with K', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 11; KB2005 Build/RP1A) Mobile';
    expect(parseDeviceModel(ua)).toEqual({ vendor: 'KB2005', model: 'KB2005' });
  });

  it('reads Apple devices from the UA', () => {
    expect(parseDeviceModel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4)')).toEqual({
      vendor: 'Apple',
      model: 'iPhone',
    });
    expect(parseDeviceModel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toEqual(
      { vendor: 'Apple', model: 'Mac' },
    );
  });

  it('reports nothing for a UA with no device information', () => {
    expect(parseDeviceModel('Mozilla/5.0 (X11; Linux x86_64)')).toEqual({});
  });
});
