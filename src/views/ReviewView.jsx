import React from 'react'
import RunView from '../RunView.jsx'
import { Loading, Empty } from '../components.jsx'

export default function ReviewView({ ctx }) {
  const { mode, idx, setIdx, picks, results, marked, reviewItems, reviewTotal, reviewGraduated, reviewLoading, details, displayResults, loadReview, items, onCheck, onPick, onFill, onSelf, onToggleShow, onMark } = ctx
  return (
    <>
{/* ---------- 今日复习 ---------- */}
{mode === 'review' && (
  reviewLoading && !reviewItems ? (
    <Loading text="读取复习队列…" />
  ) : reviewItems && reviewItems.length ? (
    <RunView
      items={items}
      idx={idx}
      setIdx={setIdx}
      picks={picks}
      results={displayResults}
      marked={marked}
      details={details}
      onPick={onPick}
      onFill={onFill}
      onSelf={onSelf}
      onCheck={onCheck}
      onToggleShow={onToggleShow}
      onMark={onMark}
      emptyTitle="今日复习已清空"
      emptyHint="没有到期需要复习的题，明天再来。"
      header={
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
          <span className="text-gray-600">
            待复习 <span className="font-mono">{reviewTotal}</span> 道 · 本轮 <span className="font-mono">{items.length}</span> 道
            {reviewGraduated > 0 && <span className="text-gray-400"> · 已毕业 {reviewGraduated}</span>}
          </span>
          <button type="button" onClick={loadReview} className="n-btn ml-auto border border-gray-200 px-2">
            刷新队列
          </button>
        </div>
      }
    />
  ) : (
    <Empty title="今日复习已清空" hint="没有到期需要复习的题，明天再来。答对连对 3 次的题会「毕业」不再出现。" />
  )
)}

    </>
  )
}
