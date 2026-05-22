import { useMemo, useState } from 'react';
import type { Excerpt, RepertoireList } from '../types';
import { FieldLabel } from './Atoms';

export function ListMembershipModal({
  excerpt,
  lists,
  onCancel,
  onSave,
}: {
  excerpt: Excerpt;
  lists: RepertoireList[];
  onCancel: () => void;
  onSave: (listIds: string[], newListName: string) => void;
}) {
  const initialListIds = useMemo(
    () => lists.filter((list) => list.excerptIds.includes(excerpt.id)).map((list) => list.id),
    [excerpt.id, lists],
  );
  const [selectedIds, setSelectedIds] = useState(initialListIds);
  const [newListName, setNewListName] = useState('');
  const [error, setError] = useState('');

  const toggleList = (id: string, checked: boolean) => {
    setSelectedIds((current) => (checked ? [...new Set([...current, id])] : current.filter((listId) => listId !== id)));
  };

  const save = () => {
    const cleanName = newListName.trim();
    const duplicate = cleanName && lists.some((list) => list.name.toLowerCase() === cleanName.toLowerCase());
    if (duplicate) {
      setError('A list with that name already exists.');
      return;
    }
    onSave(selectedIds, cleanName);
  };

  return (
    <div className="modal-backdrop">
      <div className="list-form-modal" role="dialog" aria-modal="true" aria-labelledby="list-membership-title">
        <div className="grabber" />
        <p className="eyebrow">Lists</p>
        <h2 id="list-membership-title">{excerpt.title}</h2>

        {lists.length ? (
          <div className="list-members modal-list-members">
            {lists.map((list) => (
              <label key={list.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(list.id)}
                  onChange={(event) => toggleList(list.id, event.target.checked)}
                />
                <span>{list.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="quiet-empty">No lists yet.</p>
        )}

        <div className="form-block">
          <FieldLabel>New list</FieldLabel>
          <input value={newListName} onChange={(event) => setNewListName(event.target.value)} />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button className="text-button" type="button" onClick={onCancel}>Cancel</button>
          <button className="pill-button" type="button" onClick={save}>Save lists</button>
        </div>
      </div>
    </div>
  );
}
