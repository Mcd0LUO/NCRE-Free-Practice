import React from 'react'
import QuestionCard from './QuestionCard.jsx'
import { Empty, Loading } from './components.jsx'

export default function RunView({
  items, idx, setIdx, picks, results, marked, locked = false, details,
  notes, onNote,
  onPick, onFill, onSelf, onCheck, onToggleShow, onMark,
  header, emptyTitle = '没有题目', emptyHint, footer,
}) {
  if (items === null) return <Loading />
  if (!items.length) return <Empty title={emptyTitle} hint={emptyHint} action={footer} />

  const raw = items[idx]
  if (!raw) return <Empty title="题目索引越界" hint="请返回上一级重新选择。" />
  // 列表数据不含解析；已懒加载过的题在此合并回完整字段
  const item = details && details[raw.id] ? { ...raw, ...details[raw.id] } : raw

  return (
    <div className="space-y-4">
      {header}

      <QuestionCard
        item={item}
        index={idx}
        total={items.length}
        pick={picks[item.id]}
        result={results[item.id]}
        marked={marked?.has(item.id)}
        note={notes ? notes[item.id] : ''}
        onNote={onNote ? (t) => onNote(item.id, t) : undefined}
        locked={locked}
        onPick={onPick}
        onFill={onFill}
        onSelf={onSelf}
        onCheck={onCheck}
        onToggleShow={onToggleShow}
        onMark={onMark ? () => onMark(item.id) : undefined}
      />

      {/* 题号导航 */}
      <section className="group rounded-lg border border-gray-200 bg-white p-3 shadow-sm md:p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="n-handle text-gray-300">
            <span className="text-sm leading-none">⋮⋮</span>
          </span>
          <h2 className="text-sm font-medium text-gray-700">题号导航</h2>
          <span className="ml-auto font-mono text-xs text-gray-400">
            {idx + 1} / {items.length}
          </span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-1">
          {items.map((it, i) => {
            const r = results[it.id]
            let cls = 'flex h-8 items-center justify-center rounded-md text-xs transition-colors duration-150 '
            if (r) {
              cls += r.state === 'ok' ? 'bg-green-50 text-[#0f7b6c] ' : 'bg-red-50 text-[#eb5757] '
            } else {
              cls += 'text-gray-600 hover:bg-[#efedea] active:bg-[#e3e1db] '
            }
            if (i === idx) cls += 'ring-1 ring-[#2eaadc] ' // 选中仅加描边，不位移不缩放
            return (
              <button
                key={it.id}
                type="button"
                className={cls}
                onClick={() => {
                  setIdx(i)
                  window.scrollTo({ top: 0 })
                }}
                aria-current={i === idx ? 'true' : undefined}
                aria-label={'第 ' + (i + 1) + ' 题' + (r ? (r.state === 'ok' ? '，已答对' : '，已答错') : '，未作答')}
              >
                {i + 1}
                {r && <span className="sr-only">{r.state === 'ok' ? '✓' : '✕'}</span>}
              </button>
            )
          })}
        </div>
        {footer && <div className="mt-3">{footer}</div>}
      </section>
    </div>
  )
}
