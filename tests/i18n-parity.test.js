import { describe, expect, it } from 'vitest';
import { locales, t } from '../renderer/i18n.js';

describe('i18n parity', () => {
  it('EN and RU expose the same key set', () => {
    const en = Object.keys(locales.en).sort();
    const ru = Object.keys(locales.ru).sort();
    const onlyEn = en.filter((k) => !(k in locales.ru));
    const onlyRu = ru.filter((k) => !(k in locales.en));
    expect(onlyEn, `EN-only keys: ${onlyEn.join(', ')}`).toEqual([]);
    expect(onlyRu, `RU-only keys: ${onlyRu.join(', ')}`).toEqual([]);
    expect(en).toEqual(ru);
  });

  it('resolves a known key in English by default', () => {
    expect(t('app.title')).toBe('BLIP');
  });
});
