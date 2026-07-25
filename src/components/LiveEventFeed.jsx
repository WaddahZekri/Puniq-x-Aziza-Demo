import { useEffect, useRef } from 'react';
import './LiveEventFeed.css';

function LiveEventFeed({ items }) {
  const viewportRef = useRef(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [items]);

  return (
    <div className="live-feed">
      <p className="live-feed__label">Flux d'activité</p>
      <div className="live-feed__viewport" ref={viewportRef}>
        <ul className="live-feed__list">
          {items.map((item) => (
            <li key={item.id} className="live-feed__item">
              <span className="live-feed__store">{item.label}</span>
              <span className="live-feed__message">{item.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default LiveEventFeed;
