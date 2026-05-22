import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppData, ConfidenceRating, Excerpt, SessionRecording } from './types';
import { freshEmptyData } from './lib/appData';
import { repository } from './lib/repository';
import { supabase } from './lib/supabaseClient';
import { todayIso } from './lib/dates';
import { makeId } from './components/Atoms';
import { AuthGate } from './components/AuthGate';
import { Dashboard } from './components/Dashboard';
import { DetailView } from './components/DetailView';
import { ListsView } from './components/ListsView';
import { PracticeModal } from './components/PracticeModal';

function SignedInApp({ user }: { user: User }) {
  const [data, setData] = useState<AppData>(() => freshEmptyData());
  const [syncState, setSyncState] = useState<'loading' | 'synced' | 'saving' | 'error'>('loading');
  const [syncMessage, setSyncMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'lists'>('dashboard');
  const [selectedListId, setSelectedListId] = useState('all');
  const [pendingRecordings, setPendingRecordings] = useState<Record<string, SessionRecording | null>>({});

  useEffect(() => {
    let alive = true;
    setSyncState('loading');
    repository.load(user.id)
      .then((loaded) => {
        if (!alive) return;
        setData(loaded);
        setSyncState('synced');
      })
      .catch((error) => {
        if (!alive) return;
        setSyncState('error');
        setSyncMessage(error instanceof Error ? error.message : 'Could not load cloud data.');
      });
    return () => {
      alive = false;
    };
  }, [user.id]);

  const persistData = (nextData: AppData) => {
    setData(nextData);
    setSyncState('saving');
    repository.save(user.id, nextData)
      .then(() => {
        setSyncState('synced');
        setSyncMessage('');
      })
      .catch((error) => {
        setSyncState('error');
        setSyncMessage(error instanceof Error ? error.message : 'Could not save cloud data.');
      });
  };

  const selectedExcerpt = selectedId ? data.excerpts.find((excerpt) => excerpt.id === selectedId) ?? null : null;
  const practiceExcerpt = practiceId ? data.excerpts.find((excerpt) => excerpt.id === practiceId) ?? null : null;
  const selectedList = selectedListId === 'all' ? null : data.lists.find((list) => list.id === selectedListId) ?? null;
  const visibleExcerpts = useMemo(() => {
    if (!selectedList) return data.excerpts;
    const ids = new Set(selectedList.excerptIds);
    return data.excerpts.filter((excerpt) => ids.has(excerpt.id));
  }, [data.excerpts, selectedList]);

  const updateExcerpt = (id: string, patch: Partial<Excerpt>) => {
    const nextData = {
      ...data,
      excerpts: data.excerpts.map((excerpt) => (excerpt.id === id ? { ...excerpt, ...patch } : excerpt)),
    };
    persistData(nextData);
  };

  const applyListFilter = (id: string) => {
    setSelectedListId(id);
    setSelectedId(null);
    setView('dashboard');
  };

  const createExcerpt = () => {
    const id = makeId('excerpt');
    const newExcerpt: Excerpt = {
      id,
      title: 'Untitled excerpt',
      confidenceRating: 1,
      isNew: true,
      isFocus: false,
      practiceCount: 0,
      lastPracticedDate: null,
      dateAdded: todayIso(),
      notes: '',
      tags: [],
      resources: [],
      pdfAttachment: null,
      practiceHistory: [],
    };

    const nextLists = selectedList
      ? data.lists.map((list) => (list.id === selectedList.id ? { ...list, excerptIds: [...list.excerptIds, id] } : list))
      : data.lists;

    persistData({
      ...data,
      excerpts: [newExcerpt, ...data.excerpts],
      lists: nextLists,
    });
    setSelectedId(id);
    setView('dashboard');
  };

  const updateLists = (lists: typeof data.lists) => {
    persistData({ ...data, lists });
  };

  const deleteSelectedExcerpt = () => {
    if (!selectedExcerpt) return;
    const confirmed = window.confirm(`Delete "${selectedExcerpt.title}"?`);
    if (!confirmed) return;

    persistData({
      ...data,
      excerpts: data.excerpts.filter((excerpt) => excerpt.id !== selectedExcerpt.id),
      lists: data.lists.map((list) => ({
        ...list,
        excerptIds: list.excerptIds.filter((id) => id !== selectedExcerpt.id),
      })),
    });
    setSelectedId(null);
  };

  const savePractice = (rating: ConfidenceRating, note: string) => {
    if (!practiceExcerpt) return;
    const date = todayIso();
    const recording = pendingRecordings[practiceExcerpt.id] ?? null;
    updateExcerpt(practiceExcerpt.id, {
      confidenceRating: rating,
      isNew: false,
      practiceCount: practiceExcerpt.practiceCount + 1,
      lastPracticedDate: date,
      practiceHistory: [
        { id: makeId('practice'), date, rating, note: note.trim(), recording: recording ?? null },
        ...practiceExcerpt.practiceHistory,
      ],
    });
    setPendingRecordings((current) => ({ ...current, [practiceExcerpt.id]: null }));
    setPracticeId(null);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>Excerpts</strong>
          <span>a tracker</span>
        </div>
        <p className="sidebar-count">{selectedList ? selectedList.name : 'All excerpts'} · {visibleExcerpts.filter((excerpt) => excerpt.isFocus).length} in focus · {visibleExcerpts.length} total</p>
        <div className="desktop-list-filter">
          <p>List</p>
          <select value={selectedListId} onChange={(event) => applyListFilter(event.target.value)}>
            <option value="all">All excerpts</option>
            {data.lists.map((list) => (
              <option value={list.id} key={list.id}>{list.name}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={createExcerpt}>New excerpt</button>
        <button type="button" onClick={() => {
          setSelectedId(null);
          setView('lists');
        }}>
          Lists
        </button>
        <p className="sidebar-quote">“The score is a map.<br />The practice is the territory.”</p>
        <div className="sync-panel">
          <span>{syncState === 'loading' ? 'Loading cloud data' : syncState === 'saving' ? 'Saving' : syncState === 'error' ? 'Sync issue' : 'Synced'}</span>
          {syncMessage && <small>{syncMessage}</small>}
          <button type="button" onClick={() => supabase?.auth.signOut()}>Sign out</button>
        </div>
      </aside>

      <main className="main-pane">
        {selectedExcerpt ? (
          <DetailView
            excerpt={selectedExcerpt}
            lists={data.lists}
            onBack={() => setSelectedId(null)}
            onChange={(patch) => updateExcerpt(selectedExcerpt.id, patch)}
            onPractice={() => setPracticeId(selectedExcerpt.id)}
            onDelete={deleteSelectedExcerpt}
            pendingRecording={pendingRecordings[selectedExcerpt.id] ?? null}
            onPendingRecordingChange={(recording) => {
              setPendingRecordings((current) => ({ ...current, [selectedExcerpt.id]: recording }));
            }}
          />
        ) : view === 'lists' ? (
          <ListsView
            excerpts={data.excerpts}
            lists={data.lists}
            onBack={() => setView('dashboard')}
            onChangeLists={updateLists}
          />
        ) : (
          <Dashboard
            excerpts={visibleExcerpts}
            onOpenExcerpt={setSelectedId}
            onPracticeExcerpt={setPracticeId}
            onCreateExcerpt={createExcerpt}
            onOpenLists={() => setView('lists')}
            listFilterName={selectedList ? selectedList.name : 'All excerpts'}
            listOptions={data.lists}
            selectedListId={selectedListId}
            onSelectList={applyListFilter}
          />
        )}
      </main>

      {practiceExcerpt && <PracticeModal excerpt={practiceExcerpt} onClose={() => setPracticeId(null)} onSave={savePractice} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      {(user) => <SignedInApp user={user} />}
    </AuthGate>
  );
}
