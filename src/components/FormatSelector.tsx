import { ChevronDown } from 'lucide-react';
import type { FormatInfo } from '../types/converter';

interface FormatSelectorProps {
  label: string;
  value: string;
  formats: FormatInfo[];
  onChange: (id: string) => void;
  disabled?: boolean;
}

export default function FormatSelector({
  label,
  value,
  formats,
  onChange,
  disabled = false,
}: FormatSelectorProps) {
  const selected = formats.find((f) => f.id === value);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={label}
          className={[
            'w-full appearance-none pl-3 pr-8 py-2.5 rounded-lg text-sm font-medium',
            'bg-slate-700 border border-slate-600 text-slate-100',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'transition-colors',
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-slate-400',
          ].join(' ')}
        >
          {formats.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>
      {selected && (
        <p className="text-xs text-slate-500">{selected.description}</p>
      )}
    </div>
  );
}
