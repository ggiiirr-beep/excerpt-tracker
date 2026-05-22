import type { Excerpt } from '../types';
import { ExcerptCard } from './ExcerptCard';
import { Dot, Stars } from './Atoms';

type Section = {
  key: string;
  label: string;
  items: Excerpt[];
  accent?: boolean;
  rating?: number;
};

function practicedTime(excerpt: Excerpt) {
  if (!excerpt.lastPracticedDate) return 0;
  return new Date(`${excerpt.lastPracticedDate}T12:00:00`).getTime();
}

export function sortOldestPracticedFirst(excerpts: Excerpt[]) {
  return [...excerpts].sort((a, b) => {
    const practicedDiff = practicedTime(a) - practicedTime(b);
    if (practicedDiff !== 0) return practicedDiff;
    return a.title.localeCompare(b.title);
  });
}

export function buildPracticeGroups(excerpts: Excerpt[]): Section[] {
  const ratings = [0, 1, 2, 3, 4, 5] as const;
  return ratings.map((rating) => ({
    key: String(rating),
    label: rating === 0 ? 'No stars' : `${rating} star`,
    items: sortOldestPracticedFirst(excerpts.filter((excerpt) => excerpt.confidenceRating === rating)),
    rating,
  }));
}

export function Dashboard({
  excerpts,
  onPracticeExcerpt,
  onEditExcerpt,
  onAddExcerptToList,
  onToggleExcerptFocus,
  onDeleteExcerpt,
  onCreateExcerpt,
  onOpenLists,
  listFilterName,
  listOptions,
  selectedListId,
  onSelectList,
}: {
  excerpts: Excerpt[];
  onPracticeExcerpt: (id: string) => void;
  onEditExcerpt: (id: string) => void;
  onAddExcerptToList: (id: string) => void;
  onToggleExcerptFocus: (id: string) => void;
  onDeleteExcerpt: (id: string) => void;
  onCreateExcerpt: () => void;
  onOpenLists: () => void;
  listFilterName: string;
  listOptions: { id: string; name: string }[];
  selectedListId: string;
  onSelectList: (id: string) => void;
}) {
  const focusItems = sortOldestPracticedFirst(excerpts.filter((excerpt) => excerpt.isFocus));
  const groups = buildPracticeGroups(excerpts).filter((group) => group.items.length > 0);
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <section className="dashboard">
      <header className="mobile-header">
        <p>{dateLine}</p>
        <h1>Excerpts</h1>
        <span>{listFilterName} · {excerpts.filter((excerpt) => excerpt.isFocus).length} in focus · {excerpts.length} total</span>
      </header>

      <div className="dashboard-actions">
        <button className="pill-button" type="button" onClick={onCreateExcerpt}>New excerpt</button>
        <button className="small-button" type="button" onClick={onOpenLists}>Edit lists</button>
      </div>

      <label className="mobile-list-filter">
        <span>List</span>
        <select value={selectedListId} onChange={(event) => onSelectList(event.target.value)}>
          <option value="all">All excerpts</option>
          {listOptions.map((list) => (
            <option value={list.id} key={list.id}>{list.name}</option>
          ))}
        </select>
      </label>

      {!excerpts.length ? (
        <div className="dashboard-empty">
          <h2>No excerpts yet</h2>
          <p>Create your first excerpt, then it will show up here by confidence level.</p>
          <button className="pill-button" type="button" onClick={onCreateExcerpt}>New excerpt</button>
        </div>
      ) : (
        <>
          <PracticeGroup
            label="Focus"
            accent
            items={focusItems}
            onPracticeExcerpt={onPracticeExcerpt}
            onEditExcerpt={onEditExcerpt}
            onAddExcerptToList={onAddExcerptToList}
            onToggleExcerptFocus={onToggleExcerptFocus}
            onDeleteExcerpt={onDeleteExcerpt}
            emptyText="Nothing in focus yet."
          />

          <div className="all-excerpts-heading">
            <p>{listFilterName}</p>
            <span>Grouped by confidence · oldest practice first</span>
          </div>

          {groups.map((group) => (
            <PracticeGroup
              key={group.key}
              rating={group.rating}
              label={group.label}
              items={group.items}
              onPracticeExcerpt={onPracticeExcerpt}
              onEditExcerpt={onEditExcerpt}
              onAddExcerptToList={onAddExcerptToList}
              onToggleExcerptFocus={onToggleExcerptFocus}
              onDeleteExcerpt={onDeleteExcerpt}
              emptyText="Nothing here yet."
            />
          ))}
        </>
      )}
    </section>
  );
}

function PracticeGroup({
  label,
  rating,
  accent = false,
  items,
  emptyText,
  onPracticeExcerpt,
  onEditExcerpt,
  onAddExcerptToList,
  onToggleExcerptFocus,
  onDeleteExcerpt,
}: {
  label: string;
  rating?: number;
  accent?: boolean;
  items: Excerpt[];
  emptyText: string;
  onPracticeExcerpt: (id: string) => void;
  onEditExcerpt: (id: string) => void;
  onAddExcerptToList: (id: string) => void;
  onToggleExcerptFocus: (id: string) => void;
  onDeleteExcerpt: (id: string) => void;
}) {
  return (
    <section className="practice-group">
      <header className="practice-group-header">
        <div>
          {accent && <Dot />}
          {rating !== undefined ? <Stars rating={rating} size={17} /> : <h2>{label}</h2>}
          {rating === 0 && <span className="unrated-label">No stars</span>}
        </div>
        <span>{items.length}</span>
      </header>
      {items.length ? (
        <div className="practice-group-list">
          {items.map((excerpt) => (
            <ExcerptCard
              key={excerpt.id}
              excerpt={excerpt}
              onPractice={() => onPracticeExcerpt(excerpt.id)}
              onEdit={() => onEditExcerpt(excerpt.id)}
              onAddToList={() => onAddExcerptToList(excerpt.id)}
              onToggleFocus={() => onToggleExcerptFocus(excerpt.id)}
              onDelete={() => onDeleteExcerpt(excerpt.id)}
            />
          ))}
        </div>
      ) : (
        <p className="empty-row">{emptyText}</p>
      )}
    </section>
  );
}
