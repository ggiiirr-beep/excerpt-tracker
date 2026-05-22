import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppData, ConfidenceRating, Excerpt, SessionRecording } from './types';
import logoUrl from './assets/logo.png';
import { freshEmptyData } from './lib/appData';
import { repository } from './lib/repository';
import { supabase } from './lib/supabaseClient';
import { todayIso } from './lib/dates';
import { makeId } from './components/Atoms';
import { AuthGate } from './components/AuthGate';
import { Dashboard } from './components/Dashboard';
import { DetailView } from './components/DetailView';
import { ExcerptFormModal } from './components/ExcerptFormModal';
import { ListMembershipModal } from './components/ListMembershipModal';
import { ListsView } from './components/ListsView';
import { PracticeModal } from './components/PracticeModal';

function SignedInApp({ user }: { user: User }) {
  const [data, setData] = useState<AppData>(() => freshEmptyData());
  const [syncState, setSyncState] = useState<'loading' | 'synced' | 'saving' | 'error'>('loading');
  const [syncMessage, setSyncMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'lists'>('dashboard');
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editExcerptId, setEditExcerptId] = useState<string | null>(null);
  const [listMembershipExcerptId, setListMembershipExcerptId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
  const editExcerpt = editExcerptId ? data.excerpts.find((excerpt) => excerpt.id === editExcerptId) ?? null : null;
  const listMembershipExcerpt = listMembershipExcerptId ? data.excerpts.find((excerpt) => excerpt.id === listMembershipExcerptId) ?? null : null;
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

  const goHome = () => {
    setSelectedId(null);
    setView('dashboard');
  };

  const openCreateExcerpt = () => {
    setFormMode('create');
  };

  const saveNewExcerpt = (value: Pick<Excerpt, 'title' | 'confidenceRating' | 'isFocus' | 'notes' | 'resources'>) => {
    const id = makeId('excerpt');
    const newExcerpt: Excerpt = {
      id,
      title: value.title,
      confidenceRating: value.confidenceRating,
      isNew: true,
      isFocus: value.isFocus,
      practiceCount: 0,
      lastPracticedDate: null,
      dateAdded: todayIso(),
      notes: value.notes,
      tags: [],
      resources: value.resources,
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
    setFormMode(null);
  };

  const updateLists = (lists: typeof data.lists) => {
    if (selectedListId !== 'all' && !lists.some((list) => list.id === selectedListId)) {
      setSelectedListId('all');
    }
    persistData({ ...data, lists });
  };

  const createList = (name: string) => {
    const id = makeId('list');
    persistData({
      ...data,
      lists: [...data.lists, { id, name, excerptIds: [] }],
    });
    setSelectedListId(id);
    setSelectedId(null);
    setView('lists');
  };

  const deleteExcerpt = (id: string) => {
    const excerpt = data.excerpts.find((item) => item.id === id);
    if (!excerpt) return;
    const confirmed = window.confirm(`Delete "${excerpt.title}"? This will also delete its practice history, PDF, and recordings.`);
    if (!confirmed) return;

    persistData({
      ...data,
      excerpts: data.excerpts.filter((item) => item.id !== id),
      lists: data.lists.map((list) => ({
        ...list,
        excerptIds: list.excerptIds.filter((excerptId) => excerptId !== id),
      })),
    });
    if (selectedId === id) setSelectedId(null);
    if (editExcerptId === id) {
      setEditExcerptId(null);
      setFormMode(null);
    }
    if (listMembershipExcerptId === id) setListMembershipExcerptId(null);
  };

  const saveEditedExcerpt = (value: Pick<Excerpt, 'title' | 'confidenceRating' | 'isFocus' | 'notes' | 'resources'>) => {
    if (!editExcerpt) return;
    updateExcerpt(editExcerpt.id, value);
    setFormMode(null);
    setEditExcerptId(null);
  };

  const openEditExcerpt = (id: string) => {
    setEditExcerptId(id);
    setFormMode('edit');
  };

  const toggleExcerptFocus = (id: string) => {
    const excerpt = data.excerpts.find((item) => item.id === id);
    if (!excerpt) return;
    updateExcerpt(id, { isFocus: !excerpt.isFocus });
  };

  const saveListMembership = (excerptId: string, listIds: string[], newListName: string) => {
    const newListId = newListName ? makeId('list') : null;
    const nextSelectedIds = new Set(listIds);
    if (newListId) nextSelectedIds.add(newListId);

    const updatedLists = data.lists.map((list) => ({
      ...list,
      excerptIds: nextSelectedIds.has(list.id)
        ? [...new Set([...list.excerptIds, excerptId])]
        : list.excerptIds.filter((id) => id !== excerptId),
    }));

    persistData({
      ...data,
      lists: newListId
        ? [...updatedLists, { id: newListId, name: newListName, excerptIds: [excerptId] }]
        : updatedLists,
    });
    setListMembershipExcerptId(null);
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
    <div className={sidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <aside className="sidebar">
        <div className="brand-mark">
          <button className="brand-icon-button" type="button" onClick={goHome} aria-label="Go to main list">
            <img src={logoUrl} alt="" />
          </button>
          <span>
            <strong>Excerpt Tracker</strong>
          </span>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>
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
        <button type="button" onClick={openCreateExcerpt}>New excerpt</button>
        <button type="button" onClick={() => {
          setSelectedId(null);
          setView('lists');
        }}>
          Edit lists
        </button>
        <div className="sidebar-excerpt-list">
          <p>Excerpts</p>
          {visibleExcerpts.length ? (
            visibleExcerpts.map((excerpt) => (
              <button
                className={excerpt.id === selectedExcerpt?.id ? 'active' : ''}
                type="button"
                key={excerpt.id}
                onClick={() => {
                  setSelectedId(excerpt.id);
                  setView('dashboard');
                }}
              >
                <span>{excerpt.title}</span>
              </button>
            ))
          ) : (
            <small>No excerpts in this list.</small>
          )}
        </div>
        <p className="sidebar-quote">“The score is a map.<br />The practice is the territory.”</p>
        <div className="sync-panel">
          <span>{syncState === 'loading' ? 'Loading cloud data' : syncState === 'saving' ? 'Saving' : syncState === 'error' ? 'Sync issue' : 'Synced'}</span>
          {syncMessage && <small>{syncMessage}</small>}
          <button type="button" onClick={() => supabase?.auth.signOut()}>Sign out</button>
        </div>
      </aside>

      <header className="mobile-app-bar">
        <button className="brand-icon-button" type="button" onClick={goHome} aria-label="Go to main list">
          <img src={logoUrl} alt="" />
        </button>
        <strong>Excerpt Tracker</strong>
      </header>

      <main className="main-pane">
        {selectedExcerpt ? (
          <DetailView
            excerpt={selectedExcerpt}
            lists={data.lists}
            onBack={() => setSelectedId(null)}
            onChange={(patch) => updateExcerpt(selectedExcerpt.id, patch)}
            onPractice={() => setPracticeId(selectedExcerpt.id)}
            onEdit={() => openEditExcerpt(selectedExcerpt.id)}
            onManageLists={() => setListMembershipExcerptId(selectedExcerpt.id)}
            onDelete={() => deleteExcerpt(selectedExcerpt.id)}
            pendingRecording={pendingRecordings[selectedExcerpt.id] ?? null}
            onPendingRecordingChange={(recording) => {
              setPendingRecordings((current) => ({ ...current, [selectedExcerpt.id]: recording }));
            }}
          />
        ) : view === 'lists' ? (
          <ListsView
            excerpts={data.excerpts}
            lists={data.lists}
            selectedListId={selectedListId}
            onBack={() => setView('dashboard')}
            onCreateList={createList}
            onChangeLists={updateLists}
          />
        ) : (
          <Dashboard
            excerpts={visibleExcerpts}
            onPracticeExcerpt={setSelectedId}
            onEditExcerpt={openEditExcerpt}
            onAddExcerptToList={setListMembershipExcerptId}
            onToggleExcerptFocus={toggleExcerptFocus}
            onDeleteExcerpt={deleteExcerpt}
            onCreateExcerpt={openCreateExcerpt}
            onOpenLists={() => setView('lists')}
            listFilterName={selectedList ? selectedList.name : 'All excerpts'}
            listOptions={data.lists}
            selectedListId={selectedListId}
            onSelectList={applyListFilter}
            isLoading={syncState === 'loading'}
          />
        )}
      </main>

      {practiceExcerpt && <PracticeModal excerpt={practiceExcerpt} onClose={() => setPracticeId(null)} onSave={savePractice} />}
      {formMode === 'create' && (
        <ExcerptFormModal
          mode="create"
          onCancel={() => setFormMode(null)}
          onSave={saveNewExcerpt}
        />
      )}
      {formMode === 'edit' && editExcerpt && (
        <ExcerptFormModal
          mode="edit"
          initialValue={editExcerpt}
          onCancel={() => {
            setFormMode(null);
            setEditExcerptId(null);
          }}
          onSave={saveEditedExcerpt}
        />
      )}
      {listMembershipExcerpt && (
        <ListMembershipModal
          excerpt={listMembershipExcerpt}
          lists={data.lists}
          onCancel={() => setListMembershipExcerptId(null)}
          onSave={(listIds, newListName) => saveListMembership(listMembershipExcerpt.id, listIds, newListName)}
        />
      )}
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
