import { useState } from 'react';
import type { Excerpt, ExcerptConfidenceRating, ResourceLink } from '../types';
import { FieldLabel, makeId, StarPicker, Stars } from './Atoms';

type ExcerptFormValue = Pick<Excerpt, 'title' | 'confidenceRating' | 'isFocus' | 'notes' | 'tags' | 'resources'>;

function emptyResource(): ResourceLink {
  return { id: makeId('resource'), label: '', url: '' };
}

export function ExcerptFormModal({
  mode,
  initialValue,
  onCancel,
  onSave,
}: {
  mode: 'create' | 'edit';
  initialValue?: Excerpt;
  onCancel: () => void;
  onSave: (value: ExcerptFormValue) => void;
}) {
  const [title, setTitle] = useState(initialValue?.title ?? '');
  const [confidenceRating, setConfidenceRating] = useState<ExcerptConfidenceRating>(initialValue?.confidenceRating ?? 0);
  const [isFocus, setIsFocus] = useState(initialValue?.isFocus ?? false);
  const [notes, setNotes] = useState(initialValue?.notes ?? '');
  const [tags, setTags] = useState(initialValue?.tags.join(', ') ?? '');
  const [resources, setResources] = useState<ResourceLink[]>(initialValue?.resources.length ? initialValue.resources : []);
  const [error, setError] = useState('');
  const isDirty = title !== (initialValue?.title ?? '')
    || confidenceRating !== (initialValue?.confidenceRating ?? 0)
    || isFocus !== (initialValue?.isFocus ?? false)
    || notes !== (initialValue?.notes ?? '')
    || tags !== (initialValue?.tags.join(', ') ?? '')
    || JSON.stringify(resources) !== JSON.stringify(initialValue?.resources.length ? initialValue.resources : []);

  const updateResource = (id: string, patch: Partial<ResourceLink>) => {
    setResources((current) => current.map((resource) => (resource.id === id ? { ...resource, ...patch } : resource)));
  };

  const save = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Give the excerpt a title first.');
      return;
    }

    onSave({
      title: cleanTitle,
      confidenceRating,
      isFocus,
      notes,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      resources: resources
        .map((resource) => ({
          ...resource,
          label: resource.label.trim(),
          url: resource.url.trim(),
        }))
        .filter((resource) => resource.label || resource.url),
    });
  };

  const cancel = () => {
    if (isDirty && !window.confirm('Discard these changes?')) return;
    onCancel();
  };

  return (
    <div className="modal-backdrop">
      <div className="excerpt-form-modal" role="dialog" aria-modal="true" aria-labelledby="excerpt-form-title">
        <div className="grabber" />
        <header>
          <p className="eyebrow">{mode === 'create' ? 'New excerpt' : 'Edit excerpt'}</p>
          <h2 id="excerpt-form-title">{mode === 'create' ? 'Add an excerpt' : 'Edit information'}</h2>
        </header>

        <div className="form-block">
          <FieldLabel>Title</FieldLabel>
          <input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        </div>

        <div className="form-block">
          <FieldLabel>Confidence</FieldLabel>
          <div className="rating-choice-row">
            <button className={confidenceRating === 0 ? 'small-button active-rating' : 'small-button'} type="button" onClick={() => setConfidenceRating(0)}>
              No stars
            </button>
            <StarPicker value={confidenceRating} onChange={setConfidenceRating} size={24} />
            {confidenceRating === 0 && <Stars rating={0} size={14} />}
          </div>
        </div>

        <label className="check-row form-check-row">
          <input type="checkbox" checked={isFocus} onChange={(event) => setIsFocus(event.target.checked)} />
          <span>Keep this in focus</span>
        </label>

        <div className="form-block">
          <FieldLabel>Notes</FieldLabel>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>

        <div className="form-block">
          <FieldLabel>Tags</FieldLabel>
          <input value={tags} onChange={(event) => setTags(event.target.value)} />
        </div>

        <div className="form-block">
          <div className="block-heading">
            <FieldLabel>References</FieldLabel>
            <button className="text-button" type="button" onClick={() => setResources((current) => [...current, emptyResource()])}>
              + add link
            </button>
          </div>
          {resources.length ? (
            <div className="resources-list">
              {resources.map((resource) => (
                <div className="resource-row" key={resource.id}>
                  <input value={resource.label} onChange={(event) => updateResource(resource.id, { label: event.target.value })} aria-label="Resource label" />
                  <input value={resource.url} onChange={(event) => updateResource(resource.id, { url: event.target.value })} aria-label="Resource URL" />
                  <button type="button" onClick={() => setResources((current) => current.filter((item) => item.id !== resource.id))}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="plain-empty">No links yet.</p>
          )}
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button className="text-button" type="button" onClick={cancel}>Cancel</button>
          <button className="pill-button" type="button" onClick={save}>{mode === 'create' ? 'Create excerpt' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}
