export type MachineType = 'mill' | 'lathe' | 'turn-mill' | 'edm' | 'grinder' | 'router' | 'plasma' | 'laser' | 'other';
export const MACHINE_TYPE_LABELS: Record<MachineType, string> = {
  mill: 'Mill', lathe: 'Lathe', 'turn-mill': 'Turn-Mill', edm: 'EDM',
  grinder: 'Grinder', router: 'Router', plasma: 'Plasma', laser: 'Laser', other: 'Other',
};
export const MACHINE_TYPE_COLOURS: Record<MachineType, string> = {
  mill: 'bg-blue-500/20 text-blue-300', lathe: 'bg-amber-500/20 text-amber-300',
  'turn-mill': 'bg-violet-500/20 text-violet-300', edm: 'bg-cyan-500/20 text-cyan-300',
  grinder: 'bg-orange-500/20 text-orange-300', router: 'bg-emerald-500/20 text-emerald-300',
  plasma: 'bg-red-500/20 text-red-300', laser: 'bg-pink-500/20 text-pink-300',
  other: 'bg-slate-500/20 text-slate-300',
};
export type ControlType = 'fanuc' | 'haas' | 'siemens' | 'linuxcnc' | 'mach3' | 'mitsubishi' | 'okuma' | 'mazak' | 'heidenhain' | 'other';
export const CONTROL_TYPE_LABELS: Record<ControlType, string> = {
  fanuc: 'Fanuc', haas: 'HAAS', siemens: 'Siemens Sinumerik', linuxcnc: 'LinuxCNC',
  mach3: 'Mach3/Mach4', mitsubishi: 'Mitsubishi', okuma: 'Okuma', mazak: 'Mazak (Mazatrol)',
  heidenhain: 'Heidenhain', other: 'Other',
};
export type SpindleTaper = 'bt30' | 'bt40' | 'bt50' | 'cat30' | 'cat40' | 'cat50' | 'hsk-a40' | 'hsk-a63' | 'hsk-a100' | 'hsk-e32' | 'r8' | 'mt2' | 'mt3' | 'mt4' | 'nt30' | 'nt40' | 'nt50' | 'capto-c4' | 'capto-c5' | 'capto-c6' | 'other';
export const SPINDLE_TAPER_LABELS: Record<SpindleTaper, string> = {
  'bt30': 'BT30', 'bt40': 'BT40', 'bt50': 'BT50', 'cat30': 'CAT30', 'cat40': 'CAT40',
  'cat50': 'CAT50', 'hsk-a40': 'HSK-A40', 'hsk-a63': 'HSK-A63', 'hsk-a100': 'HSK-A100',
  'hsk-e32': 'HSK-E32', 'r8': 'R8', 'mt2': 'MT2', 'mt3': 'MT3', 'mt4': 'MT4',
  'nt30': 'NT30', 'nt40': 'NT40', 'nt50': 'NT50',
  'capto-c4': 'Capto C4', 'capto-c5': 'Capto C5', 'capto-c6': 'Capto C6', 'other': 'Other',
};
export interface Machine {
  id: string;
  /** Display name — also the machine group key for linking to tools */
  name: string;
  type: MachineType;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  year?: number;
  controlType?: ControlType;
  axes: number;
  unit: 'mm' | 'inch';
  travelX?: number;
  travelY?: number;
  travelZ?: number;
  travelA?: number;
  travelB?: number;
  maxSpindleRpm?: number;
  spindleTaper?: SpindleTaper;
  maxFeedRate?: number;
  maxRapidRate?: number;
  atcCapacity?: number;
  maxToolDiameter?: number;
  maxToolLength?: number;
  coolantFlood?: boolean;
  coolantMist?: boolean;
  coolantThruSpindle?: boolean;
  coolantAir?: boolean;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
