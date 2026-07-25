import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './TOUCostChart.css';

// Green/amber/red mirrors the existing status color language (cheap = good,
// expensive = danger) rather than inventing a new palette for this chart.
const BAND_COLORS = {
  creuses: 'var(--status-good)',
  pleines: 'var(--status-warn)',
  pointe: 'var(--status-danger)',
};

function TOUCostChart({ data }) {
  return (
    <div className="tou-chart">
      <p className="tou-chart__title">Coût énergétique par tranche horaire — journée type</p>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
          <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} width={40} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={{
              background: 'var(--puniq-navy-2)',
              border: '1px solid var(--card-border)',
              borderRadius: 8,
            }}
            labelStyle={{ color: 'var(--ice)' }}
            formatter={(value, _name, item) => [
              `${value} TND (${item.payload.sharePct}% du jour)`,
              item.payload.hours,
            ]}
          />
          <Bar dataKey="costTND" radius={[4, 4, 0, 0]} barSize={40}>
            {data.map((entry) => (
              <Cell key={entry.id} fill={BAND_COLORS[entry.id]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TOUCostChart;
