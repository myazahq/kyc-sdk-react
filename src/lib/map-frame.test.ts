import { describe, it, expect } from 'vitest';
import {
  buildMapFrameSrc,
  frameOriginOf,
  parseMapFrameMessage,
  centerMessage,
  MAP_FRAME_SOURCE,
} from './map-frame';

const FRAME = 'https://trust.myaza.co/embed/map?grant=abc123';

describe('buildMapFrameSrc', () => {
  it('keeps the grant and adds the render parameters', () => {
    const src = buildMapFrameSrc(FRAME, {
      parentOrigin: 'https://app.acme.com',
      center: { lat: 6.4281, lng: 3.4219 },
      zoom: 12,
      hasPin: false,
      theme: 'dark',
      primaryColor: '#5645F5',
    });
    const url = new URL(src);
    expect(url.origin).toBe('https://trust.myaza.co');
    expect(url.searchParams.get('grant')).toBe('abc123');
    expect(url.searchParams.get('origin')).toBe('https://app.acme.com');
    expect(url.searchParams.get('zoom')).toBe('12');
    expect(url.searchParams.get('theme')).toBe('dark');
    expect(url.searchParams.get('primary')).toBe('#5645F5');
  });

  it('zooms in when a pin already exists', () => {
    const src = buildMapFrameSrc(FRAME, {
      parentOrigin: 'https://app.acme.com',
      center: { lat: 1, lng: 2 },
      zoom: 12,
      hasPin: true,
    });
    expect(new URL(src).searchParams.get('zoom')).toBe('16');
  });
});

describe('frameOriginOf', () => {
  it('extracts the origin, null on garbage', () => {
    expect(frameOriginOf(FRAME)).toBe('https://trust.myaza.co');
    expect(frameOriginOf('not a url')).toBeNull();
  });
});

describe('parseMapFrameMessage', () => {
  it('accepts the three message shapes', () => {
    expect(parseMapFrameMessage({ source: MAP_FRAME_SOURCE, type: 'ready' })).toEqual({ type: 'ready' });
    expect(parseMapFrameMessage({ source: MAP_FRAME_SOURCE, type: 'failed' })).toEqual({ type: 'failed' });
    expect(parseMapFrameMessage({ source: MAP_FRAME_SOURCE, type: 'pin', lat: 6.4, lng: 3.4 })).toEqual({
      type: 'pin',
      lat: 6.4,
      lng: 3.4,
    });
  });

  it('drops foreign, malformed and out-of-range messages', () => {
    expect(parseMapFrameMessage(null)).toBeNull();
    expect(parseMapFrameMessage('ready')).toBeNull();
    expect(parseMapFrameMessage({ type: 'ready' })).toBeNull();
    expect(parseMapFrameMessage({ source: 'someone-else', type: 'ready' })).toBeNull();
    expect(parseMapFrameMessage({ source: MAP_FRAME_SOURCE, type: 'pin', lat: 'x', lng: 3 })).toBeNull();
    expect(parseMapFrameMessage({ source: MAP_FRAME_SOURCE, type: 'pin', lat: NaN, lng: 3 })).toBeNull();
    expect(parseMapFrameMessage({ source: MAP_FRAME_SOURCE, type: 'pin', lat: 91, lng: 3 })).toBeNull();
    expect(parseMapFrameMessage({ source: MAP_FRAME_SOURCE, type: 'pin', lat: 6, lng: 181 })).toBeNull();
  });
});

describe('centerMessage', () => {
  it('carries the parent source tag', () => {
    expect(centerMessage({ lat: 1, lng: 2 })).toMatchObject({ source: 'myaza-sdk', type: 'center', lat: 1, lng: 2 });
  });
});
