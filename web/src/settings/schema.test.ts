/** The settings schema: defaults, validation, UI hints, and the set-setting command over it. */
import { describe, expect, it } from 'vitest';
import { CMD } from '@/commands/index';
import { defaults } from '@/defaults';
import { makeTestServices } from '@/test-helpers/services';
import { defaultSettings, parseSetting, settingKeys, settingMeta, SettingsSchema } from './schema';

describe('settings schema', () => {
  it('has strong defaults', () => {
    expect(defaultSettings()).toEqual({
      artifactSource: defaults.settings.artifactSource,
      tmdbApiKey: '',
      region: 'US',
      embeddingEnabled: true,
    });
  });

  it('validates the region as an ISO 3166-1 code, upper-casing it', () => {
    expect(parseSetting('region', 'gb')).toEqual({ ok: true, value: 'GB' });
    expect(parseSetting('region', 'Germany').ok).toBe(false);
  });

  it('refuses an empty artifact source', () => {
    expect(parseSetting('artifactSource', '  ').ok).toBe(false);
  });

  it('carries the form hints: the TMDB key is a secret, mood search a switch', () => {
    expect(settingKeys).toEqual(Object.keys(SettingsSchema.shape));
    expect(settingMeta('tmdbApiKey').widget).toBe('secret');
    expect(settingMeta('embeddingEnabled').widget).toBe('switch');
    for (const key of settingKeys) expect(settingMeta(key).title).not.toBe(key);
  });

  it('setSetting validates, stores through the provider, and reloads after a source change', async () => {
    const loads: string[] = [];
    const services = await makeTestServices();
    const loader = services.deps.loadArtifacts;
    services.deps.loadArtifacts = async (src) => {
      loads.push(src);
      return loader(src);
    };
    await services.dispatch(CMD.load);

    const bad = await services.dispatch(CMD.setSetting, { key: 'region', value: 'nowhere' });
    expect(bad.ok).toBe(false);

    await services.dispatch(CMD.setSetting, { key: 'region', value: 'fr' });
    expect(services.deps.store.getState().settings.region).toBe('FR');
    expect(await services.deps.providers.settings.getOne(defaults.storage.settingsRowId)).toMatchObject({ region: 'FR' });

    await services.dispatch(CMD.setSetting, { key: 'artifactSource', value: 'https://example.org/set/' });
    expect(loads).toEqual([defaults.settings.artifactSource, 'https://example.org/set/']);
  });

  it('stored settings survive a new session (hydration)', async () => {
    const first = await makeTestServices();
    await first.dispatch(CMD.load);
    await first.dispatch(CMD.setSetting, { key: 'embeddingEnabled', value: false });
    const second = await makeTestServices({ providers: first.deps.providers });
    await second.dispatch(CMD.load);
    expect(second.deps.store.getState().settings.embeddingEnabled).toBe(false);
  });
});
