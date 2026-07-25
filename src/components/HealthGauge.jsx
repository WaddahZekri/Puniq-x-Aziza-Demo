import './HealthGauge.css';

const DEFAULT_SIZE = 76;

function HealthGauge({ score, size = DEFAULT_SIZE }) {
  const strokeWidth = Math.max(4, Math.round(size * 0.105));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const offset = circumference * (1 - pct);
  const color = score > 80 ? 'var(--status-good)' : score >= 60 ? 'var(--status-warn)' : 'var(--status-danger)';
  const fontSize = (size / DEFAULT_SIZE) * 1.25;

  return (
    <div className="health-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--card-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="health-gauge__value" style={{ fontSize: `${fontSize}rem` }}>
        {Math.round(score)}
      </span>
    </div>
  );
}

export default HealthGauge;
