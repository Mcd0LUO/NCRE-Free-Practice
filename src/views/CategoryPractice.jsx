import React from 'react'
import RunView from '../RunView.jsx'
import { Icon, Loading } from '../components.jsx'

export default function CategoryPractice({ ctx }) {
  const { mode, sel, setSel, kindFilter, setKindFilter, setList, total, page, loading, idx, setIdx, picks, results, marked, notes, details, displayResults, loadCategory, items, onCheck, onPick, onFill, onSelf, onToggleShow, onMark, saveNote, saveExpl } = ctx
  return (
    <>
{/* ---------- 分类练习 ---------- */}
{mode === 'category' && sel && (
  <>
    {loading && !items.length ? (
      <Loading />
    ) : (
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
        emptyTitle="该分类下没有题目"
        emptyHint="换一个知识点，或清除题型筛选后重试。"
        header={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSel(null)
                setList(null)
                setKindFilter('')
              }}
              className="n-btn flex items-center gap-1 px-2"
            >
              <Icon name="chevronLeft" className="h-3.5 w-3.5" />
              返回分类
            </button>
            <label className="ml-auto flex items-center gap-2 text-sm text-gray-600">
              题型
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                className="n-input px-2 py-1.5 text-sm"
              >
                <option value="">全部</option>
                <option value="single">单选题</option>
                <option value="multi">多选题</option>
                <option value="fill">填空题</option>
                <option value="essay">设计与应用题</option>
              </select>
            </label>
          </div>
        }
        footer={
          total > items.length ? (
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => loadCategory(sel, kindFilter, page - 1)}
                className="n-btn border border-gray-200"
              >
                上一页
              </button>
              <span className="text-gray-600">
                第 {page} / {Math.ceil(total / 100)} 页（共 {total} 题）
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(total / 100)}
                onClick={() => loadCategory(sel, kindFilter, page + 1)}
                className="n-btn border border-gray-200"
              >
                下一页
              </button>
            </div>
          ) : null
        }
      />
    )}
  </>
)}

    </>
  )
}
