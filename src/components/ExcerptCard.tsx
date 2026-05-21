import type { Excerpt } from '../types';
import { relativePracticeDate } from '../lib/dates';
import { Dot, Stars } from './Atoms';

export function ExcerptCard({
  excerpt,
  onOpen,
  onPractice,
}: {
  excerpt: Excerpt;
  onOpen: () => void;
  onPractice: () => void;
}) {
  return (
    <article className="excerpt-card" onClick={onOpen}>
      <div className="card-main">
        <div className="title-row">
          {excerpt.isFocus && <Dot />}
          <h3>{excerpt.title}</h3>
        </div>
        <div className="card-meta">
          <Stars rating={excerpt.confidenceRating} size={12} />
          <span>{excerpt.practiceCount} {excerpt.practiceCount === 1 ? 'session' : 'sessions'}</span>
          <span>{relativePracticeDate(excerpt.lastPracticedDate)}</span>
        </div>
      </div>
      <button
        className="pill-button"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onPractice();
        }}
      >
        Practice
      </button>
    </article>
  );
}
