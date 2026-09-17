import React from 'react'
import RunView from '../RunView.jsx'
import { Tag, Icon, Loading, Empty, Highlight } from '../components.jsx'

export default function SearchView({ ctx }) {
  const { bank, mode, total, idx, setIdx, picks, results, setFreshIds, marked, notes, details, searchQ, setSearchQ, searchKind, setSearchKind, searchRes, searching, searchOpen, setSearchOpen, searchPart, setSearchPart, searchParts, searchItems, resetRun, displayResults, runSearch, items, onCheck, onPick, onFill, onSelf, onToggleShow, onMark, saveNote, saveExpl } = ctx
  return (
    <>
{/* ---------- 全局搜索 ---------- */}
{mode === 'search' && (
  <div className="space-y-4">
    <div>
      <h1 className="text-xl font-semibold text-[#37352f] md:text-2xl">全局搜索</h1>
      <p className="mt-1 text-sm text-gray-600">在题干与选项中检索关键词，跨分类查找。</p>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <input
        value={searchQ}
        onChange={(e) => setSearchQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') runSearch(searchQ, searchKind)
        }}
        placeholder="输入关键词后回车，例如：索引 / 事务 / SQL Server"
        aria-label="搜索关键词"
        className="n-input min-w-0 flex-1 px-3 py-2 text-sm"
      />
      <select
        value={searchKind}
        onChange={(e) => {
          setSearchKind(e.target.value)
          if (searchQ.trim()) runSearch(searchQ, e.target.value)
        }}
        className="n-input px-2 py-2 text-sm"
        aria-label="题型筛选"
      >
        <option value="">全部题型</option>
        <option value="single">单选题</option>
        <option value="multi">多选题</option>
        <option value="fill">填空题</option>
        <option value="essay">设计与应用题</option>
      </select>
      <button
        type="button"
        onClick={() => runSearch(searchQ, searchKind)}
        className="rounded-md bg-[#2eaadc] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#2898c4] active:bg-[#2388b0]"
      >
        搜索
      </button>
    </div>

    {searching && <Loading text="搜索中…" />}

    {!searching && searchRes && (
      <>
        <p className="text-sm text-gray-600">
          找到 <span className="font-mono font-medium">{searchRes.total}</span> 道
          {searchRes.truncated && <span className="text-gray-400">（仅显示前 300 条）</span>}
          {searchPart ? <span className="text-gray-400">（当前分类 {searchItems.length} 道）</span> : null}
        </p>
        {searchParts.length > 1 && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            分类
            <select
              value={searchPart}
              onChange={(e) => setSearchPart(+e.target.value)}
              className="n-input px-2 py-1.5 text-sm"
            >
              <option value={0}>全部</option>
              {searchParts.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
        )}
        {searchRes.total === 0 ? (
          <Empty title="没有匹配的题目" hint="换个关键词试试，或清除题型筛选。" />
        ) : (
          <ul className="space-y-1.5">
            {searchItems.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    api
                      .getQuestion(bank, h.id)
                      .then((full) => {
                        setSearchOpen(full)
                        setFreshIds(new Set())
                        resetRun()
                        window.scrollTo({ top: 0 })
                      })
                      .catch(() => {})
                  }}
                  className="group w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors duration-150 hover:bg-[#efedea] active:bg-[#e3e1db]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="n-handle text-gray-300">
                      <Icon name="grip" className="h-3.5 w-3.5" />
                    </span>
                    <Tag tone="gray">{h.partName}</Tag>
                    <Tag tone="gray">{h.secName}</Tag>
                    {h.where === 'option' && <Tag tone="yellow">选项命中</Tag>}
                    <span className="ml-auto font-mono text-xs text-gray-400">ID {h.id}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-[#37352f]">
                    <Highlight text={h.stem} term={searchQ} />
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </>
    )}

    {!searching && !searchRes && (
      <Empty title="输入关键词开始搜索" hint="支持题干与选项全文匹配，回车即搜。" />
    )}
  </div>
)}

{/* 搜索命中 → 单题查看 */}
{mode === 'search' && searchOpen && (
  <div className="mt-4 space-y-3">
    <button
      type="button"
      onClick={() => setSearchOpen(null)}
      className="n-btn flex items-center gap-1 px-2"
    >
      <Icon name="chevronLeft" className="h-3.5 w-3.5" />
      返回搜索结果
    </button>
    <RunView
      items={items}
      idx={0}
      setIdx={() => {}}
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
    />
  </div>
)}

    </>
  )
}
