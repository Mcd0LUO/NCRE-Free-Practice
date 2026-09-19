import React from 'react'
import RunView from '../RunView.jsx'

export default function WrongView({ ctx }) {
  const { mode, idx, setIdx, picks, results, setFreshIds, marked, wrong, wrongSec, setWrongSec, notes, details, displayResults, items, onCheck, onPick, onFill, onSelf, onToggleShow, onMark, saveNote, saveExpl, onPrev, onNext, canPrev, canNext } = ctx
  return (
    <>
{/* ---------- 错题本 ---------- */}
{mode === 'wrong' && (
  <RunView
    items={items}
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
    emptyTitle="错题本是空的"
    emptyHint="先去分类练习做题，答错的题会自动汇总到这里。"
    header={
      (wrong?.length || 0) > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
          <span className="text-gray-600">
            共 <span className="font-mono">{wrong.length}</span> 道错题
          </span>
          <label className="ml-auto flex items-center gap-2 text-gray-600">
            知识点
            <select
              value={wrongSec}
              onChange={(e) => { setWrongSec(+e.target.value); setIdx(0) }}
              className="n-input px-2 py-1.5 text-sm"
            >
              <option value={0}>全部</option>
              {[...new Map((wrong || []).map((x) => [x.sec, x])).values()].map((x) => (
                <option key={x.sec} value={x.sec}>{x.secName}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => { setIdx(0); setFreshIds(new Set((wrong || []).map((x) => x.id))) }}
            className="n-btn border border-gray-200 px-2"
          >
            重刷全部
          </button>
        </div>
      ) : null
    }
  />
)}

    </>
  )
}
