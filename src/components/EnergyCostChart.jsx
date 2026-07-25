import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './EnergyCostChart.css';

function EnergyCostChart({ data, isConnected }) {
  const activationPoint = data.find((point) => point.isActivation);
  const adjustmentPoint = data.find((point) => point.isAdjustment);

  return (
    <div className="energy-chart">
      <div className="energy-chart__header">
        <p className="energy-chart__title">Coût énergétique quotidien — 14 derniers jours</p>
        {!isConnected && <span className="energy-chart__baseline-tag">Sans PUNIQ</span>}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--card-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
            width={48}
            domain={[(min) => Math.floor(min * 0.9), (max) => Math.ceil(max * 1.1)]}
          />
          <Tooltip
            contentStyle={{ background: 'var(--puniq-navy-2)', border: '1px solid var(--card-border)', borderRadius: 8 }}
            labelStyle={{ color: 'var(--ice)' }}
            itemStyle={{ color: 'var(--ice)' }}
            formatter={(value) => [`${value} TND`, 'Coût']}
          />
          {activationPoint && (
            <ReferenceLine
              x={activationPoint.label}
              stroke="var(--monoprix-red)"
              strokeDasharray="4 4"
              label={{ value: 'PUNIQ activé', position: 'insideTopLeft', fill: 'var(--monoprix-red)', fontSize: 11 }}
            />
          )}
          {adjustmentPoint && (
            <ReferenceLine
              x={adjustmentPoint.label}
              stroke="var(--status-good)"
              strokeDasharray="2 2"
              label={{
                value: 'Ajustement appliqué',
                position: 'insideTopRight',
                fill: 'var(--status-good)',
                fontSize: 11,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="cost"
            stroke={isConnected ? 'var(--puniq-blue-light)' : 'var(--text-muted)'}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default EnergyCostChart;
