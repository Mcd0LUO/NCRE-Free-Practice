import React from 'react'
import { Tag, Loading, Empty } from '../components.jsx'
import { KIND_LABEL } from '../grading'

export default function NotesView({ ctx }) {
  const { mode, notes, notesList, setFocusItem, items } = ctx
  return (
    <>
{/* ---------- 我的笔记 ---------- */}
{mode === 'notes' && (
  <div className="space-y-4">
    <div>
      <h1 className="text-xl font-semibold text-[#37352f] md:text-2xl">我的笔记</h1>
      <p className="mt-1 text-sm text-gray-600">带笔记的题目，点击可直达。</p>
    </div>
    {notesList === null ? (
      <Loading text="读取笔记…" />
    ) : !notesList.length ? (
      <Empty title="还没有笔记" hint="做题时在题目下方「添加笔记」即可记录。" />
    ) : (
      <ul className="space-y-1.5">
        {notesList.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() =>
                api
                  .getById(n.id)
                  .then((it) => {
                    if (it && it.id != null) {
                      setFocusItem(it)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                  })
                  .catch(() => {})
              }
              className="group w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors duration-150 hover:bg-[#efedea]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone="blue">{KIND_LABEL[n.kind] || n.kind}</Tag>
                <Tag tone="gray">{n.secName}</Tag>
                <span className="ml-auto font-mono text-xs text-gray-400">ID {n.id}</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm text-[#37352f]">{n.stem}</p>
              <p className="mt-1 whitespace-pre-wrap rounded bg-yellow-50 px-2 py-1 text-xs text-gray-600">
                {n.note}
              </p>
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
)}

    </>
  )
}
