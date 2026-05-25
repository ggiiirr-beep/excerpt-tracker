import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Excerpt, RepertoireList, ResourceLink, SessionRecording } from '../types';
import { formatDate, formatShortDate, relativePracticeDate } from '../lib/dates';
import { confidenceLabel, FieldLabel, makeId, Stars } from './Atoms';

export function DetailView({
  excerpt,
  lists,
  onBack,
  onChange,
  onPractice,
  onEdit,
  onManageLists,
  onDelete,
  onDeletePracticeEntry,
  onDeletePracticeRecording,
  pendingRecording,
  onPendingRecordingChange,
}: {
  excerpt: Excerpt;
  lists: RepertoireList[];
  onBack: () => void;
  onChange: (patch: Partial<Excerpt>) => void;
  onPractice: () => void;
  onEdit: () => void;
  onManageLists: () => void;
  onDelete: () => void;
  onDeletePracticeEntry: (entryId: string) => void;
  onDeletePracticeRecording: (entryId: string) => void;
  pendingRecording: SessionRecording | null;
  onPendingRecordingChange: (recording: SessionRecording | null) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingReferences, setEditingReferences] = useState(false);
  const [resourceDrafts, setResourceDrafts] = useState<ResourceLink[]>(excerpt.resources);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'blocked'>('idle');
  const [recordingError, setRecordingError] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const listNames = useMemo(
    () => lists.filter((list) => list.excerptIds.includes(excerpt.id)).map((list) => list.name),
    [excerpt.id, lists],
  );

  useEffect(() => {
    setEditingReferences(false);
    setResourceDrafts(excerpt.resources);
  }, [excerpt.id, excerpt.resources]);

  useEffect(() => {
    if (!menuOpen) return;

    const closeMenuFromOutsideClick = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeMenuFromOutsideClick);
    return () => document.removeEventListener('pointerdown', closeMenuFromOutsideClick);
  }, [menuOpen]);

  const updateResourceDraft = (id: string, patch: Partial<ResourceLink>) => {
    setResourceDrafts((current) => current.map((resource) => (
      resource.id === id ? { ...resource, ...patch } : resource
    )));
  };

  const saveReferences = () => {
    onChange({
      resources: resourceDrafts
        .map((resource) => ({
          ...resource,
          label: resource.label.trim(),
          url: resource.url.trim(),
        }))
        .filter((resource) => resource.label || resource.url),
    });
    setEditingReferences(false);
  };

  const attachPdf = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange({
        pdfAttachment: {
          name: file.name,
          size: file.size,
          dataUrl: String(reader.result),
        },
      });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const pdfSize = excerpt.pdfAttachment
    ? `${Math.max(1, Math.round(excerpt.pdfAttachment.size / 1024))} KB`
    : '';

  const pdfObjectUrl = useMemo(() => {
    if (!excerpt.pdfAttachment) return null;
    const [metadata, base64Data] = excerpt.pdfAttachment.dataUrl.split(',');
    if (!base64Data) return excerpt.pdfAttachment.dataUrl;

    const mimeType = metadata.match(/data:(.*);base64/)?.[1] || 'application/pdf';
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  }, [excerpt.pdfAttachment]);

  useEffect(() => {
    return () => {
      if (pdfObjectUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfObjectUrl);
    };
  }, [pdfObjectUrl]);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingState('blocked');
      setRecordingError('Recording is not available in this browser.');
      return;
    }

    try {
      setRecordingError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onload = () => {
          onPendingRecordingChange({
            name: `Practice recording ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
            mimeType,
            dataUrl: String(reader.result),
          });
        };
        reader.readAsDataURL(blob);
        setRecordingState('idle');
      };

      recorder.start();
      onPendingRecordingChange(null);
      setRecordingState('recording');
    } catch {
      setRecordingState('blocked');
      setRecordingError('Microphone permission is needed to record.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  return (
    <section className="detail-view">
      <button className="back-link" type="button" onClick={onBack}>‹ Excerpts</button>
      <div className="cue-card">
        <div className="detail-card-actions" ref={menuRef}>
          <button
            className="card-menu-button"
            type="button"
            aria-label={`Actions for ${excerpt.title}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="card-menu">
              <button type="button" onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}>
                Edit information
              </button>
              <button className="danger-menu-item" type="button" onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}>
                Delete excerpt
              </button>
            </div>
          )}
        </div>
        <p className="cue-kicker">Excerpt</p>
        <h1>{excerpt.title}</h1>
        <div className="cue-stars">
          <Stars rating={excerpt.confidenceRating} size={26} />
          <p>{confidenceLabel(excerpt.confidenceRating)}</p>
        </div>

        <div className="cue-tools">
          <div className="cue-tool">
            {excerpt.pdfAttachment ? (
              <>
                <a href={pdfObjectUrl ?? excerpt.pdfAttachment.dataUrl} target="_blank" rel="noreferrer">
                  <span>PDF</span>
                  <strong>{excerpt.pdfAttachment.name}</strong>
                  <em>{pdfSize}</em>
                </a>
                <button type="button" onClick={() => fileInputRef.current?.click()}>Replace</button>
                <button type="button" onClick={() => {
                  if (!window.confirm('Remove this PDF from the excerpt?')) return;
                  onChange({ pdfAttachment: null });
                }}>
                  Remove
                </button>
              </>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                <span>PDF</span>
                Add score
              </button>
            )}
          </div>
          <div className="cue-tool">
            {recordingState === 'recording' ? (
              <button className="recording-active" type="button" onClick={stopRecording}>
                <span>REC</span>
                Stop
              </button>
            ) : pendingRecording ? (
              <>
                <audio controls src={pendingRecording.dataUrl} />
                <button type="button" onClick={startRecording}>Replace</button>
                <button type="button" onClick={() => {
                  if (!window.confirm('Remove this pending recording?')) return;
                  onPendingRecordingChange(null);
                }}>
                  Remove
                </button>
              </>
            ) : (
              <button type="button" onClick={startRecording}>
                <span>REC</span>
                Record
              </button>
            )}
          </div>
          {pendingRecording && <p className="cue-tool-note">Recording will be saved with your next logged practice session.</p>}
          {recordingError && <p className="cue-tool-error">{recordingError}</p>}
        </div>
        <input ref={fileInputRef} type="file" accept="application/pdf" hidden onChange={attachPdf} />
      </div>

      <button className="primary-button practice-wide" type="button" onClick={onPractice}>Log practice</button>

      <div className="details-panel">
        <label className="focus-check-row">
          <input type="checkbox" checked={excerpt.isFocus} onChange={(event) => onChange({ isFocus: event.target.checked })} />
          <span>In focus</span>
          <em>{excerpt.isFocus ? 'on your shortlist' : ''}</em>
        </label>

        <div className="detail-grid">
          <div className="stat"><span>Practice count</span><strong>{excerpt.practiceCount}</strong></div>
          <div className="stat"><span>Last practiced</span><strong>{relativePracticeDate(excerpt.lastPracticedDate)}</strong></div>
          <div className="stat"><span>Date added</span><strong>{formatDate(excerpt.dateAdded)}</strong></div>
          <div className="stat"><span>Lists</span><strong>{listNames.length ? listNames.join(', ') : 'None'}</strong></div>
        </div>

        <div className="form-block">
          <div className="block-heading">
            <FieldLabel>Lists</FieldLabel>
            <button className="icon-button" type="button" onClick={onManageLists} aria-label="Manage lists" title="Manage lists">+</button>
          </div>
          <div className="tag-list">
            {listNames.length ? listNames.map((name) => <span key={name}>{name}</span>) : <p className="plain-empty">not in a list</p>}
          </div>
        </div>

        <div className="form-block">
          <div className="block-heading">
            <FieldLabel>References</FieldLabel>
            <button
              className="icon-button"
              type="button"
              aria-label={editingReferences ? 'Cancel editing references' : 'Edit references'}
              title={editingReferences ? 'Cancel editing references' : 'Edit references'}
              onClick={() => {
                setResourceDrafts(excerpt.resources);
                setEditingReferences((current) => !current);
              }}
            >
              {editingReferences ? '×' : '+'}
            </button>
          </div>
          {editingReferences ? (
            <div className="resources-list inline-resources-list">
              {resourceDrafts.map((resource) => (
                <div className="resource-row" key={resource.id}>
                  <input value={resource.label} onChange={(event) => updateResourceDraft(resource.id, { label: event.target.value })} aria-label="Reference label" />
                  <input value={resource.url} onChange={(event) => updateResourceDraft(resource.id, { url: event.target.value })} aria-label="Reference URL" />
                  <button type="button" onClick={() => {
                    if (!window.confirm('Remove this reference link?')) return;
                    setResourceDrafts((current) => current.filter((item) => item.id !== resource.id));
                  }}>
                    Remove
                  </button>
                </div>
              ))}
              <div className="reference-edit-actions">
                <button className="small-button" type="button" onClick={() => setResourceDrafts((current) => [...current, { id: makeId('resource'), label: '', url: '' }])}>
                  Add link
                </button>
                <button className="pill-button" type="button" onClick={saveReferences}>Save references</button>
              </div>
            </div>
          ) : (
            <div className="reference-list">
              {excerpt.resources.length ? (
                excerpt.resources.map((resource: ResourceLink) => (
                  <a href={resource.url} target="_blank" rel="noreferrer" key={resource.id}>
                    <span>↗</span>
                    {resource.label || resource.url}
                  </a>
                ))
              ) : (
                <p className="plain-empty">nothing linked yet</p>
              )}
            </div>
          )}
        </div>

        <div className="form-block">
          <FieldLabel>Practice history</FieldLabel>
          {excerpt.practiceHistory.length ? (
            <div className="history-list">
              {[...excerpt.practiceHistory]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((entry) => (
                  <div className="history-row" key={entry.id}>
                    <time>{formatShortDate(entry.date)}</time>
                    <div>
                      <div className="history-row-heading">
                        <Stars rating={entry.rating} size={11} />
                        <button
                          className="icon-button danger-icon-button history-delete-button"
                          type="button"
                          onClick={() => onDeletePracticeEntry(entry.id)}
                          aria-label="Delete practice session"
                          title="Delete practice session"
                        >
                          🗑
                        </button>
                      </div>
                      {entry.note && <p>{entry.note}</p>}
                      {entry.recording && (
                        <div className="history-recording">
                          <span>{entry.recording.name}</span>
                          <audio controls src={entry.recording.dataUrl} />
                          <button
                            type="button"
                            className="icon-button danger-icon-button"
                            onClick={() => onDeletePracticeRecording(entry.id)}
                            aria-label="Delete recording"
                            title="Delete recording"
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="plain-empty">no sessions yet - first one is the hardest</p>
          )}
        </div>

      </div>
    </section>
  );
}
