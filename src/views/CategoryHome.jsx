import React from 'react'
import WeakPoints from '../WeakPoints.jsx'
import { Tag, ProgressBar, Icon } from '../components.jsx'

export default function CategoryHome({ ctx }) {
  const { mode, sel, setSel, setKindFilter, total, wrong, items, onPick, sections, parts, sectionsOf } = ctx
  return (
    <>
{/* ---------- 分类选择 ---------- */}
{mode === 'category' && !sel && (
  <div className="space-y-6">
    <div>
      <h1 className="text-xl font-semibold text-[#37352f] md:text-2xl">选择练习分类</h1>
      <p className="mt-1 text-sm text-gray-600">
        共 {parts.length} 个大类、{sections.length} 个知识点。分类来自原题库的组卷结构。
      </p>
    </div>

    <WeakPoints
      sections={sections}
      onPick={(s) => {
        setSel({ part: s.part, sec: s.sec })
        setKindFilter('')
        window.scrollTo({ top: 0 })
      }}
    />

    {parts.map((p) => (
      <section key={p.id}>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-medium text-gray-700">{p.name}</h2>
          <Tag>卷面 {p.count} 题</Tag>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {sectionsOf(p.id).map((s) => (
            <button
              key={s.sec}
              type="button"
              onClick={() => setSel({ part: s.part, sec: s.sec })}
              className="group rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition-colors duration-150 hover:bg-[#efedea] active:bg-[#e3e1db]"
            >
              <div className="flex items-center gap-2">
                <span className="n-handle text-gray-300">
                  <Icon name="grip" className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#37352f]">
                  {s.secName}
                </span>
                <span className="shrink-0 font-mono text-xs text-gray-400">
                  {s.objectiveTotal ? s.right + s.partial + s.wrong : s.done}/{s.objectiveTotal || s.total}
                </span>
              </div>
              <ProgressBar
                value={s.objectiveTotal ? s.right + s.partial + s.wrong : s.done}
                max={s.objectiveTotal || s.total}
                className="mt-2"
              />
              <p className="mt-1 text-xs text-gray-400">
                {(() => {
                  const objDone = s.right + s.partial + s.wrong
                  if (!objDone) return s.subjectiveTotal ? '未开始 · 含 ' + s.subjectiveTotal + ' 道主观题' : '未开始'
                  return '正确率 ' + Math.round((s.right / objDone) * 100) + '%'
                })()}
              </p>
            </button>
          ))}
        </div>
      </section>
    ))}
  </div>
)}

    </>
  )
}
