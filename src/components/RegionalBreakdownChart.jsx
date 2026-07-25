import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './RegionalBreakdownChart.css';

const MAX_BARS = 6;
const BAR_HEIGHT = 22;

function RegionalBreakdownChart({ data, networkAverage }) {
  const topData = data.slice(0, MAX_BARS);
  const chartHeight = topData.length * BAR_HEIGHT;

  return (
    <div className="regional-chart">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={topData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <XAxis type="number" domain={[0, 'dataMax']} hide />
          <YAxis
            type="category"
            dataKey="ville"
            width={78}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={{
              background: 'var(--puniq-navy-2)',
              border: '1px solid var(--card-border)',
              borderRadius: 8,
            }}
            labelStyle={{ color: 'var(--ice)' }}
            formatter={(value, _name, item) => [
              `${Math.round(value)} (${item.payload.storeCount} magasin${item.payload.storeCount > 1 ? 's' : ''})`,
              'Score de santé',
            ]}
          />
          <Bar dataKey="avgHealthScore" radius={[3, 3, 3, 3]} barSize={10}>
            {topData.map((entry) => (
              <Cell
                key={entry.ville}
                fill={entry.avgHealthScore >= networkAverage ? 'var(--status-good)' : 'var(--status-warn)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RegionalBreakdownChart;
