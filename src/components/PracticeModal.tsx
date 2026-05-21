import { useState } from 'react';
import type { ConfidenceRating, Excerpt } from '../types';
import { confidenceLabel, StarPicker } from './Atoms';

export function PracticeModal({
  excerpt,
  onClose,
  onSave,
}: {
  excerpt: Excerpt;
  onClose: () => void;
  onSave: (rating: ConfidenceRating, note: string) => void;
}) {
  const [rating, setRating] = useState<ConfidenceRating>(excerpt.confidenceRating);
  const [note, setNote] = useState('');

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Log practice session">
      <div className="practice-modal">
        <div className="grabber" />
        <p className="eyebrow">Log a session</p>
        <h2>{excerpt.title}</h2>
        <div className="modal-stars">
          <StarPicker value={rating} onChange={setRating} size={30} />
          <p>{confidenceLabel(rating)}</p>
        </div>
        <label className="note-label">
          Practice note <span>optional</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What clicked? What's next?" />
        </label>

        <button className="primary-button" type="button" onClick={() => onSave(rating, note)}>
          Save session
        </button>
        <button className="text-button" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
