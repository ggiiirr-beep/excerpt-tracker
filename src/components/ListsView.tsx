import type { Excerpt, RepertoireList } from '../types';
import { makeId } from './Atoms';

export function ListsView({
  excerpts,
  lists,
  onChangeLists,
}: {
  excerpts: Excerpt[];
  lists: RepertoireList[];
  onChangeLists: (lists: RepertoireList[]) => void;
}) {
  const addList = () => {
    const name = prompt('List name');
    if (!name?.trim()) return;
    onChangeLists([...lists, { id: makeId('list'), name: name.trim(), excerptIds: [] }]);
  };

  const updateList = (id: string, patch: Partial<RepertoireList>) => {
    onChangeLists(lists.map((list) => (list.id === id ? { ...list, ...patch } : list)));
  };

  return (
    <section className="lists-view">
      <div className="view-heading">
        <div>
          <p className="eyebrow">Auditions and repertoire</p>
          <h1>Lists</h1>
        </div>
        <button className="pill-button" type="button" onClick={addList}>New list</button>
      </div>
      {lists.map((list) => (
        <article className="list-card" key={list.id}>
          <input value={list.name} onChange={(event) => updateList(list.id, { name: event.target.value })} />
          <div className="list-members">
            {excerpts.map((excerpt) => {
              const checked = list.excerptIds.includes(excerpt.id);
              return (
                <label key={excerpt.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const excerptIds = event.target.checked
                        ? [...list.excerptIds, excerpt.id]
                        : list.excerptIds.filter((id) => id !== excerpt.id);
                      updateList(list.id, { excerptIds });
                    }}
                  />
                  <span>{excerpt.title}</span>
                </label>
              );
            })}
          </div>
          <button className="text-button align-left" type="button" onClick={() => onChangeLists(lists.filter((item) => item.id !== list.id))}>
            Delete list
          </button>
        </article>
      ))}
    </section>
  );
}
