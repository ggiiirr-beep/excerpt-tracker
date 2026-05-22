import { useEffect, useRef, useState } from 'react';
import type { Excerpt } from '../types';
import { formatShortDate, relativePracticeDate } from '../lib/dates';
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
  const cardRef = useRef<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const recentPracticeDetails = excerpt.practiceHistory
    .filter((entry) => entry.note.trim() || entry.recording)
    .slice(0, 3);
  const hasExpandedContent = Boolean(excerpt.notes.trim()) || recentPracticeDetails.length > 0;

  const toggleExpanded = () => {
    setExpanded((current) => !current);
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;

    const closeMenuFromOutsideClick = (event: PointerEvent) => {
      if (cardRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeMenuFromOutsideClick);
    return () => document.removeEventListener('pointerdown', closeMenuFromOutsideClick);
  }, [menuOpen]);

  return (
    <article
      ref={cardRef}
      className={`excerpt-card${expanded ? ' expanded' : ''}`}
      aria-expanded={expanded}
      tabIndex={0}
      onClick={toggleExpanded}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleExpanded();
        }
      }}
    >
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
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((current) => !current);
          }}
        >
          ...
        </button>
        {menuOpen && (
          <div className="card-menu" onClick={(event) => event.stopPropagation()}>
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
        onClick={(event) => {
          event.stopPropagation();
          onPractice();
        }}
      >
        Practice
      </button>
      {expanded && hasExpandedContent && (
        <div className="card-expanded">
          {excerpt.notes.trim() && (
            <div className="card-expanded-block">
              <span className="card-expanded-label">Excerpt notes</span>
              <p>{excerpt.notes}</p>
            </div>
          )}
          {recentPracticeDetails.map((entry) => (
            <div className="card-expanded-block" key={entry.id}>
              <span className="card-expanded-label">{formatShortDate(entry.date)}</span>
              {entry.note.trim() && <p>{entry.note}</p>}
              {entry.recording && (
                <audio
                  controls
                  src={entry.recording.dataUrl}
                  onClick={(event) => event.stopPropagation()}
                >
                  <a href={entry.recording.dataUrl}>Open recording</a>
                </audio>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
