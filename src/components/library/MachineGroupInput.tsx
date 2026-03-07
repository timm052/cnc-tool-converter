import { useState, useEffect } from 'react';

interface MachineGroupInputProps {
  value:     string | undefined;
  allGroups: string[];
  onChange:  (v: string | undefined) => void;
  placeholder?: string;
}

export default function MachineGroupInput({
  value, allGroups, onChange, placeholder = 'e.g. VF-2',
}: MachineGroupInputProps) {
  const [inputVal, setInputVal] = useState(value ?? '');
  const [open, setOpen]         = useState(false);

  useEffect(() => { setInputVal(value ?? ''); }, [value]);

  const filtered = allGroups.filter(
    (g) => g.toLowerCase().includes(inputVal.toLowerCase()),
  );

  function commit(val: string) {
    const trimmed = val.trim();
    onChange(trimmed || undefined);
    setInputVal(trimmed);
    setOpen(false);
  }

  const showCreate = inputVal.trim() !== '' &&
    !allGroups.some((g) => g.toLowerCase() === inputVal.trim().toLowerCase());

  return (
    <div className="relative">
      <input
        type="text"
        value={inputVal}
        placeholder={placeholder}
        onChange={(e) => {
          setInputVal(e.target.value);
          onChange(e.target.value.trim() || undefined);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && (showCreate || filtered.length > 0) && (
        <div className="absolute z-10 top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {showCreate && (
            <button
              onMouseDown={() => commit(inputVal)}
              className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-slate-700 border-b border-slate-700/60"
            >
              Create "{inputVal.trim()}"
            </button>
          )}
          {filtered.map((g) => (
            <button
              key={g}
              onMouseDown={() => commit(g)}
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
