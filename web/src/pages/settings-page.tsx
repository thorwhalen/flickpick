/**
 * Settings (`#/settings`): one field per key of `SettingsSchema`, rendered from the schema (its
 * `.meta()` gives the label, help text and widget). Text fields keep a local draft and save on
 * blur or Enter through `app.settings.set`, which validates with the same schema; a refused value
 * stays in the field with the schema's message beside it.
 */
import { useEffect, useId, useState } from 'react';
import { CMD } from '@/commands/index';
import { settingKeys, settingMeta, type SettingKey } from '@/settings/schema';
import { useApp, useDispatch } from '@/state/hooks';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Input } from '@/ui/input';
import { Switch } from '@/ui/switch';

function TextSetting({ settingKey }: { settingKey: SettingKey }) {
  const meta = settingMeta(settingKey);
  const value = useApp((s) => s.settings[settingKey]);
  const dispatch = useDispatch();
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setDraft(String(value)), [value]);

  const save = async () => {
    if (draft === String(value)) return;
    const result = await dispatch<{ changed: boolean }>(CMD.setSetting, { key: settingKey, value: draft });
    setError(result.ok ? null : result.error.message);
    setSaved(result.ok && result.value.changed);
  };
  const secret = meta.widget === 'secret';

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {meta.title}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          type={secret && !revealed ? 'password' : meta.widget === 'url' ? 'url' : 'text'}
          autoComplete="off"
          spellCheck={false}
          value={draft}
          placeholder={meta.placeholder}
          aria-invalid={error !== null}
          aria-describedby={`${id}-help`}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
          onBlur={() => void save()}
          onKeyDown={(e) => e.key === 'Enter' && void save()}
        />
        {secret && (
          <Button variant="outline" onClick={() => setRevealed((r) => !r)} aria-pressed={revealed}>
            {revealed ? 'Hide' : 'Show'}
          </Button>
        )}
      </div>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {meta.description}
      </p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="text-xs text-success">
          Saved.
        </p>
      )}
    </div>
  );
}

function SwitchSetting({ settingKey }: { settingKey: SettingKey }) {
  const meta = settingMeta(settingKey);
  const value = useApp((s) => s.settings[settingKey]) as boolean;
  const dispatch = useDispatch();
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <label htmlFor={id} className="text-sm font-medium">
          {meta.title}
        </label>
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {meta.description}
        </p>
      </div>
      <Switch
        id={id}
        checked={value}
        aria-describedby={`${id}-help`}
        onCheckedChange={(checked) => void dispatch(CMD.setSetting, { key: settingKey, value: checked })}
      />
    </div>
  );
}

export function SettingsPage() {
  const hydrated = useApp((s) => s.hydrated);
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-sm text-muted-foreground">Stored in this browser only.</p>
      {hydrated && (
        <Card className="space-y-6 p-4">
          {settingKeys.map((key) =>
            settingMeta(key).widget === 'switch' ? <SwitchSetting key={key} settingKey={key} /> : <TextSetting key={key} settingKey={key} />,
          )}
        </Card>
      )}
    </div>
  );
}
