import { describe, expect, it } from 'vitest';
import { createTextFn, fillPlaceholders, resolveText } from './translate';

describe('text lookup', () => {
  it('falls back from the language, to English, to the default', () => {
    const texts = { en: { 'common.continue': 'Next' }, fr: { 'common.continue': 'Continuer' } };
    expect(resolveText('common.continue', { texts, language: 'fr' })).toBe('Continuer');
    expect(resolveText('common.continue', { texts, language: 'pt' })).toBe('Next');
    expect(resolveText('common.continue')).toBe('Continue');
  });

  it('treats a blank override as unset, so clearing a field restores the default', () => {
    expect(resolveText('common.continue', { texts: { en: { 'common.continue': '   ' } } })).toBe('Continue');
  });

  it('fills placeholders and drops missing values without leaving braces', () => {
    expect(fillPlaceholders('{done} of {total}', { done: 2, total: 5 })).toBe('2 of 5');
    const t = createTextFn(undefined, 'en', { firstName: undefined });
    expect(t('x.greeting', undefined, 'Welcome, {firstName}')).toBe('Welcome,');
  });

  it('leaves an unknown placeholder visible rather than guessing', () => {
    expect(fillPlaceholders('Hello {nobody}', {})).toBe('Hello {nobody}');
  });

  it('lets an older dedicated field win in English, but not over another language', () => {
    const texts = { en: { 'common.continue': 'Next' }, fr: { 'common.continue': 'Continuer' } };
    expect(resolveText('common.continue', { texts, legacy: 'Go on' })).toBe('Go on');
    expect(resolveText('common.continue', { texts, language: 'fr', legacy: 'Go on' })).toBe('Continuer');
    expect(resolveText('common.continue', { legacy: '  ' })).toBe('Continue');
  });

  it('returns the key itself for an unknown key, so a gap is visible in development', () => {
    expect(resolveText('nope.missing')).toBe('nope.missing');
  });
});
