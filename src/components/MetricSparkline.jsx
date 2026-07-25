import './MetricSparkline.css';

const WIDTH = 64;
const HEIGHT = 20;
const PADDING_Y = 3;

// Tiny inline trend line for a stat tile — muted line for the whole
// series, with only the CURRENT (last) point picked out in the metric's
// own accent color, so it reads as "here's where we've been, here's where
// we are now" without needing an axis or legend (a single series needs
// neither — the card's own label already says what's plotted).
function MetricSparkline({ values }) {
  if (!values || values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * WIDTH;
    const y = HEIGHT - PADDING_Y - ((value - min) / range) * (HEIGHT - PADDING_Y * 2);
    return [x, y];
  });

  const path = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg className="metric-sparkline" width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
      <path d={path} className="metric-sparkline__line" fill="none" />
      {/* Keyed on point count so the pop-in animation replays each time a
          new month lands, cueing the user that time has moved forward. */}
      <circle key={values.length} cx={lastX} cy={lastY} r="3" className="metric-sparkline__dot" />
    </svg>
  );
}

export default MetricSparkline;
