import { useEffect, useMemo, useState } from 'react';
import CurrencySelect from './components/CurrencySelect';
import Amount from './components/Amount';
import SwapButton from './components/SwapButton';
import RateChart from './components/RateChart';
import { getCurrencies, convertOnce, getTimeseries, type Currency } from './lib/api';
import { useDebounced } from './hooks/useDebounced';

export default function App() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingCur, setLoadingCur] = useState(true);
  const [errCur, setErrCur] = useState<string | null>(null);

  const [fromCode, setFromCode] = useState('USD');
  const [toCode, setToCode] = useState('EUR');
  const [amountRaw, setAmountRaw] = useState('1');

  const amount = useMemo(() => Number(amountRaw) || 0, [amountRaw]);
  const debouncedAmount = useDebounced(amount, 300);

  const [converted, setConverted] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [loadingConv, setLoadingConv] = useState(false);
  const [errConv, setErrConv] = useState<string | null>(null);

  // chart state
  const [rangeDays, setRangeDays] = useState(30); // 7, 30, 90
  const [series, setSeries] = useState<{ date: string; rate: number }[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [errSeries, setErrSeries] = useState<string | null>(null);

  // Load currencies
  useEffect(() => {
    (async () => {
      try {
        setLoadingCur(true);
        setErrCur(null);
        const items = await getCurrencies('fiat');
        setCurrencies(items);
      } catch (e: any) {
        setErrCur(e?.message || 'Failed to load currencies.');
      } finally {
        setLoadingCur(false);
      }
    })();
  }, []);

  // Convert on changes (debounced amount)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!debouncedAmount || debouncedAmount < 0 || !fromCode || !toCode) {
        setConverted(null);
        setRate(null);
        return;
      }
      try {
        setLoadingConv(true);
        setErrConv(null);
        const res = await convertOnce({ from: fromCode, to: toCode, amount: debouncedAmount });
        if (!cancelled) {
          setConverted(res.result);
          setRate(res.rate ?? (debouncedAmount ? res.result / debouncedAmount : null));
        }
      } catch (e: any) {
        if (!cancelled) {
          setErrConv(e?.message || 'Conversion failed.');
          setConverted(null);
          setRate(null);
        }
      } finally {
        if (!cancelled) setLoadingConv(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromCode, toCode, debouncedAmount]);

  // Load historical for the chart
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingSeries(true);
        setErrSeries(null);
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - (rangeDays - 1));
        const toISO = (d: Date) => d.toISOString().slice(0, 10);
        const pts = await getTimeseries({
          from: fromCode,
          to: toCode,
          start: toISO(start),
          end: toISO(end),
        });
        if (!cancelled) setSeries(pts);
      } catch (e: any) {
        if (!cancelled) setErrSeries(e?.message || 'Failed to load historical data.');
      } finally {
        if (!cancelled) setLoadingSeries(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromCode, toCode, rangeDays]);

  const apiKeyMissing = !import.meta.env.VITE_CURRENCYBEACON_API_KEY;

  return (
    <div className="mx-auto mt-10 max-w-[720px] rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-semibold">Currency Converter</h1>

      {apiKeyMissing && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <strong>API key missing.</strong> Add <code>VITE_CURRENCYBEACON_API_KEY</code> to
          <code>.env</code> to enable live conversion and historical data.
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <div className="grid gap-3">
          <CurrencySelect
            label="From"
            value={fromCode}
            onChange={setFromCode}
            options={currencies}
            disabled={loadingCur}
          />
          <Amount
            label="Amount"
            value={amountRaw}
            onChange={setAmountRaw}
          />
        </div>

        <SwapButton
          onClick={() => {
            setFromCode(toCode);
            setToCode(fromCode);
          }}
        />

        <div className="grid gap-3">
          <CurrencySelect
            label="To"
            value={toCode}
            onChange={setToCode}
            options={currencies}
            disabled={loadingCur}
          />
          <Amount
            label="Converted"
            value={converted !== null ? converted.toFixed(4) : ''}
            readOnly
          />
        </div>
      </div>

      {(errCur || errConv) && (
        <p className="mt-4 text-sm text-red-700">{errCur || errConv}</p>
      )}

      {rate && (
        <p className="mt-4 text-sm text-gray-600">
          1 {fromCode} ≈ {rate.toFixed(6)} {toCode} &nbsp;•&nbsp; 1 {toCode} ≈{' '}
          {(1 / rate).toFixed(6)} {fromCode}
        </p>
      )}

      <div className="mt-3 flex gap-1.5">
        {[7, 30, 90].map((n) => (
          <button
            key={n}
            onClick={() => setRangeDays(n)}
            className={[
              'h-8 rounded-md border px-2.5 text-xs',
              n === rangeDays
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
            ].join(' ')}
          >
            {n === 7 ? '7D' : n === 30 ? '1M' : '3M'}
          </button>
        ))}
      </div>

      <RateChart
        data={series}
        from={fromCode}
        to={toCode}
        loading={loadingSeries}
        error={errSeries}
      />
    </div>
  );
}