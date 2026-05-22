import { useState } from 'react';
import type { Excerpt } from '../types';
import { relativePracticeDate } from '../lib/dates';
import { Dot, Stars } from './Atoms';

export function ExcerptCard({
  excerpt,
  onPractice,
  onEdit,
  onAddToList,
  onToggleFocus,
  onDelete,
}: {
  excerpt: Excerpt;
  onPractice: () => void;
  onEdit: () => void;
  onAddToList: () => void;
  onToggleFocus: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article className="excerpt-card">
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
      <div className="card-actions">
        <button
          className="card-menu-button"
          type="button"
          aria-label={`Actions for ${excerpt.title}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          ...
        </button>
        {menuOpen && (
          <div className="card-menu">
            <button type="button" onClick={() => {
              setMenuOpen(false);
              onEdit();
            }}>
              Edit
            </button>
            <button type="button" onClick={() => {
              setMenuOpen(false);
              onAddToList();
            }}>
              Add to list
            </button>
            <button type="button" onClick={() => {
              setMenuOpen(false);
              onToggleFocus();
            }}>
              {excerpt.isFocus ? 'Remove from focus' : 'Move to focus'}
            </button>
            <button className="danger-menu-item" type="button" onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}>
              Delete
            </button>
          </div>
        )}
      </div>
      <button
        className="pill-button"
        type="button"
        onClick={onPractice}
      >
        Practice
      </button>
    </article>
  );
}
