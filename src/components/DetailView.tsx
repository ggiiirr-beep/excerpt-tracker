import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Excerpt, PdfAnnotationStroke, RepertoireList, ResourceLink, SessionRecording } from '../types';
import { formatDate, formatShortDate, relativePracticeDate } from '../lib/dates';
import { removeStoredFile, signedFileUrl, uploadPdfAttachment, uploadRecordingBlob } from '../lib/fileStorage';
import { useFileUrl } from '../lib/useFileUrl';
import { confidenceLabel, FieldLabel, makeId, Stars } from './Atoms';
import { PdfAnnotator } from './PdfAnnotator';

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
  userId,
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
  userId: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingReferences, setEditingReferences] = useState(false);
  const [resourceDrafts, setResourceDrafts] = useState<ResourceLink[]>(excerpt.resources);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'blocked'>('idle');
  const [recordingError, setRecordingError] = useState('');
  const [historyRecordingUrls, setHistoryRecordingUrls] = useState<Record<string, string>>({});
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
    const previousPath = excerpt.pdfAttachment?.path;
    uploadPdfAttachment(userId, excerpt.id, file)
      .then(async (pdfAttachment) => {
        if (previousPath) {
          try {
            await removeStoredFile(previousPath);
          } catch {
            // A failed cleanup should not block the newly uploaded score from being saved.
          }
        }
        onChange({ pdfAttachment });
      })
      .catch(() => {
        setRecordingError('Could not upload the PDF. Check that Supabase Storage is set up.');
      });
    event.target.value = '';
  };

  const pdfUrl = useFileUrl(excerpt.pdfAttachment);
  const pendingRecordingUrl = useFileUrl(pendingRecording);

  useEffect(() => {
    let alive = true;

    Promise.all(excerpt.practiceHistory.map(async (entry) => {
      if (!entry.recording) return [entry.id, ''] as const;
      if (!entry.recording.path) return [entry.id, entry.recording.dataUrl ?? ''] as const;

      try {
        return [entry.id, await signedFileUrl(entry.recording.path)] as const;
      } catch {
        return [entry.id, entry.recording.dataUrl ?? ''] as const;
      }
    })).then((entries) => {
      if (!alive) return;
      setHistoryRecordingUrls(Object.fromEntries(entries.filter(([, value]) => value)));
    });

    return () => {
      alive = false;
    };
  }, [excerpt.practiceHistory]);

  const removePdf = () => {
    if (!window.confirm('Remove this PDF from the excerpt?')) return;
    const path = excerpt.pdfAttachment?.path;
    onChange({ pdfAttachment: null });
    if (path) {
      removeStoredFile(path).catch(() => {
        setRecordingError('The PDF was removed from the excerpt, but the stored file could not be deleted.');
      });
    }
  };

  const removePendingRecording = () => {
    if (!window.confirm('Remove this pending recording?')) return;
    const path = pendingRecording?.path;
    onPendingRecordingChange(null);
    if (path) {
      removeStoredFile(path).catch(() => {
        setRecordingError('The recording was removed here, but the stored file could not be deleted.');
      });
    }
  };

  const pdfSize = excerpt.pdfAttachment
    ? `${Math.max(1, Math.round(excerpt.pdfAttachment.size / 1024))} KB`
    : '';

  const saveRecordedBlob = async (blob: Blob, mimeType: string) => {
    const name = `Practice recording ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    try {
      const recording = await uploadRecordingBlob(userId, excerpt.id, blob, mimeType, name);
      onPendingRecordingChange(recording);
    } catch {
      setRecordingError('Could not upload the recording. Check that Supabase Storage is set up.');
    }
  };

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
        void saveRecordedBlob(blob, mimeType);
        setRecordingState('idle');
      };

      const previousPendingPath = pendingRecording?.path;
      recorder.start();
      onPendingRecordingChange(null);
      if (previousPendingPath) {
        removeStoredFile(previousPendingPath).catch(() => {
          setRecordingError('The old pending recording could not be deleted.');
        });
      }
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

  const updatePdfAnnotations = (annotations: PdfAnnotationStroke[]) => {
    if (!excerpt.pdfAttachment) return;
    onChange({
      pdfAttachment: {
        ...excerpt.pdfAttachment,
        annotations,
      },
    });
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
                <button
                  type="button"
                  onClick={() => document.getElementById('score-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  <span>PDF</span>
                  <strong>{excerpt.pdfAttachment.name}</strong>
                  <em>{pdfSize}</em>
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()}>Replace</button>
                <button type="button" onClick={removePdf}>
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
                <audio controls src={pendingRecordingUrl ?? undefined} />
                <button type="button" onClick={startRecording}>Replace</button>
                <button type="button" onClick={removePendingRecording}>
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

      {excerpt.pdfAttachment && (
        <div className="score-section" id="score-viewer">
          <div className="score-section-heading">
            <div>
              <FieldLabel>Score</FieldLabel>
              <p>{excerpt.pdfAttachment.name}</p>
            </div>
            <div className="score-record-controls">
              {recordingState === 'recording' ? (
                <button className="record-button active" type="button" onClick={stopRecording}>Stop</button>
              ) : (
                <button className="record-button" type="button" onClick={startRecording}>Record</button>
              )}
              <button className="small-button" type="button" onClick={onPractice}>Log practice</button>
            </div>
          </div>
          {pendingRecording && (
            <div className="score-pending-recording">
              <audio controls src={pendingRecordingUrl ?? undefined} />
              <button type="button" onClick={removePendingRecording}>Remove</button>
            </div>
          )}
          {pdfUrl ? (
            <PdfAnnotator
              pdfUrl={pdfUrl}
              annotations={excerpt.pdfAttachment.annotations ?? []}
              onChange={updatePdfAnnotations}
            />
          ) : (
            <p className="pdf-status">Preparing score</p>
          )}
        </div>
      )}

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
                          <audio controls src={historyRecordingUrls[entry.id]} />
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
