export type HolderType =
  | 'CAT40' | 'CAT50' | 'BT30' | 'BT40'
  | 'HSK-A63' | 'HSK-A100'
  | 'R8' | 'ER-collet' | 'side-lock' | 'hydraulic' | 'shrink-fit' | 'Morse'
  | 'other';

export const HOLDER_TYPES: HolderType[] = [
  'CAT40', 'CAT50', 'BT30', 'BT40',
  'HSK-A63', 'HSK-A100',
  'R8', 'ER-collet', 'side-lock', 'hydraulic', 'shrink-fit', 'Morse',
  'other',
];

/** A tool holder / collet chuck stored in the holder library. */
export interface ToolHolder {
  id:                  string;
  name:                string;
  type:                HolderType;
  /** Gauge length from spindle face to tool datum (mm) */
  gaugeLength:         number;
  /** Maximum tool shank diameter accepted (mm) */
  colletDiameterMax?:  number;
  /** Minimum tool shank diameter accepted (mm) */
  colletDiameterMin?:  number;
  notes?:              string;
  createdAt:           number;
  updatedAt:           number;
}
