import type { AppData, Excerpt, PdfAttachment, SessionRecording } from '../types';
import { supabase } from './supabaseClient';

const FILE_BUCKET = 'excerpt-files';

type MigrationResult = {
  data: AppData;
  changed: boolean;
};

function makeStorageId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeFileName(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

function extensionFromName(name: string, fallback: string) {
  const match = name.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : fallback;
}

function recordingExtension(mimeType: string) {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

async function blobFromDataUrl(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function uploadBlob(path: string, blob: Blob, contentType: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.storage.from(FILE_BUCKET).upload(path, blob, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
}

export async function uploadPdfAttachment(userId: string, excerptId: string, file: File): Promise<PdfAttachment> {
  const extension = extensionFromName(file.name, 'pdf');
  const safeName = safeFileName(file.name);
  const path = `${userId}/excerpts/${excerptId}/score-${makeStorageId()}-${safeName.includes('.') ? safeName : `${safeName}.${extension}`}`;
  await uploadBlob(path, file, file.type || 'application/pdf');
  return {
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/pdf',
    path,
  };
}

export async function uploadRecordingBlob(
  userId: string,
  excerptId: string,
  blob: Blob,
  mimeType: string,
  name: string,
): Promise<SessionRecording> {
  const extension = recordingExtension(mimeType);
  const path = `${userId}/excerpts/${excerptId}/recordings/${makeStorageId()}.${extension}`;
  await uploadBlob(path, blob, mimeType);
  return { name, mimeType, path };
}

export async function signedFileUrl(path: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeStoredFile(path?: string | null) {
  if (!path || !supabase) return;
  const { error } = await supabase.storage.from(FILE_BUCKET).remove([path]);
  if (error) throw error;
}

export async function removeExcerptFiles(excerpt: Excerpt) {
  const paths = [
    excerpt.pdfAttachment?.path,
    ...excerpt.practiceHistory.map((entry) => entry.recording?.path),
  ].filter(Boolean) as string[];

  if (!paths.length || !supabase) return;
  const { error } = await supabase.storage.from(FILE_BUCKET).remove(paths);
  if (error) throw error;
}

async function migratePdf(userId: string, excerptId: string, attachment: PdfAttachment | null | undefined) {
  if (!attachment) return { attachment, changed: false };
  if (!attachment.dataUrl) return { attachment, changed: false };

  if (attachment.path) {
    const { dataUrl: _dataUrl, ...rest } = attachment;
    return { attachment: rest, changed: true };
  }

  const blob = await blobFromDataUrl(attachment.dataUrl);
  const extension = extensionFromName(attachment.name, 'pdf');
  const path = `${userId}/excerpts/${excerptId}/score-${makeStorageId()}-${safeFileName(attachment.name || `score.${extension}`)}`;
  await uploadBlob(path, blob, attachment.mimeType || blob.type || 'application/pdf');

  return {
    attachment: {
      name: attachment.name,
      size: attachment.size || blob.size,
      mimeType: attachment.mimeType || blob.type || 'application/pdf',
      path,
    },
    changed: true,
  };
}

async function migrateRecording(userId: string, excerptId: string, recording: SessionRecording | null | undefined) {
  if (!recording) return { recording, changed: false };
  if (!recording.dataUrl) return { recording, changed: false };

  if (recording.path) {
    const { dataUrl: _dataUrl, ...rest } = recording;
    return { recording: rest, changed: true };
  }

  const blob = await blobFromDataUrl(recording.dataUrl);
  const mimeType = recording.mimeType || blob.type || 'audio/webm';
  const extension = recordingExtension(mimeType);
  const path = `${userId}/excerpts/${excerptId}/recordings/${makeStorageId()}.${extension}`;
  await uploadBlob(path, blob, mimeType);

  return {
    recording: {
      name: recording.name,
      mimeType,
      path,
    },
    changed: true,
  };
}

export async function migrateEmbeddedFilesToStorage(userId: string, data: AppData): Promise<MigrationResult> {
  let changed = false;
  const excerpts = await Promise.all(data.excerpts.map(async (excerpt) => {
    const pdfResult = await migratePdf(userId, excerpt.id, excerpt.pdfAttachment);
    if (pdfResult.changed) changed = true;

    const practiceHistory = await Promise.all(excerpt.practiceHistory.map(async (entry) => {
      const recordingResult = await migrateRecording(userId, excerpt.id, entry.recording);
      if (recordingResult.changed) changed = true;
      return { ...entry, recording: recordingResult.recording ?? null };
    }));

    return {
      ...excerpt,
      pdfAttachment: pdfResult.attachment ?? null,
      practiceHistory,
    };
  }));

  return {
    data: changed ? { ...data, excerpts } : data,
    changed,
  };
}
