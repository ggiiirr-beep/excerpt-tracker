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

export function buildSections(excerpts: Excerpt[]): Section[] {
  return [
    { key: 'focus', label: 'Focus', items: excerpts.filter((excerpt) => excerpt.isFocus), accent: true },
    { key: 'new', label: 'New', items: excerpts.filter((excerpt) => excerpt.isNew) },
    ...([1, 2, 3, 4, 5] as const).map((rating) => ({
      key: String(rating),
      label: `${rating} star`,
      items: excerpts.filter((excerpt) => !excerpt.isNew && excerpt.confidenceRating === rating),
      rating,
    })),
  ];
}

export function Dashboard({
  excerpts,
  openSections,
  onToggleSection,
  onOpenExcerpt,
  listFilterName,
  listOptions,
  selectedListId,
  onSelectList,
  onOpenSection,
}: {
  excerpts: Excerpt[];
  openSections: Set<string>;
  onToggleSection: (key: string) => void;
  onOpenExcerpt: (id: string) => void;
  listFilterName: string;
  listOptions: { id: string; name: string }[];
  selectedListId: string;
  onSelectList: (id: string) => void;
  onOpenSection: (key: string) => void;
}) {
  const sections = buildSections(excerpts);
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <section className="dashboard">
      <header className="mobile-header">
        <p>{dateLine}</p>
        <h1>Excerpts</h1>
        <span>{listFilterName} · {excerpts.filter((excerpt) => excerpt.isFocus).length} in focus · {excerpts.length} total</span>
      </header>

      <label className="mobile-list-filter">
        <span>List</span>
        <select value={selectedListId} onChange={(event) => onSelectList(event.target.value)}>
          <option value="all">All excerpts</option>
          {listOptions.map((list) => (
            <option value={list.id} key={list.id}>{list.name}</option>
          ))}
        </select>
      </label>

      {sections.map((section) => {
        return (
          <div className="accordion-section" key={section.key}>
            <button
              className="section-row section-link-row"
              type="button"
              aria-label={`Open ${section.label} section`}
              onClick={() => onOpenSection(section.key)}
            >
              {section.accent && <Dot />}
              <span>{section.rating ? <Stars rating={section.rating} size={16} /> : section.label}</span>
              <strong>{section.items.length}</strong>
              <b className="chevron">›</b>
            </button>
          </div>
        );
      })}
    </section>
  );
}
