type Props = { onClick: () => void };

export default function SwapButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Swap currencies"
      title="Swap currencies"
      className="self-end h-10 w-10 rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95"
    >
      ⇅
    </button>
  );
}