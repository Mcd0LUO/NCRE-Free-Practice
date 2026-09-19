import React from 'react'
import RunView from '../RunView.jsx'

export default function MarkedView({ ctx }) {
  const { mode, idx, setIdx, picks, results, marked, markedList, notes, details, displayResults, items, onCheck, onPick, onFill, onSelf, onToggleShow, onMark, saveNote, saveExpl, onPrev, onNext, canPrev, canNext } = ctx
  return (
    <>
{/* ---------- 标记题 ---------- */}
{mode === 'marked' && (
  <RunView
    items={markedList}
    idx={idx}
    setIdx={setIdx}
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
    emptyTitle="还没有标记任何题目"
    emptyHint="做题时点右上角的旗标即可标记，标记的题会集中到这里。"
  />
)}

    </>
  )
}
