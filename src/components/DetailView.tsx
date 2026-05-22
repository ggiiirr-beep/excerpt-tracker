import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Excerpt, RepertoireList, ResourceLink, SessionRecording } from '../types';
import { formatDate, formatShortDate, relativePracticeDate } from '../lib/dates';
import { confidenceLabel, FieldLabel, makeId, StarPicker, Stars } from './Atoms';

export function DetailView({
  excerpt,
  lists,
  onBack,
  onChange,
  onPractice,
  onDelete,
  pendingRecording,
  onPendingRecordingChange,
}: {
  excerpt: Excerpt;
  lists: RepertoireList[];
  onBack: () => void;
  onChange: (patch: Partial<Excerpt>) => void;
  onPractice: () => void;
  onDelete: () => void;
  pendingRecording: SessionRecording | null;
  onPendingRecordingChange: (recording: SessionRecording | null) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [titleDraft, setTitleDraft] = useState(excerpt.title);
  const [notesDraft, setNotesDraft] = useState(excerpt.notes);
  const [tagsDraft, setTagsDraft] = useState(excerpt.tags.join(', '));
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'blocked'>('idle');
  const [recordingError, setRecordingError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const listNames = useMemo(
    () => lists.filter((list) => list.excerptIds.includes(excerpt.id)).map((list) => list.name),
    [excerpt.id, lists],
  );

  useEffect(() => {
    setShowDetails(false);
    setTitleDraft(excerpt.title);
    setNotesDraft(excerpt.notes);
    setTagsDraft(excerpt.tags.join(', '));
  }, [excerpt.id, excerpt.notes]);

  useEffect(() => {
    setTitleDraft(excerpt.title);
  }, [excerpt.id, excerpt.title]);

  useEffect(() => {
    setTagsDraft(excerpt.tags.join(', '));
  }, [excerpt.id, excerpt.tags]);

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

  const updateResource = (id: string, patch: Partial<ResourceLink>) => {
    onChange({
      resources: excerpt.resources.map((resource) => (resource.id === id ? { ...resource, ...patch } : resource)),
    });
  };

  const addResource = () => {
    onChange({
      resources: [...excerpt.resources, { id: makeId('resource'), label: 'Link', url: '' }],
    });
  };

  const saveTags = () => {
    onChange({
      tags: tagsDraft
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
  };

  return (
    <section className="detail-view">
      <button className="back-link" type="button" onClick={onBack}>‹ Excerpts</button>
      <div className="cue-card">
        <p className="cue-kicker">{excerpt.tags[0] || 'Excerpt'}</p>
        <h1>{excerpt.title}</h1>
        <div className="cue-stars">
          <StarPicker value={excerpt.confidenceRating} onChange={(confidenceRating) => onChange({ confidenceRating })} size={26} />
          <p>{confidenceLabel(excerpt.confidenceRating)}</p>
        </div>

        <div className="cue-tools">
          <div className="cue-tool">
            {excerpt.pdfAttachment ? (
              <>
                <a href={excerpt.pdfAttachment.dataUrl} target="_blank" rel="noreferrer">
                  <span>PDF</span>
                  <strong>{excerpt.pdfAttachment.name}</strong>
                  <em>{pdfSize}</em>
                </a>
                <button type="button" onClick={() => fileInputRef.current?.click()}>Replace</button>
                <button type="button" onClick={() => onChange({ pdfAttachment: null })}>Remove</button>
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
                <button type="button" onClick={() => onPendingRecordingChange(null)}>Remove</button>
              </>
            ) : (
              <button type="button" onClick={startRecording}>
                <span>REC</span>
                Record
              </button>
            )}
          </div>
          {recordingError && <p className="cue-tool-error">{recordingError}</p>}
        </div>
        <input ref={fileInputRef} type="file" accept="application/pdf" hidden onChange={attachPdf} />
      </div>

      <button className="primary-button practice-wide" type="button" onClick={onPractice}>Practice finished</button>

      <div className="details-toggle-wrap">
        <button className="details-toggle" type="button" onClick={() => setShowDetails((current) => !current)}>
          {showDetails ? 'hide details' : 'view details'} <span className={showDetails ? 'toggle-chevron open' : 'toggle-chevron'}>⌄</span>
        </button>
      </div>

      {showDetails && (
        <div className="details-panel">
          <label className="focus-check-row">
            <input type="checkbox" checked={excerpt.isFocus} onChange={(event) => onChange({ isFocus: event.target.checked })} />
            <span>In focus</span>
            <em>{excerpt.isFocus ? 'on your shortlist' : ''}</em>
          </label>

          <div className="form-block">
            <FieldLabel>Title</FieldLabel>
            <input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => onChange({ title: titleDraft.trim() || 'Untitled excerpt' })}
              placeholder="Excerpt title"
            />
          </div>

          <div className="detail-grid">
            <div className="stat"><span>Practice count</span><strong>{excerpt.practiceCount}</strong></div>
            <div className="stat"><span>Last practiced</span><strong>{relativePracticeDate(excerpt.lastPracticedDate)}</strong></div>
            <div className="stat"><span>Date added</span><strong>{formatDate(excerpt.dateAdded)}</strong></div>
            <div className="stat"><span>Lists</span><strong>{listNames.length ? listNames.join(', ') : 'None'}</strong></div>
          </div>

          <div className="form-block">
            <FieldLabel>Notes</FieldLabel>
            <textarea
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              onBlur={() => onChange({ notes: notesDraft })}
              placeholder="What are you working on?"
            />
          </div>

          <div className="form-block">
            <FieldLabel>Tags</FieldLabel>
            <input
              value={tagsDraft}
              onChange={(event) => setTagsDraft(event.target.value)}
              onBlur={saveTags}
              placeholder="audition, tutti, current"
            />
          </div>

          <div className="form-block">
            <div className="block-heading">
              <FieldLabel>References</FieldLabel>
              <button className="text-button" type="button" onClick={addResource}>+ add link</button>
            </div>
            {excerpt.resources.length ? (
              <div className="resources-list">
                {excerpt.resources.map((resource: ResourceLink) => (
                  <div className="resource-row" key={resource.id}>
                    <input
                      value={resource.label}
                      onChange={(event) => updateResource(resource.id, { label: event.target.value })}
                      placeholder="Label"
                    />
                    <input
                      value={resource.url}
                      onChange={(event) => updateResource(resource.id, { url: event.target.value })}
                      placeholder="https://..."
                    />
                    {resource.url && <a href={resource.url} target="_blank" rel="noreferrer">Open</a>}
                    <button type="button" onClick={() => onChange({ resources: excerpt.resources.filter((item) => item.id !== resource.id) })}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="plain-empty">nothing linked yet</p>
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
                        <Stars rating={entry.rating} size={11} />
                        {entry.note && <p>{entry.note}</p>}
                        {entry.recording && (
                          <div className="history-recording">
                            <span>{entry.recording.name}</span>
                            <audio controls src={entry.recording.dataUrl} />
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
          <button className="danger-button" type="button" onClick={onDelete}>Delete excerpt</button>
        </div>
      )}
    </section>
  );
}
