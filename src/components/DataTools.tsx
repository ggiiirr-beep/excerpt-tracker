import { useRef, useState } from 'react';
import type { AppData } from '../types';
import { exportData, importData } from '../lib/storage';

export function DataTools({
  data,
  onImport,
  onReset,
}: {
  data: AppData;
  onImport: (data: AppData) => void;
  onReset: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setError('');
      onImport(await importData(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import that file.');
    }
  };

  return (
    <section className="data-tools">
      <p className="eyebrow">Storage</p>
      <h1>Local data</h1>
      <p className="tool-copy">Your excerpts live in this browser with localStorage.</p>
      <div className="tool-actions">
        <button className="pill-button" type="button" onClick={() => exportData(data)}>Export JSON</button>
        <button className="small-button" type="button" onClick={() => inputRef.current?.click()}>Import JSON</button>
        <button className="danger-button compact" type="button" onClick={onReset}>Reset sample data</button>
      </div>
      <input ref={inputRef} type="file" accept="application/json" hidden onChange={(event) => handleFile(event.target.files?.[0])} />
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
