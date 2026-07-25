import './VisionTeaser.css';

// `body` accepts either prose (string/fragment) or an array of short bullet
// strings — the latter renders as a scannable list instead of a paragraph,
// while staying inside the same dashed-border/"Bientôt" treatment.
function VisionTeaser({ title, body, bullets, caption }) {
  return (
    <div className="vision-teaser">
      <span className="vision-teaser__badge">Bientôt</span>
      <h4 className="vision-teaser__title">{title}</h4>
      {bullets ? (
        <ul className="vision-teaser__bullets">
          {bullets.map((bullet) => (
            <li key={bullet} className="vision-teaser__bullet">
              {bullet}
            </li>
          ))}
        </ul>
      ) : (
        <div className="vision-teaser__body">{body}</div>
      )}
      <p className="vision-teaser__caption">{caption}</p>
    </div>
  );
}

export default VisionTeaser;
