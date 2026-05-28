import { useEffect, useState } from 'react';
import { signedFileUrl } from './fileStorage';

export function useFileUrl(file: { path?: string; dataUrl?: string } | null | undefined) {
  const [url, setUrl] = useState<string | null>(file?.dataUrl ?? null);

  useEffect(() => {
    let alive = true;
    setUrl(file?.dataUrl ?? null);

    if (!file?.path) return () => {
      alive = false;
    };

    signedFileUrl(file.path)
      .then((signedUrl) => {
        if (alive) setUrl(signedUrl);
      })
      .catch(() => {
        if (alive) setUrl(file.dataUrl ?? null);
      });

    return () => {
      alive = false;
    };
  }, [file?.dataUrl, file?.path]);

  return url;
}

export function useFileUrlMap<T extends { id: string }>(
  items: T[],
  getFile: (item: T) => { path?: string; dataUrl?: string } | null | undefined,
) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;

    Promise.all(items.map(async (item) => {
      const file = getFile(item);
      if (!file) return [item.id, ''] as const;
      if (!file.path) return [item.id, file.dataUrl ?? ''] as const;

      try {
        return [item.id, await signedFileUrl(file.path)] as const;
      } catch {
        return [item.id, file.dataUrl ?? ''] as const;
      }
    })).then((entries) => {
      if (!alive) return;
      setUrls(Object.fromEntries(entries.filter(([, value]) => value)));
    });

    return () => {
      alive = false;
    };
  }, [items, getFile]);

  return urls;
}
