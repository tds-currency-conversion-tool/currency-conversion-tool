import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

type Point = { date: string; rate: number };

export default function RateChart({
  data,
  from,
  to,
  loading,
  error,
}: {
  data: Point[];
  from: string;
  to: string;
  loading?: boolean;
  error?: string | null;
}) {
  const title = `1 ${from} → ${to} (last ${data.length} days)`;

  return (
    <div style={{ paddingTop: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{title}</div>
      <div style={{ width: '100%', height: 260, border: '1px solid #e5e7eb', borderRadius: 8 }}>
        {error ? (
          <div style={{ padding: 16, fontSize: 14, color: '#b91c1c' }}>
            {error}
          </div>
        ) : loading ? (
          <div style={{ padding: 16, fontSize: 14, opacity: 0.7 }}>Loading chart…</div>
        ) : data.length === 0 ? (
          <div style={{ padding: 16, fontSize: 14, opacity: 0.7 }}>
            No historical data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(d) =>
                  new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                }
                minTickGap={28}
              />
              <YAxis
                tickFormatter={(v) =>
                  Number(v).toLocaleString(undefined, { maximumFractionDigits: 6 })
                }
                width={70}
              />
              <Tooltip
                formatter={(v: any) =>
                  Number(v).toLocaleString(undefined, {
                    maximumFractionDigits: 8,
                  })
                }
                labelFormatter={(d) =>
                  new Date(d).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                }
              />
              <Line type="monotone" dataKey="rate" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}