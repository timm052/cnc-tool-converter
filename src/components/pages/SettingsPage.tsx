import { useState, createContext, useContext, type ReactNode } from 'react';
import { RotateCcw, Plus, Trash2 } from 'lucide-react';
import {
  useSettings,
  type Settings,
  type TableColumnVisibility,
} from '../../contexts/SettingsContext';
import {
  loadProfiles, createProfile, deleteProfile,
  type SettingsProfile,
} from '../../lib/settingsProfiles';
import {
  type CustomToolTypeDefinition,
  CUSTOM_TYPE_COLOUR_OPTIONS,
  getAllToolTypeOptions,
} from '../../lib/customToolTypes';

// ── Primitives ───────────────────────────────────────────────────────────────

const RowLabelCtx = createContext('');

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
        {title}
      </h3>
      <div className="rounded-xl border border-slate-700 divide-y divide-slate-700/60 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  description,
  align = 'center',
  children,
}: {
  label: string;
  description?: string;
  align?: 'center' | 'start';
  children: ReactNode;
}) {
  return (
    <div className={`flex gap-6 px-4 py-3.5 bg-slate-800/50 ${align === 'start' ? 'items-start' : 'items-center'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200">{label}</p>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">
        <RowLabelCtx.Provider value={label}>{children}</RowLabelCtx.Provider>
      </div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value ? 'true' : 'false'}
      className={[
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        value ? 'bg-blue-600' : 'bg-slate-600',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
          value ? 'translate-x-5' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );
}

function Sel<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const rowLabel = useContext(RowLabelCtx);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      aria-label={rowLabel || undefined}
      className="text-sm bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function NumInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  const rowLabel = useContext(RowLabelCtx);
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      aria-label={rowLabel || undefined}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        if (!isNaN(n)) onChange(n);
      }}
      className="w-20 text-sm bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-slate-200 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

function TextInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const rowLabel = useContext(RowLabelCtx);
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      aria-label={rowLabel || undefined}
      onChange={(e) => onChange(e.target.value)}
      className="w-44 text-sm bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

// ── Column labels ─────────────────────────────────────────────────────────────

const COL_LABELS: Record<keyof TableColumnVisibility, string> = {
  // Identity
  type:         'Type',
  description:  'Description',
  manufacturer: 'Manufacturer',
  // Geometry
  diameter:     'Ø Diameter',
  length:       'OAL Length',
  fluteLength:  'Flute Length',
  shaftDia:     'Shaft Ø',
  flutes:       'Flutes',
  cornerRadius: 'Corner Radius',
  taperAngle:   'Taper Angle',
  // Cutting
  rpm:          'RPM',
  feed:         'Feed rate',
  feedPlunge:   'Feed Plunge',
  coolant:      'Coolant',
  // Library / Crib
  material:     'Material',
  machineGroup: 'Machine Group',
  qty:          'Quantity',
  reorderPoint: 'Reorder Point',
  supplier:     'Supplier',
  unitCost:     'Unit Cost',
  location:     'Location',
  condition:    'Condition',
  useCount:     'Use Count',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [profiles,     setProfiles]     = useState<SettingsProfile[]>(loadProfiles);
  const [profileName,  setProfileName]  = useState('');

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    updateSettings({ [key]: value } as Partial<Settings>);
  }

  function setCol(col: keyof TableColumnVisibility, value: boolean) {
    updateSettings({
      tableColumnVisibility: { ...settings.tableColumnVisibility, [col]: value },
    });
  }

  function saveProfile() {
    if (!profileName.trim()) return;
    const p = createProfile(profileName, settings);
    setProfiles(loadProfiles());
    setProfileName('');
    return p;
  }

  function applyProfile(profile: SettingsProfile) {
    updateSettings(profile.settings);
  }

  function removeProfile(id: string) {
    deleteProfile(id);
    setProfiles(loadProfiles());
  }

  function setCustomTypes(types: CustomToolTypeDefinition[]) {
    set('customToolTypes', types);
  }

  function addCustomType() {
    const newType: CustomToolTypeDefinition = {
      id:               crypto.randomUUID(),
      label:            'New Type',
      profileShape:     'flat',
      colour:           CUSTOM_TYPE_COLOUR_OPTIONS[0].value,
      showsCornerRadius:   false,
      showsTaperAngle:     false,
      showsTipDiameter:    false,
      showsThreadFields:   false,
      showsNumTeeth:       false,
    };
    setCustomTypes([...settings.customToolTypes, newType]);
  }

  function updateCustomType(id: string, patch: Partial<CustomToolTypeDefinition>) {
    setCustomTypes(settings.customToolTypes.map((t) => t.id === id ? { ...t, ...patch } : t));
  }

  function removeCustomType(id: string) {
    setCustomTypes(settings.customToolTypes.filter((t) => t.id !== id));
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Settings</h1>
            <p className="text-sm text-slate-500 mt-0.5">Preferences are saved automatically to your browser.</p>
          </div>
          <button
            onClick={resetSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 bg-slate-800 hover:bg-slate-700 transition-colors mt-1"
          >
            <RotateCcw size={12} />
            Reset to defaults
          </button>
        </div>

        {/* Appearance / Theme */}
        <Section title="Appearance">
          <div className="px-4 py-4 bg-slate-800/50">
            <p className="text-sm text-slate-200 mb-3">Theme</p>
            <div className="flex gap-3 mb-2">
              {/* Auto (OS) */}
              <button
                type="button"
                onClick={() => set('theme', 'auto')}
                className={[
                  'flex-1 flex flex-col gap-2 p-3 border-2 text-left transition-all',
                  settings.theme === 'auto'
                    ? 'border-blue-500 bg-slate-700'
                    : 'border-slate-600 bg-slate-800 hover:border-slate-500',
                ].join(' ')}
              >
                <div className="w-full h-16 rounded overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-100 pointer-events-none select-none">
                  <span className="text-2xl">⚙️</span>
                </div>
                <span className="text-xs font-medium text-slate-300">Auto (OS)</span>
              </button>
            </div>
            <div className="flex gap-3">

              {/* Dark theme card */}
              <button
                type="button"
                onClick={() => set('theme', 'dark')}
                className={[
                  'flex-1 flex flex-col gap-2 p-3 border-2 text-left transition-all',
                  settings.theme === 'dark'
                    ? 'border-blue-500 bg-slate-700'
                    : 'border-slate-600 bg-slate-800 hover:border-slate-500',
                ].join(' ')}
              >
                <div className="w-full h-16 bg-slate-950 rounded overflow-hidden flex flex-col pointer-events-none select-none">
                  <div className="h-4 bg-slate-900 flex items-center px-1.5 gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                    <div className="w-8 h-1 bg-slate-600 rounded" />
                  </div>
                  <div className="flex flex-1 overflow-hidden">
                    <div className="w-8 bg-slate-800" />
                    <div className="flex-1 p-1 space-y-1">
                      <div className="h-1.5 bg-slate-700 rounded w-3/4" />
                      <div className="h-1.5 bg-slate-700 rounded w-1/2" />
                      <div className="h-1.5 bg-blue-600/40 rounded w-2/3" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Dark</p>
                  <p className="text-xs text-slate-500">Modern dark UI</p>
                </div>
                {settings.theme === 'dark' && (
                  <span className="text-xs text-blue-400 font-medium">✓ Active</span>
                )}
              </button>

              {/* Light theme card */}
              <button
                type="button"
                onClick={() => set('theme', 'light')}
                className={[
                  'flex-1 flex flex-col gap-2 p-3 border-2 text-left transition-all',
                  settings.theme === 'light'
                    ? 'border-blue-500 bg-slate-700'
                    : 'border-slate-600 bg-slate-800 hover:border-slate-500',
                ].join(' ')}
              >
                <div className="theme-preview-light w-full h-16 overflow-hidden flex flex-col pointer-events-none select-none">
                  <div className="theme-preview-light__titlebar h-4 flex items-center px-1.5 gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <div className="theme-preview-light__row w-8 h-1" />
                  </div>
                  <div className="flex flex-1 overflow-hidden">
                    <div className="theme-preview-light__body w-8" />
                    <div className="theme-preview-light__content flex-1 p-1 space-y-1">
                      <div className="theme-preview-light__row h-1.5 w-3/4" />
                      <div className="theme-preview-light__row h-1.5 w-1/2" />
                      <div className="theme-preview-light__row--accent h-1.5 w-2/3" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Light</p>
                  <p className="text-xs text-slate-500">Modern light UI</p>
                </div>
                {settings.theme === 'light' && (
                  <span className="text-xs text-blue-400 font-medium">✓ Active</span>
                )}
              </button>

              {/* Retro 90s theme card */}
              <button
                type="button"
                onClick={() => set('theme', 'retro90s')}
                className={[
                  'flex-1 flex flex-col gap-2 p-3 border-2 text-left transition-all',
                  settings.theme === 'retro90s'
                    ? 'border-blue-500 bg-slate-700'
                    : 'border-slate-600 bg-slate-800 hover:border-slate-500',
                ].join(' ')}
              >
                <div className="theme-preview-retro w-full h-16 overflow-hidden flex flex-col pointer-events-none select-none">
                  <div className="theme-preview-retro__titlebar h-4 flex items-center px-1.5 gap-1">
                    <div className="theme-preview-retro__titlebar-icon w-2 h-2" />
                    <div className="theme-preview-retro__titlebar-label w-8 h-1" />
                  </div>
                  <div className="theme-preview-retro__body flex flex-1 overflow-hidden">
                    <div className="theme-preview-retro__body w-8" />
                    <div className="theme-preview-retro__content flex-1 p-1 space-y-1">
                      <div className="theme-preview-retro__row h-1.5 w-3/4" />
                      <div className="theme-preview-retro__row h-1.5 w-1/2" />
                      <div className="theme-preview-retro__row--accent h-1.5 w-2/3" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Retro 90s</p>
                  <p className="text-xs text-slate-500">Windows 95/98 style</p>
                </div>
                {settings.theme === 'retro90s' && (
                  <span className="text-xs text-blue-400 font-medium">✓ Active</span>
                )}
              </button>

              {/* Mac OS 9 theme card */}
              <button
                type="button"
                onClick={() => set('theme', 'macos9')}
                className={[
                  'flex-1 flex flex-col gap-2 p-3 border-2 text-left transition-all',
                  settings.theme === 'macos9'
                    ? 'border-blue-500 bg-slate-700'
                    : 'border-slate-600 bg-slate-800 hover:border-slate-500',
                ].join(' ')}
              >
                <div className="theme-preview-mac9 w-full h-16 overflow-hidden flex flex-col pointer-events-none select-none">
                  <div className="theme-preview-mac9__titlebar h-4 flex items-center px-1.5 gap-1">
                    <div className="theme-preview-mac9__close w-2 h-2" />
                    <div className="theme-preview-mac9__label w-8 h-1" />
                  </div>
                  <div className="theme-preview-mac9__window flex flex-1 overflow-hidden">
                    <div className="theme-preview-mac9__body w-8" />
                    <div className="theme-preview-mac9__content flex-1 p-1 space-y-1">
                      <div className="theme-preview-mac9__row h-1.5 w-3/4" />
                      <div className="theme-preview-mac9__row h-1.5 w-1/2" />
                      <div className="theme-preview-mac9__row--accent h-1.5 w-2/3" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Mac OS 9</p>
                  <p className="text-xs text-slate-500">Platinum pinstripes</p>
                </div>
                {settings.theme === 'macos9' && (
                  <span className="text-xs text-blue-400 font-medium">✓ Active</span>
                )}
              </button>

              {/* Windows XP theme card */}
              <button
                type="button"
                onClick={() => set('theme', 'winxp')}
                className={[
                  'flex-1 flex flex-col gap-2 p-3 border-2 text-left transition-all',
                  settings.theme === 'winxp'
                    ? 'border-blue-500 bg-slate-700'
                    : 'border-slate-600 bg-slate-800 hover:border-slate-500',
                ].join(' ')}
              >
                <div className="theme-preview-xp w-full h-16 overflow-hidden flex flex-col pointer-events-none select-none">
                  <div className="theme-preview-xp__titlebar h-4 flex items-center px-1.5 gap-1">
                    <div className="theme-preview-xp__titlebar-icon w-2 h-2" />
                    <div className="theme-preview-xp__titlebar-label w-8 h-1" />
                  </div>
                  <div className="theme-preview-xp__window flex flex-1 overflow-hidden">
                    <div className="theme-preview-xp__body w-8" />
                    <div className="theme-preview-xp__content flex-1 p-1 space-y-1">
                      <div className="theme-preview-xp__row h-1.5 w-3/4" />
                      <div className="theme-preview-xp__row h-1.5 w-1/2" />
                      <div className="theme-preview-xp__row--accent h-1.5 w-2/3" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Windows XP</p>
                  <p className="text-xs text-slate-500">Luna blue, gradients</p>
                </div>
                {settings.theme === 'winxp' && (
                  <span className="text-xs text-blue-400 font-medium">✓ Active</span>
                )}
              </button>

            </div>
          </div>
        </Section>

        {/* Settings Profiles */}
        <Section title="Settings Profiles">
          <Row label="Saved profiles" description="Save the current settings as a named profile to switch between configurations." align="start">
            <div className="space-y-3 min-w-[220px]">
              {profiles.length === 0 && (
                <p className="text-xs text-slate-500">No profiles saved yet.</p>
              )}
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <button
                    onClick={() => applyProfile(p)}
                    className="flex-1 text-left px-2.5 py-1.5 rounded-lg text-xs bg-slate-700 hover:bg-blue-600 text-slate-200 hover:text-white border border-slate-600 transition-colors truncate"
                    title={`Apply "${p.name}"`}
                  >
                    {p.name}
                  </button>
                  <button onClick={() => removeProfile(p.id)} title={`Delete profile "${p.name}"`} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveProfile()}
                  placeholder="Profile name…"
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={saveProfile}
                  disabled={!profileName.trim()}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </Row>
        </Section>

        {/* Conversion Defaults */}
        <Section title="Conversion Defaults">
          <Row label="Default units" description="Applied when a format doesn't specify units.">
            <Sel
              value={settings.defaultUnits}
              options={[
                { value: 'metric',   label: 'Metric (mm)' },
                { value: 'imperial', label: 'Imperial (in)' },
              ]}
              onChange={(v) => set('defaultUnits', v)}
            />
          </Row>
          <Row label="Remember last format pair" description="Restore the source and target formats when the app is reopened.">
            <Toggle value={settings.rememberLastFormatPair} onChange={(v) => set('rememberLastFormatPair', v)} />
          </Row>
          <Row label="Auto-convert on file load" description="Run conversion immediately after files are dropped or loaded.">
            <Toggle value={settings.autoConvertOnLoad} onChange={(v) => set('autoConvertOnLoad', v)} />
          </Row>
        </Section>

        {/* File Handling */}
        <Section title="File Handling">
          <Row label="Multi-file behaviour" description="How multiple dropped files are handled.">
            <Sel
              value={settings.mergeBehavior}
              options={[
                { value: 'merge',    label: 'Merge into one library' },
                { value: 'separate', label: 'Convert separately' },
              ]}
              onChange={(v) => set('mergeBehavior', v)}
            />
          </Row>
          <Row label="Warn on data loss" description="Show a banner when fields can't be represented in the target format.">
            <Toggle value={settings.warnOnDataLoss} onChange={(v) => set('warnOnDataLoss', v)} />
          </Row>
        </Section>

        {/* Tool Library */}
        <Section title="Tool Library">
          {/* New Tool Defaults */}
          <div className="px-4 pt-3 pb-1 bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">New Tool Defaults</p>
          </div>
          <Row label="Default machine group" description="Pre-filled when opening the New Tool editor.">
            <TextInput
              value={settings.libraryDefaultMachineGroup}
              placeholder="e.g. VF-2"
              onChange={(v) => set('libraryDefaultMachineGroup', v)}
            />
          </Row>
          <Row label="Default tool number" description="Starting T# for newly created tools.">
            <NumInput
              value={settings.libraryDefaultToolNumber}
              min={1}
              max={9999}
              onChange={(v) => set('libraryDefaultToolNumber', Math.max(1, v))}
            />
          </Row>
          <Row label="Default tool type" description="Tool type selected when opening the New Tool editor.">
            <Sel
              value={settings.libraryDefaultType}
              options={getAllToolTypeOptions(settings.customToolTypes)}
              onChange={(v) => set('libraryDefaultType', v)}
            />
          </Row>

          {/* Import Defaults */}
          <div className="px-4 pt-3 pb-1 bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Import Defaults</p>
          </div>
          <Row label="Auto-assign machine group" description="Applied to all tools when importing. Leave blank to keep the source value.">
            <TextInput
              value={settings.libraryImportDefaultMachineGroup}
              placeholder="e.g. Lathe"
              onChange={(v) => set('libraryImportDefaultMachineGroup', v)}
            />
          </Row>
          <Row label="Overwrite duplicates by default" description="Pre-checks the overwrite option in the Import panel.">
            <Toggle value={settings.libraryImportOverwrite} onChange={(v) => set('libraryImportOverwrite', v)} />
          </Row>

          {/* Display */}
          <div className="px-4 pt-3 pb-1 bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Display</p>
          </div>
          <Row label="Default sort column" description="Column the library table is sorted by when first loaded.">
            <Sel
              value={settings.librarySortKey}
              options={[
                { value: 'addedAt',     label: 'Date added' },
                { value: 'toolNumber',  label: 'Tool number' },
                { value: 'description', label: 'Description' },
                { value: 'type',        label: 'Type' },
                { value: 'diameter',    label: 'Diameter' },
              ]}
              onChange={(v) => set('librarySortKey', v)}
            />
          </Row>
          <Row label="Default sort direction">
            <Sel
              value={settings.librarySortDir}
              options={[
                { value: 'desc', label: 'Descending' },
                { value: 'asc',  label: 'Ascending' },
              ]}
              onChange={(v) => set('librarySortDir', v)}
            />
          </Row>
          <Row label="Max tags per row" description="Number of tag chips shown before a +N overflow indicator.">
            <NumInput
              value={settings.libraryMaxTagsShown}
              min={1}
              max={10}
              onChange={(v) => set('libraryMaxTagsShown', Math.max(1, Math.min(10, v)))}
            />
          </Row>
          <Row label="Validation warnings" description="Show a warning icon on tools with missing or inconsistent geometry values.">
            <Toggle value={settings.validationWarningsEnabled} onChange={(v) => set('validationWarningsEnabled', v)} />
          </Row>
        </Section>

        {/* LinuxCNC Writer */}
        <Section title="LinuxCNC Writer">
          <Row label="Starting tool number offset" description="Added to every T number on export. 0 = no offset.">
            <NumInput
              value={settings.linuxcncStartingToolNumber}
              min={0}
              max={9999}
              onChange={(v) => set('linuxcncStartingToolNumber', Math.max(0, v))}
            />
          </Row>
          <Row label="Pocket (P) assignment" description="How pocket numbers are assigned to exported tools.">
            <Sel
              value={settings.linuxcncPocketAssignment}
              options={[
                { value: 'match-t',    label: 'Match T number' },
                { value: 'sequential', label: 'Sequential from 1' },
              ]}
              onChange={(v) => set('linuxcncPocketAssignment', v)}
            />
          </Row>
          <Row label="Coordinate decimal places" description="Precision of X / Y / Z / D values in the .tbl file.">
            <NumInput
              value={settings.linuxcncDecimalPlaces}
              min={1}
              max={10}
              onChange={(v) => set('linuxcncDecimalPlaces', Math.max(1, Math.min(10, v)))}
            />
          </Row>
          <Row label="Include header comment" description="Add a comment line at the top of exported .tbl files.">
            <Toggle value={settings.linuxcncIncludeHeaderComment} onChange={(v) => set('linuxcncIncludeHeaderComment', v)} />
          </Row>
        </Section>

        {/* HSMLib Writer */}
        <Section title="HSMLib / Fusion 360 Writer">
          <Row label="Default machine vendor" description="Written as a comment in exported .hsmlib files when set.">
            <TextInput
              value={settings.hsmlibDefaultMachineVendor}
              placeholder="e.g. Haas"
              onChange={(v) => set('hsmlibDefaultMachineVendor', v)}
            />
          </Row>
          <Row label="Default machine model" description="Written as a comment in exported .hsmlib files when set.">
            <TextInput
              value={settings.hsmlibDefaultMachineModel}
              placeholder="e.g. VF-2"
              onChange={(v) => set('hsmlibDefaultMachineModel', v)}
            />
          </Row>
        </Section>

        {/* Display */}
        <Section title="Display">
          <Row label="Table decimal precision" description="Decimal places shown for dimensions in the parsed tools table.">
            <NumInput
              value={settings.tableDecimalPrecision}
              min={1}
              max={8}
              onChange={(v) => set('tableDecimalPrecision', Math.max(1, Math.min(8, v)))}
            />
          </Row>
          <Row label="Row density" description="Vertical padding in the parsed tools table.">
            <Sel
              value={settings.tableRowDensity}
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact',     label: 'Compact' },
              ]}
              onChange={(v) => set('tableRowDensity', v)}
            />
          </Row>
          <Row label="Visible columns" description="Choose which columns appear in the parsed tools table." align="start">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 pt-0.5">
              {(Object.entries(COL_LABELS) as [keyof TableColumnVisibility, string][]).map(([col, label]) => (
                <label key={col} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.tableColumnVisibility[col]}
                    onChange={(e) => setCol(col, e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-300">{label}</span>
                </label>
              ))}
            </div>
          </Row>
        </Section>

        {/* Custom Tool Types */}
        <Section title="Custom Tool Types">
          <Row label="Defined types" description="Add custom tool types that appear in the Type dropdown alongside built-in types." align="start">
            <div className="space-y-3 min-w-[260px]">
              {settings.customToolTypes.length === 0 && (
                <p className="text-xs text-slate-500">No custom types defined.</p>
              )}
              {settings.customToolTypes.map((ct) => (
                <div key={ct.id} className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ct.label}
                      aria-label="Custom type label"
                      onChange={(e) => updateCustomType(ct.id, { label: e.target.value })}
                      className="flex-1 px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Type label"
                    />
                    <button onClick={() => removeCustomType(ct.id)} title="Remove custom type" className="p-1 text-slate-500 hover:text-red-400 shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Profile shape</p>
                      <select
                        value={ct.profileShape}
                        aria-label="Profile shape"
                        onChange={(e) => updateCustomType(ct.id, { profileShape: e.target.value as CustomToolTypeDefinition['profileShape'] })}
                        className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        {([
                          ['flat',             'Flat (end mill)'],
                          ['ball',             'Ball'],
                          ['bull nose',        'Bull Nose'],
                          ['tapered',          'Tapered / V-tip'],
                          ['tapered ball',     'Tapered Ball'],
                          ['tapered bull nose','Tapered Bull Nose'],
                          ['drill',            'Drill (pointed)'],
                          ['center drill',     'Center Drill'],
                          ['counter bore',     'Counter Bore'],
                          ['reamer',           'Reamer'],
                          ['tap',              'Tap'],
                          ['thread mill',      'Thread Mill'],
                        ] as [string, string][]).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Badge colour</p>
                      <select
                        value={ct.colour}
                        aria-label="Badge colour"
                        onChange={(e) => updateCustomType(ct.id, { colour: e.target.value })}
                        className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        {CUSTOM_TYPE_COLOUR_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {([
                      ['showsCornerRadius', 'Corner radius'],
                      ['showsTaperAngle',   'Taper angle'],
                      ['showsTipDiameter',  'Tip diameter'],
                      ['showsThreadFields', 'Thread fields'],
                      ['showsNumTeeth',     'Num. teeth'],
                    ] as [keyof CustomToolTypeDefinition, string][]).map(([field, label]) => (
                      <label key={String(field)} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={ct[field] as boolean}
                          onChange={(e) => updateCustomType(ct.id, { [field]: e.target.checked })}
                          className="w-3 h-3 rounded border-slate-500 bg-slate-700 text-blue-500"
                        />
                        <span className="text-xs text-slate-400">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={addCustomType}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 transition-colors"
              >
                <Plus size={12} />
                Add custom type
              </button>
            </div>
          </Row>
        </Section>

        {/* Developer */}
        <Section title="Developer">
          <Row label="Dev mode" description="Show the Preview Debug tab in the sidebar">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.devMode}
                onChange={(e) => set('devMode', e.target.checked)}
                className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-slate-300">Enable dev mode</span>
            </label>
          </Row>
        </Section>

      </div>
    </div>
  );
}
