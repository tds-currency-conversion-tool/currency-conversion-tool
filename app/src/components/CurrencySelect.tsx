import { useMemo } from 'react';
import type { Currency } from '../lib/api';

type Props = {
  label: string;
  value: string;
  onChange: (code: string) => void;
  options: Currency[];
  disabled?: boolean;
};

export default function CurrencySelect({ label, value, onChange, options, disabled }: Props) {
  const sorted = useMemo(
    () => [...options].sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code)),
    [options],
  );
  const getLabel = (opt: Currency) =>
    opt.name && opt.name.toUpperCase() !== opt.code ? `${opt.name} (${opt.code})` : opt.code;

  return (
    <label className="grid gap-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-gray-400 disabled:opacity-50"
      >
        {sorted.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {getLabel(opt)}
          </option>
        ))}
      </select>
    </label>
  );
}