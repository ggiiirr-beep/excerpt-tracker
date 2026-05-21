import { useRef, useState } from 'react';
import type { AppData } from '../types';
import { exportData, importData } from '../lib/appData';

export function BackupControls({
  data,
  onImport,
}: {
  data: AppData;
  onImport: (data: AppData) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setMessage('');
      await onImport(await importData(file));
      setMessage('Backup imported.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import backup.');
    }
  };

  return (
    <div className="backup-controls">
      <button type="button" onClick={() => exportData(data)}>Export Backup</button>
      <button type="button" onClick={() => inputRef.current?.click()}>Import Backup</button>
      <input ref={inputRef} type="file" accept="application/json" hidden onChange={(event) => handleFile(event.target.files?.[0])} />
      {message && <span>{message}</span>}
    </div>
  );
}
