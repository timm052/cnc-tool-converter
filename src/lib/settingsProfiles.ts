import type { Settings } from '../contexts/SettingsContext';

const STORAGE_KEY = 'cnc-tool-converter:profiles';

export interface SettingsProfile {
  id:        string;
  name:      string;
  settings:  Settings;
  createdAt: number;
}

export function loadProfiles(): SettingsProfile[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as SettingsProfile[];
  } catch { /* ignore */ }
  return [];
}

function saveProfiles(profiles: SettingsProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch { /* quota exceeded */ }
}

export function createProfile(name: string, settings: Settings): SettingsProfile {
  const profile: SettingsProfile = {
    id:        crypto.randomUUID(),
    name:      name.trim(),
    settings:  { ...settings },
    createdAt: Date.now(),
  };
  saveProfiles([...loadProfiles(), profile]);
  return profile;
}

export function deleteProfile(id: string): void {
  saveProfiles(loadProfiles().filter((p) => p.id !== id));
}

export function updateProfileName(id: string, name: string): void {
  saveProfiles(loadProfiles().map((p) => p.id === id ? { ...p, name: name.trim() } : p));
}
