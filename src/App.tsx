import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppData, ConfidenceRating, Excerpt, SessionRecording } from './types';
import { freshSampleData } from './lib/appData';
import { repository } from './lib/repository';
import { supabase } from './lib/supabaseClient';
import { todayIso } from './lib/dates';
import { Dot, makeId, Stars } from './components/Atoms';
import { AuthGate } from './components/AuthGate';
import { BackupControls } from './components/BackupControls';
import { Dashboard, buildSections } from './components/Dashboard';
import { DetailView } from './components/DetailView';
import { ExcerptCard } from './components/ExcerptCard';
import { PracticeModal } from './components/PracticeModal';

function SignedInApp({ user }: { user: User }) {
  const [data, setData] = useState<AppData>(() => freshSampleData());
  const [syncState, setSyncState] = useState<'loading' | 'synced' | 'saving' | 'error'>('loading');
  const [syncMessage, setSyncMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState('focus');
  const [mobileSectionId, setMobileSectionId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState('all');
  const [openSections, setOpenSections] = useState(() => new Set(['focus', 'new']));
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
  const sections = useMemo(() => buildSections(visibleExcerpts), [visibleExcerpts]);
  const currentSection = sections.find((section) => section.key === selectedSection) ?? sections[0];

  const updateExcerpt = (id: string, patch: Partial<Excerpt>) => {
    const nextData = {
      ...data,
      excerpts: data.excerpts.map((excerpt) => (excerpt.id === id ? { ...excerpt, ...patch } : excerpt)),
    };
    persistData(nextData);
  };

  const applyListFilter = (id: string) => {
    const list = id === 'all' ? null : data.lists.find((item) => item.id === id) ?? null;
    const filtered = list
      ? data.excerpts.filter((excerpt) => new Set(list.excerptIds).has(excerpt.id))
      : data.excerpts;
    const nonEmptySections = buildSections(filtered).filter((section) => section.items.length > 0).map((section) => section.key);
    setSelectedListId(id);
    setSelectedId(null);
    setMobileSectionId(null);
    setSelectedSection(nonEmptySections[0] ?? 'focus');
    setOpenSections(new Set(nonEmptySections.length ? nonEmptySections : ['focus']));
  };

  const renderSectionTitle = (section: typeof currentSection) => {
    if (section.rating) return <Stars rating={section.rating} size={24} />;
    return section.label;
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
        <div className="desktop-sections">
          <p>Sections</p>
          {sections.map((section) => (
            <button
              className={selectedSection === section.key && !selectedExcerpt ? 'active' : ''}
              key={section.key}
              onClick={() => {
                setSelectedSection(section.key);
                setSelectedId(null);
                setMobileSectionId(null);
              }}
            >
              {section.accent && <Dot />}
              <span>{section.rating ? <Stars rating={section.rating} size={14} /> : section.label}</span>
              <strong>{section.items.length}</strong>
            </button>
          ))}
        </div>
        <p className="sidebar-quote">“The score is a map.<br />The practice is the territory.”</p>
        <div className="sync-panel">
          <span>{syncState === 'loading' ? 'Loading cloud data' : syncState === 'saving' ? 'Saving' : syncState === 'error' ? 'Sync issue' : 'Synced'}</span>
          {syncMessage && <small>{syncMessage}</small>}
          <BackupControls
            data={data}
            onImport={async (backup) => {
              await repository.importBackup(user.id, backup);
              setData(backup);
              setSelectedId(null);
              setMobileSectionId(null);
            }}
          />
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
            pendingRecording={pendingRecordings[selectedExcerpt.id] ?? null}
            onPendingRecordingChange={(recording) => {
              setPendingRecordings((current) => ({ ...current, [selectedExcerpt.id]: recording }));
            }}
          />
        ) : (
          <>
            <div className="desktop-section-view">
              <header className="section-header">
                <p>{currentSection.accent && <Dot />} Section · {currentSection.items.length} {currentSection.items.length === 1 ? 'excerpt' : 'excerpts'}</p>
                <h1>{renderSectionTitle(currentSection)}</h1>
                <span>{currentSection.key === 'focus' ? 'Your shortlist - keep these warm.' : currentSection.key === 'new' ? 'Not started yet.' : `${currentSection.label} confidence.`}</span>
              </header>
              {currentSection.items.length ? (
                <div className="desktop-card-grid">
                  {currentSection.items.map((excerpt) => (
                    <ExcerptCard
                      key={excerpt.id}
                      excerpt={excerpt}
                      onOpen={() => setSelectedId(excerpt.id)}
                      onPractice={() => setSelectedId(excerpt.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="empty-row">Nothing here yet.</p>
              )}
            </div>
            {mobileSectionId && (() => {
              const mobileSection = sections.find((section) => section.key === mobileSectionId) ?? sections[0];
              return (
                <div className="mobile-section-page">
                  <button className="back-link" type="button" onClick={() => setMobileSectionId(null)}>‹ Sections</button>
                  <header className="section-header">
                    <p>{mobileSection.accent && <Dot />} Section · {mobileSection.items.length} {mobileSection.items.length === 1 ? 'excerpt' : 'excerpts'}</p>
                    <h1>{renderSectionTitle(mobileSection)}</h1>
                    <span>{selectedList ? selectedList.name : 'All excerpts'}</span>
                  </header>
                  {mobileSection.items.length ? (
                    <div className="mobile-section-list">
                      {mobileSection.items.map((excerpt) => (
                        <ExcerptCard
                          key={excerpt.id}
                          excerpt={excerpt}
                          onOpen={() => setSelectedId(excerpt.id)}
                          onPractice={() => setSelectedId(excerpt.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="empty-row">Nothing here yet.</p>
                  )}
                </div>
              );
            })()}
            {!mobileSectionId && (
              <Dashboard
                excerpts={visibleExcerpts}
                openSections={openSections}
                onToggleSection={(key) => {
                  setOpenSections((current) => {
                    const next = new Set(current);
                    next.has(key) ? next.delete(key) : next.add(key);
                    return next;
                  });
                }}
                onOpenExcerpt={setSelectedId}
                listFilterName={selectedList ? selectedList.name : 'All excerpts'}
                listOptions={data.lists}
                selectedListId={selectedListId}
                onSelectList={applyListFilter}
                onOpenSection={(key) => {
                  setSelectedSection(key);
                  setMobileSectionId(key);
                }}
              />
            )}
          </>
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
