/**
 * MachineGroupInput — multi-select chip input for machine groups.
 *
 * Renders selected groups as removable chips and provides an autocomplete
 * text field to add groups from existing ones or create new ones.
 * Press Enter or comma to add the typed value; Backspace on empty input removes the last chip.
 */

import { useState, useRef } from 'react';
import { X } from 'lucide-react';

interface MachineGroupInputProps {
  values:      string[];
  allGroups:   string[];
  onChange:    (v: string[]) => void;
  placeholder?: string;
}

export default function MachineGroupInput({
  values, allGroups, onChange, placeholder = 'Add machine…',
}: MachineGroupInputProps) {
  const [inputVal, setInputVal] = useState('');
  const [open,     setOpen]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed  = inputVal.trim();
  const filtered = allGroups.filter(
    (g) => !values.includes(g) && g.toLowerCase().includes(inputVal.toLowerCase()),
  );
  const showCreate = trimmed !== '' && !values.includes(trimmed) &&
    !allGroups.some((g) => g.toLowerCase() === trimmed.toLowerCase());

  function addGroup(group: string) {
    const g = group.trim();
    if (!g || values.includes(g)) return;
    onChange([...values, g]);
    setInputVal('');
    inputRef.current?.focus();
  }

  function removeGroup(group: string) {
    onChange(values.filter((g) => g !== group));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && trimmed) {
      e.preventDefault();
      addGroup(trimmed);
    } else if (e.key === 'Backspace' && inputVal === '' && values.length > 0) {
      removeGroup(values[values.length - 1]);
    }
  }

  return (
    <div className="relative">
      {/* Chip container + input */}
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-[34px] px-2.5 py-1.5 bg-slate-700 border border-slate-600 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((g) => (
          <span
            key={g}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-600/30 text-blue-200 border border-blue-500/40"
          >
            {g}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeGroup(g); }}
              title={`Remove ${g}`}
              className="text-blue-300 hover:text-white"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          placeholder={values.length === 0 ? placeholder : ''}
          onChange={(e) => { setInputVal(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-[80px] bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
        />
      </div>

      {/* Dropdown */}
      {open && (showCreate || filtered.length > 0) && (
        <div className="absolute z-20 top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {showCreate && (
            <button
              type="button"
              onMouseDown={() => addGroup(trimmed)}
              className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-slate-700 border-b border-slate-700/60"
            >
              Create &ldquo;{trimmed}&rdquo;
            </button>
          )}
          {filtered.map((g) => (
            <button
              key={g}
              type="button"
              onMouseDown={() => addGroup(g)}
              className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
