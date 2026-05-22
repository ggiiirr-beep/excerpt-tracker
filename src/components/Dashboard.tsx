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
  const ratings = [1, 2, 3, 4, 5] as const;
  return ratings.map((rating) => ({
    key: String(rating),
    label: `${rating} star`,
    items: sortOldestPracticedFirst(excerpts.filter((excerpt) => excerpt.confidenceRating === rating)),
    rating,
  }));
}

export function Dashboard({
  excerpts,
  onOpenExcerpt,
  onPracticeExcerpt,
  onCreateExcerpt,
  onOpenLists,
  listFilterName,
  listOptions,
  selectedListId,
  onSelectList,
}: {
  excerpts: Excerpt[];
  onOpenExcerpt: (id: string) => void;
  onPracticeExcerpt: (id: string) => void;
  onCreateExcerpt: () => void;
  onOpenLists: () => void;
  listFilterName: string;
  listOptions: { id: string; name: string }[];
  selectedListId: string;
  onSelectList: (id: string) => void;
}) {
  const focusItems = sortOldestPracticedFirst(excerpts.filter((excerpt) => excerpt.isFocus));
  const groups = buildPracticeGroups(excerpts);
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
        <button className="small-button" type="button" onClick={onOpenLists}>Lists</button>
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

      <PracticeGroup
        label="Focus"
        accent
        items={focusItems}
        onOpenExcerpt={onOpenExcerpt}
        onPracticeExcerpt={onPracticeExcerpt}
        emptyText="Nothing in focus yet."
      />

      <div className="all-excerpts-heading">
        <p>All excerpts</p>
        <span>Grouped by confidence · oldest practice first</span>
      </div>

      {groups.map((group) => (
        <PracticeGroup
          key={group.key}
          rating={group.rating}
          label={group.label}
          items={group.items}
          onOpenExcerpt={onOpenExcerpt}
          onPracticeExcerpt={onPracticeExcerpt}
          emptyText="Nothing here yet."
        />
      ))}
    </section>
  );
}

function PracticeGroup({
  label,
  rating,
  accent = false,
  items,
  emptyText,
  onOpenExcerpt,
  onPracticeExcerpt,
}: {
  label: string;
  rating?: number;
  accent?: boolean;
  items: Excerpt[];
  emptyText: string;
  onOpenExcerpt: (id: string) => void;
  onPracticeExcerpt: (id: string) => void;
}) {
  return (
    <section className="practice-group">
      <header className="practice-group-header">
        <div>
          {accent && <Dot />}
          {rating ? <Stars rating={rating} size={17} /> : <h2>{label}</h2>}
        </div>
        <span>{items.length}</span>
      </header>
      {items.length ? (
        <div className="practice-group-list">
          {items.map((excerpt) => (
            <ExcerptCard
              key={excerpt.id}
              excerpt={excerpt}
              onOpen={() => onOpenExcerpt(excerpt.id)}
              onPractice={() => onPracticeExcerpt(excerpt.id)}
            />
          ))}
        </div>
      ) : (
        <p className="empty-row">{emptyText}</p>
      )}
    </section>
  );
}
