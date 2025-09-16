type Props = {
  label: string;
  value: string | number;
  onChange?: (v: string) => void;  // omit when readOnly
  readOnly?: boolean;
  min?: number;
  step?: number | 'any';
  disabled?: boolean;
};

export default function Amount({
  label,
  value,
  onChange,
  readOnly = false,
  min = 0,
  step = 'any',
  disabled = false,
}: Props) {
  const inputClass =
    'h-10 rounded-md border px-3 text-sm outline-none transition ' +
    (readOnly
      ? 'border-gray-300 bg-gray-50'
      : 'border-gray-300 bg-white focus:border-gray-400') +
    (disabled ? ' opacity-50' : '');

  // use number input when editable; text when readOnly
  const type = readOnly ? 'text' : 'number';

  return (
    <label className="grid gap-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        type={type}
        inputMode="decimal"
        value={String(value)}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        aria-readonly={readOnly}
        min={readOnly ? undefined : min}
        step={readOnly ? undefined : step}
        disabled={disabled}
        className={inputClass}
      />
    </label>
  );
}