import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Excerpt, RepertoireList, ResourceLink, SessionRecording } from '../types';
import { formatDate, formatShortDate, relativePracticeDate } from '../lib/dates';
import { confidenceLabel, FieldLabel, Stars } from './Atoms';

export function DetailView({
  excerpt,
  lists,
  onBack,
  onChange,
  onPractice,
  onEdit,
  onManageLists,
  onDelete,
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
  pendingRecording: SessionRecording | null;
  onPendingRecordingChange: (recording: SessionRecording | null) => void;
}) {
  const [notesDraft, setNotesDraft] = useState(excerpt.notes);
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
    setNotesDraft(excerpt.notes);
  }, [excerpt.id, excerpt.notes]);

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
          <FieldLabel>Notes</FieldLabel>
          <textarea
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            onBlur={() => onChange({ notes: notesDraft })}
          />
        </div>

        <div className="form-block">
          <div className="block-heading">
            <FieldLabel>Lists</FieldLabel>
            <button className="text-button" type="button" onClick={onManageLists}>Manage lists</button>
          </div>
          <div className="tag-list">
            {listNames.length ? listNames.map((name) => <span key={name}>{name}</span>) : <p className="plain-empty">not in a list</p>}
          </div>
        </div>

        <div className="form-block">
          <FieldLabel>References</FieldLabel>
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

        <div className="detail-actions">
          <button className="small-button detail-edit-button" type="button" onClick={onEdit}>Edit information</button>
          <button className="danger-button" type="button" onClick={onDelete}>Delete excerpt</button>
        </div>
      </div>
    </section>
  );
}
