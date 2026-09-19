import React from 'react'
import RunView from '../RunView.jsx'
import { Tag, Icon } from '../components.jsx'

export default function FocusView({ ctx }) {
  const { idx, setIdx, picks, results, marked, notes, focusItem, setFocusItem, details, displayResults, items, onCheck, onPick, onFill, onSelf, onToggleShow, onMark, saveNote, saveExpl, onPrev, onNext, canPrev, canNext } = ctx
  return (
    <>
{/* 单题聚焦：?q= 直达 / 笔记跳转 */}
{focusItem && (
  <section className="mb-5">
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setFocusItem(null)
          if (location.search.includes('q=')) history.replaceState({}, '', location.pathname)
        }}
        className="n-btn flex items-center gap-1 border border-gray-200 px-2"
      >
        <Icon name="close" className="h-3.5 w-3.5" />
        关闭
      </button>
      {focusItem.secName && <Tag tone="gray">{focusItem.secName}</Tag>}
      <span className="font-mono text-xs text-gray-400">ID {focusItem.id}</span>
    </div>
    <RunView
      items={[focusItem]}
      idx={0}
      setIdx={() => {}}
      picks={picks}
      results={displayResults} onPrev={onPrev} onNext={onNext} canPrev={canPrev} canNext={canNext}
    notes={notes}
    onNote={saveNote}
    onExpl={saveExpl}
      marked={marked}
      details={details}
      onPick={onPick}
      onFill={onFill}
      onSelf={onSelf}
      onCheck={onCheck}
      onToggleShow={onToggleShow}
      onMark={onMark}
    />
  </section>
)}

    </>
  )
}
