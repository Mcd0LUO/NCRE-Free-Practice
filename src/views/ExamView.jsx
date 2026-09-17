import React from 'react'
import RunView from '../RunView.jsx'
import { Tag, Icon, Loading } from '../components.jsx'
import * as api from '../api.js'

export default function ExamView({ ctx }) {
  const { banks, bank, mode, total, idx, setIdx, picks, setPicks, results, setResults, setFreshIds, marked, paperList, exam, setExam, setExamLeft, setExamSubmitted, examResult, setExamResult, savedExam, setSavedExam, notes, details, refreshStats, resetRun, displayResults, items, loadPaper, locked, onCheck, onPick, onFill, onSelf, onToggleShow, onMark, runStats, currentBank, saveNote, saveExpl, examTimeUp } = ctx
  return (
    <>
{/* ---------- 考试：选卷 ---------- */}
{mode === 'exam' && !exam && (
  <div className="space-y-4">
    <div>
      <h1 className="text-xl font-semibold text-[#37352f] md:text-2xl">选择试卷</h1>
      <p className="mt-1 text-sm text-gray-600">
        共 {paperList.length} 套，每套限时 {currentBank?.timeMin} 分钟。倒计时结束自动提醒交卷。
      </p>
    </div>

    {savedExam && (
      <div className="rounded-lg border border-[#2eaadc]/40 bg-blue-50/60 p-3">
        <p className="text-sm text-[#37352f]">
          上次有一场未完成的考试：
          <span className="font-medium">
            {savedExam.ver} 第 {savedExam.group} 套
          </span>
          {Number.isFinite(savedExam.left) && (
            <span className="ml-2 font-mono text-xs text-gray-500">
              剩余 {String(Math.floor(savedExam.left / 60)).padStart(2, '0')}:
              {String(savedExam.left % 60).padStart(2, '0')}
            </span>
          )}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => loadPaper(savedExam.ver, savedExam.group, savedExam)}
            className="rounded-md bg-[#2eaadc] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2898c4]"
          >
            继续考试
          </button>
          <button
            type="button"
            onClick={() => {
              api.delExam().catch(() => {})
              setSavedExam(null)
            }}
            className="n-btn border border-gray-200 text-gray-600"
          >
            放弃
          </button>
        </div>
      </div>
    )}

    {!paperList.length ? (
      <Loading text="读取试卷列表…" />
    ) : (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {paperList
          .slice()
          .reverse()
          .slice(0, 60)
          .map((p) => (
            <button
              key={p.ver + '-' + p.group}
              type="button"
              onClick={() => loadPaper(p.ver, p.group)}
              className="group rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition-colors duration-150 hover:bg-[#efedea] active:bg-[#e3e1db]"
            >
              <div className="flex items-center gap-2">
                <span className="n-handle text-gray-300">
                  <Icon name="grip" className="h-3.5 w-3.5" />
                </span>
                <span className="font-medium text-[#37352f]">{p.date}</span>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                第 {p.group} 套 · {p.count} 题
              </p>
            </button>
          ))}
      </div>
    )}
  </div>
)}

{/* ---------- 考试：作答 ---------- */}
{mode === 'exam' && exam && (
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
    locked={locked}
    onPick={onPick}
    onFill={onFill}
    onSelf={onSelf}
    onCheck={onCheck}
    onToggleShow={onToggleShow}
    onMark={onMark}
    emptyTitle="试卷为空"
    emptyHint="该套试卷在原库中缺少题目数据。"
    header={
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
        <Tag tone="blue">
          {exam.date} 第 {exam.group} 套
        </Tag>
        <span className="text-gray-600">共 {items.length} 题</span>
        {examTimeUp && <span className="text-[#eb5757]">时间到</span>}
        <button
          type="button"
          onClick={() => {
            if (!window.confirm('重置本场考试？\n\n本套试卷已作答的记录会被清空，计时重新开始。')) return
            const ids = items.map((it) => it.id)
            api.postReset({ scope: 'items', ids }).catch(() => {})
            const total = (banks.find((b) => b.id === bank)?.timeMin ?? 90) * 60
            const startedAt = Date.now()
            setResults((s) => {
              const n = { ...s }
              for (const id of ids) delete n[id]
              return n
            })
            setPicks({})
            setFreshIds(new Set(ids))
            setExamSubmitted(false)
            setExamResult(null)
            setExamLeft(total)
            setExam((e) => (e ? { ...e, startedAt } : e))
            api
              .postExam({ bank, ver: exam.ver, group: exam.group, left: total, picks: {}, startedAt })
              .catch(() => {})
            refreshStats()
          }}
          className="n-btn px-2 text-gray-600"
        >
          重置本场
        </button>
        <button
          type="button"
          onClick={() => {
            api.delExam().catch(() => {})
            setSavedExam(null)
            setExam(null)
            resetRun()
          }}
          className="n-btn ml-auto px-2 text-gray-600"
        >
          退出
        </button>
      </div>
    }
    footer={
      examResult ? (
        <div className="rounded-md bg-gray-50 px-3 py-2.5 text-sm">
          <p className="mb-1 font-medium text-[#37352f]">
            {examResult.auto ? '时间到，已自动交卷' : '已交卷'}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-gray-600">
            <span>
              作答 <span className="font-mono">{examResult.answered}</span> / {examResult.total}
            </span>
            <span className="text-[#0f7b6c]">
              ✓ <span className="font-mono">{examResult.right}</span>
            </span>
            <span>
              得分{' '}
              <span className="font-mono font-medium text-[#37352f]">
                {examResult.score.toFixed(1)} / {examResult.full || '—'}
              </span>
            </span>
            <span className="text-gray-400">
              未作答 <span className="font-mono">{examResult.total - examResult.answered}</span> 题按 0 分计
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            const answered = items.reduce((n, it) => n + (displayResults[it.id] ? 1 : 0), 0)
            const ok = window.confirm(
              '确定交卷？\n\n已作答 ' + answered + ' / ' + items.length + '，未作答按 0 分计。',
            )
            if (!ok) return
            api.delExam().catch(() => {})
            setSavedExam(null)
            setExamSubmitted(true)
            setExamResult({
              total: items.length,
              answered,
              right: runStats.right,
              score: runStats.score,
              full: runStats.full,
              auto: false,
            })
            api
              .postSession({
                bank,
                ver: exam.ver,
                group: exam.group,
                total: items.length,
                answered,
                right: runStats.right,
                score: runStats.score,
                full: runStats.full,
              })
              .catch(() => {})
          }}
          className="rounded-md bg-[#2eaadc] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#2898c4] active:bg-[#2388b0]"
        >
          交卷
        </button>
      )
    }
  />
)}
    </>
  )
}
