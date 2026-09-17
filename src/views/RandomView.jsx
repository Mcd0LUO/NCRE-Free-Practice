import React from 'react'
import RunView from '../RunView.jsx'

export default function RandomView({ ctx }) {
  const { mode, idx, setIdx, picks, results, marked, randomItems, setRandomItems, randomCount, setRandomCount, randomKind, setRandomKind, randomSmart, setRandomSmart, randomLoading, notes, details, displayResults, startRandom, items, onCheck, onPick, onFill, onSelf, onToggleShow, onMark, saveNote, saveExpl } = ctx
  return (
    <>
{/* ---------- 随机练习 / 智能组卷 ---------- */}
{mode === 'random' && !randomItems && (
  <div className="space-y-5">
    <div>
      <h1 className="text-xl font-semibold text-[#37352f] md:text-2xl">随机练习 / 智能组卷</h1>
      <p className="mt-1 text-sm text-gray-600">随机抽题；开启智能组卷后，未做与做错的题会优先出现。</p>
    </div>
    <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <label className="flex items-center gap-3 text-sm text-gray-600">
        题量
        <select
          value={randomCount}
          onChange={(e) => setRandomCount(+e.target.value)}
          className="n-input px-2 py-1.5 text-sm"
        >
          {[10, 20, 30, 50].map((n) => (
            <option key={n} value={n}>{n} 题</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-3 text-sm text-gray-600">
        题型
        <select
          value={randomKind}
          onChange={(e) => setRandomKind(e.target.value)}
          className="n-input px-2 py-1.5 text-sm"
        >
          <option value="">全部</option>
          <option value="single">单选题</option>
          <option value="multi">多选题</option>
          <option value="fill">填空题</option>
          <option value="essay">设计与应用题</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={randomSmart}
          onChange={(e) => setRandomSmart(e.target.checked)}
        />
        智能组卷（未做 / 做错优先）
      </label>
      <button
        type="button"
        disabled={randomLoading}
        onClick={startRandom}
        className="rounded-md bg-[#2eaadc] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#2898c4] disabled:opacity-50"
      >
        {randomLoading ? '抽题中…' : '开始练习'}
      </button>
    </section>
  </div>
)}

{mode === 'random' && randomItems && (
  <RunView
    items={items}
    idx={idx}
    setIdx={setIdx}
    picks={picks}
    results={displayResults}
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
    emptyTitle="没有抽到题目"
    emptyHint="换个条件再试，或先做分类练习。"
    header={
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
        <span className="text-gray-600">
          {randomSmart ? '智能组卷' : '随机练习'} · 共 <span className="font-mono">{items.length}</span> 题
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={startRandom} className="n-btn border border-gray-200 px-2">
            换一批
          </button>
          <button
            type="button"
            onClick={() => { setRandomItems(null); setIdx(0) }}
            className="n-btn px-2 text-gray-600"
          >
            重新设置
          </button>
        </div>
      </div>
    }
  />
)}

    </>
  )
}
