import { useEffect, useMemo, useState } from 'react';
import type { Excerpt, RepertoireList } from '../types';
import { FieldLabel } from './Atoms';

export function ListsView({
  excerpts,
  lists,
  selectedListId,
  onBack,
  onCreateList,
  onChangeLists,
}: {
  excerpts: Excerpt[];
  lists: RepertoireList[];
  selectedListId: string;
  onBack: () => void;
  onCreateList: (name: string) => void;
  onChangeLists: (lists: RepertoireList[]) => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const listNames = useMemo(() => lists.map((list) => list.name.toLowerCase()), [lists]);
  const filteredExcerpts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return excerpts;
    return excerpts.filter((excerpt) => excerpt.title.toLowerCase().includes(query));
  }, [excerpts, search]);

  const createList = () => {
    const name = newName.trim();
    if (!name) {
      setError('Name the list first.');
      return;
    }
    if (listNames.includes(name.toLowerCase())) {
      setError('A list with that name already exists.');
      return;
    }
    onCreateList(name);
    setNewName('');
    setError('');
    setIsCreating(false);
  };

  const updateList = (id: string, patch: Partial<RepertoireList>) => {
    onChangeLists(lists.map((list) => (list.id === id ? { ...list, ...patch } : list)));
  };

  const renameList = (id: string, name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return 'List names cannot be blank.';
    const duplicate = lists.some((list) => list.id !== id && list.name.toLowerCase() === cleanName.toLowerCase());
    if (duplicate) return 'A list with that name already exists.';
    updateList(id, { name: cleanName });
    return '';
  };

  return (
    <section className="lists-view">
      <button className="back-link" type="button" onClick={onBack}>‹ Excerpts</button>
      <div className="view-heading">
        <div>
          <p className="eyebrow">Auditions and repertoire</p>
          <h1>Lists</h1>
        </div>
        <button className="pill-button" type="button" onClick={() => setIsCreating(true)}>New list</button>
      </div>
      {excerpts.length > 8 && (
        <div className="list-search">
          <FieldLabel>Find excerpts</FieldLabel>
          <input value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      )}
      {lists.length ? (
        lists.map((list) => (
          <ListCard
            key={list.id}
            list={list}
            excerpts={filteredExcerpts}
            isSelected={list.id === selectedListId}
            onRename={renameList}
            onUpdate={updateList}
            onDelete={() => {
              const confirmed = window.confirm(`Delete "${list.name}"? The excerpts will stay in your library.`);
              if (!confirmed) return;
              onChangeLists(lists.filter((item) => item.id !== list.id));
            }}
          />
        ))
      ) : (
        <p className="quiet-empty">No lists yet. Create one, then check off excerpts like a playlist.</p>
      )}

      {isCreating && (
        <div className="modal-backdrop">
          <div className="list-form-modal" role="dialog" aria-modal="true" aria-labelledby="new-list-title">
            <div className="grabber" />
            <p className="eyebrow">New list</p>
            <h2 id="new-list-title">Create a list</h2>
            <div className="form-block">
              <FieldLabel>Name</FieldLabel>
              <input value={newName} onChange={(event) => setNewName(event.target.value)} autoFocus />
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="text-button" type="button" onClick={() => {
                setIsCreating(false);
                setNewName('');
                setError('');
              }}>
                Cancel
              </button>
              <button className="pill-button" type="button" onClick={createList}>Create list</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ListCard({
  list,
  excerpts,
  isSelected,
  onRename,
  onUpdate,
  onDelete,
}: {
  list: RepertoireList;
  excerpts: Excerpt[];
  isSelected: boolean;
  onRename: (id: string, name: string) => string;
  onUpdate: (id: string, patch: Partial<RepertoireList>) => void;
  onDelete: () => void;
}) {
  const [nameDraft, setNameDraft] = useState(list.name);
  const [excerptIdsDraft, setExcerptIdsDraft] = useState(list.excerptIds);
  const [isEditing, setIsEditing] = useState(isSelected);
  const [error, setError] = useState('');

  useEffect(() => {
    setNameDraft(list.name);
    setExcerptIdsDraft(list.excerptIds);
    setError('');
  }, [list.name, list.excerptIds]);

  const saveList = () => {
    const message = onRename(list.id, nameDraft);
    if (message) {
      setError(message);
      setNameDraft(list.name);
      return;
    }
    onUpdate(list.id, { excerptIds: excerptIdsDraft });
    setIsEditing(false);
  };

  const toggleExcerpt = (id: string, checked: boolean) => {
    setExcerptIdsDraft((current) => (
      checked ? [...new Set([...current, id])] : current.filter((excerptId) => excerptId !== id)
    ));
  };

  return (
    <article className={isSelected ? 'list-card active-list-card' : 'list-card'}>
      {isEditing ? (
        <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} />
      ) : (
        <div className="list-card-summary">
          <h2>{list.name}</h2>
          <span>{list.excerptIds.length} {list.excerptIds.length === 1 ? 'excerpt' : 'excerpts'}</span>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      {isEditing && (
        excerpts.length ? (
          <div className="list-members">
            {excerpts.map((excerpt) => {
              const checked = excerptIdsDraft.includes(excerpt.id);
              return (
                <label key={excerpt.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleExcerpt(excerpt.id, event.target.checked)}
                  />
                  <span>{excerpt.title}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="quiet-empty">No matching excerpts.</p>
        )
      )}
      <div className="list-card-actions">
        {isEditing ? (
          <button className="pill-button" type="button" onClick={saveList}>Save list</button>
        ) : (
          <button className="small-button" type="button" onClick={() => setIsEditing(true)}>Edit</button>
        )}
        <button className="text-button align-left" type="button" onClick={onDelete}>
          Delete list
        </button>
      </div>
    </article>
  );
}
