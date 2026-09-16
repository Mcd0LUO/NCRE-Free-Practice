import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './Sidebar.jsx'
import CategoryTree from './CategoryTree.jsx'
import RunView from './RunView.jsx'
import { Tag, ProgressBar, Icon, Loading, Empty } from './components.jsx'
import { grade, KIND_LABEL } from './grading'
import * as api from './api.js'

const EMPTY = []

export default function App() {
  const [banks, setBanks] = useState([])
  const [bank, setBank] = useState(null)
  const [stats, setStats] = useState(null)
  const [mode, setMode] = useState('category')
  const [sidebar, setSidebar] = useState(false)
  const [tree, setTree] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 1024))

  // 分类练习
  const [sel, setSel] = useState(null)
  const [kindFilter, setKindFilter] = useState('')
  const [list, setList] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  // 答题
  const [idx, setIdx] = useState(0)
  const [picks, setPicks] = useState({})
  const [results, setResults] = useState({})
  const [marked, setMarked] = useState(() => new Set())

  // 考试
  const [paperList, setPaperList] = useState([])
  const [exam, setExam] = useState(null)
  const [examLeft, setExamLeft] = useState(0)
  const [examSubmitted, setExamSubmitted] = useState(false)

  // 错题本
  const [wrong, setWrong] = useState(null)

  const reqId = useRef(0)

  // ---------- 初始化 ----------
  useEffect(() => {
    api.getBanks().then((b) => {
      setBanks(b)
      setBank(b[0]?.id ?? null)
    })
  }, [])

  const refreshStats = useCallback(() => {
    if (!bank) return
    const id = ++reqId.current
    api.getStats(bank).then((s) => {
      if (id === reqId.current) setStats(s)
    })
  }, [bank])

  useEffect(() => {
    if (bank) refreshStats()
  }, [bank, refreshStats])

  const resetRun = useCallback(() => {
    setIdx(0)
    setPicks({})
    setResults({})
  }, [])

  // ---------- 分类：加载题目 ----------
  const loadCategory = useCallback(
    (s, kind, p = 1) => {
      if (!bank || !s) return
      const id = ++reqId.current
      setLoading(true)
      api
        .getQuestions(bank, { part: s.part, sec: s.sec, kind, page: p, size: 100 })
        .then((r) => {
          if (id !== reqId.current) return
          setList(r.items)
          setTotal(r.total)
          setPage(r.page)
        })
        .catch(() => {
          if (id === reqId.current) setList(EMPTY)
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false)
        })
    },
    [bank],
  )

  // 关键：只在进入分类 / 切题库时重新加载；kindFilter 变化也重载
  useEffect(() => {
    if (mode !== 'category' || !sel) return
    resetRun()
    loadCategory(sel, kindFilter, 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bank, sel, kindFilter])

  // ---------- 错题本 ----------
  useEffect(() => {
    if (mode !== 'wrong' || !bank) return
    resetRun()
    setWrong(null)
    api.getWrong(bank).then((r) => setWrong(r.items))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bank, results])

  // ---------- 考试 ----------
  useEffect(() => {
    if (mode !== 'exam' || !bank) return
    setPaperList([])
    api.getPapers(bank).then(setPaperList)
  }, [mode, bank])

  useEffect(() => {
    if (!exam || examSubmitted) return
    const t = setInterval(() => setExamLeft((v) => (v <= 0 ? 0 : v - 1)), 1000)
    return () => clearInterval(t)
  }, [exam, examSubmitted])

  const loadPaper = async (ver, group) => {
    const p = await api.getPaper(bank, ver, group)
    resetRun()
    setExamSubmitted(false)
    setExam({ ...p, items: p.sections.flatMap((s) => s.items) })
    setExamLeft((banks.find((b) => b.id === bank)?.timeMin ?? 90) * 60)
    window.scrollTo({ top: 0 })
  }

  // ---------- 作答 ----------
  const items = useMemo(() => {
    if (mode === 'category') return list ?? EMPTY
    if (mode === 'wrong') return wrong ?? EMPTY
    if (mode === 'exam') return exam?.items ?? EMPTY
    return EMPTY
  }, [mode, list, wrong, exam])

  const item = items[idx]

  const submit = useCallback(
    async (r) => {
      if (!item) return
      setResults((s) => ({ ...s, [item.id]: { ...r, revealed: true } }))
      // 错题本模式下答对：立即从列表移除，给出即时反馈
      if (mode === 'wrong' && r.state === 'ok') {
        setWrong((list) => (list || []).filter((x) => x.id !== item.id))
      }
      const pick = picks[item.id] || {}
      try {
        await api.postAnswer({
          bank,
          id: item.id,
          ok: r.state === 'ok',
          state: r.state, // 保留「部分正确」，否则后端无法区分
          score: r.score,
          letters: pick.letters,
          fills: pick.fills,
        })
      } catch {
        /* 记录失败不阻塞练习 */
      }
      refreshStats()
    },
    [item, picks, bank, refreshStats, mode],
  )

  const onCheck = useCallback(() => {
    if (!item || results[item.id]) return
    const r = grade(item, picks[item.id])
    if (r.state === 'none') {
      if (!window.confirm('还没有作答，直接看答案吗？')) return
      submit({ state: 'bad', score: 0, full: item.score })
      return
    }
    submit(r)
  }, [item, picks, results, submit])

  const onPick = useCallback(
    (L) => {
      if (!item || results[item.id]) return
      const cur = picks[item.id]?.letters || ''
      let next
      if (item.kind === 'single') next = cur === L ? '' : L
      else next = (cur.includes(L) ? cur.replace(L, '') : cur + L).split('').sort().join('')
      setPicks((s) => ({ ...s, [item.id]: { ...s[item.id], letters: next } }))
    },
    [item, picks, results],
  )

  const onFill = useCallback(
    (slot, val) => {
      if (!item) return
      setPicks((s) => {
        const p = { ...(s[item.id] || {}) }
        p.fills = [...(p.fills || [])]
        p.fills[slot] = val
        return { ...s, [item.id]: p }
      })
    },
    [item],
  )

  const onSelf = useCallback(
    (v) => submit({ state: v, score: v === 'ok' ? item.score : 0, full: item.score }),
    [submit, item],
  )

  const onToggleShow = useCallback(() => {
    if (!item) return
    setResults((s) => {
      const r = s[item.id]
      if (!r) return s
      return { ...s, [item.id]: { ...r, revealed: !r.revealed } }
    })
  }, [item])

  const onMark = useCallback((id) => {
    setMarked((prev) => {
      const next = new Set(prev)
      const on = !next.has(id)
      if (on) next.add(id)
      else next.delete(id)
      api.postAnswer && fetch('/api/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, on }),
      }).catch(() => {})
      return next
    })
  }, [])

  const go = useCallback(
    (d) => {
      setIdx((i) => {
        const n = i + d
        if (n < 0 || n >= items.length) return i
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return n
      })
    },
    [items.length],
  )

  // 键盘
  useEffect(() => {
    const h = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        if (e.key === 'Enter' && tag === 'INPUT') {
          e.preventDefault()
          if (item && !results[item.id]) onCheck()
          else go(1)
        }
        return
      }
      if (e.key === 'ArrowLeft') return go(-1)
      if (e.key === 'ArrowRight') return go(1)
      if (e.key === 'Enter') {
        e.preventDefault()
        if (item && !results[item.id]) onCheck()
        else go(1)
        return
      }
      let L = null
      if (/^[a-eA-E]$/.test(e.key)) L = e.key.toUpperCase()
      if (/^[1-5]$/.test(e.key)) L = 'ABCDE'[+e.key - 1]
      if (L && item) onPick(L)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [item, results, onCheck, go, onPick])

  // ---------- 派生 ----------
  const runStats = useMemo(() => {
    let done = 0
    let right = 0
    let score = 0
    let full = 0
    for (const r of Object.values(results)) {
      if (!r) continue
      done++
      score += r.score || 0
      full += r.full || 0
      if (r.state === 'ok') right++
    }
    return { done, right, score, full }
  }, [results])

  const currentBank = banks.find((b) => b.id === bank)
  const sections = stats?.sections || []
  const parts = stats?.parts || []
  const sectionsOf = (partId) => sections.filter((s) => s.part === +partId)

  const switchBank = (id) => {
    setBank(id)
    setSel(null)
    setExam(null)
    setList(null)
    setWrong(null)
    resetRun()
  }

  const examTimeUp = exam && examLeft <= 0 && !examSubmitted

  // 面包屑：层级随模式变化，最后一级不可点，其余可点回退
  const crumbs = useMemo(() => {
    const base = [{ label: currentBank?.name || '—', onClick: () => { setSel(null); setExam(null); setMode('category') } }]
    if (mode === 'category') {
      base.push({ label: '分类练习', onClick: () => { setSel(null); setList(null) } })
      if (sel) {
        base.push({
          label: sections.find((s) => s.part === sel.part && s.sec === sel.sec)?.secName || '知识点',
        })
      }
    } else if (mode === 'exam') {
      base.push({ label: '模拟考试', onClick: () => setExam(null) })
      if (exam) base.push({ label: exam.date + ' 第' + exam.group + '套' })
    } else {
      base.push({ label: '错题本' })
    }
    return base
  }, [mode, sel, exam, currentBank, sections])

  const showTree = mode === 'category' && !!sel && !!stats

  return (
    <div className="flex min-h-screen">
      <Sidebar
        banks={banks}
        bank={bank}
        onBank={switchBank}
        mode={mode}
        onMode={(m) => {
          setMode(m)
          setExam(null)
          setSel(null)
          setSidebar(false)
          resetRun()
        }}
        stats={stats}
        wrongCount={stats?.wrong || 0}
        open={sidebar}
        onClose={() => setSidebar(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏 */}
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 px-4 py-2.5 md:px-6">
            <button
              type="button"
              onClick={() => setSidebar(true)}
              className="n-btn px-2 py-1 md:hidden"
              aria-label="打开侧边栏"
            >
              <Icon name="list" />
            </button>

            {showTree && (
              <button
                type="button"
                onClick={() => setTree((v) => !v)}
                aria-pressed={tree}
                aria-label={tree ? '收起分类列表' : '展开分类列表'}
                className="n-btn px-2 py-1"
              >
                <Icon name="list" className="h-3.5 w-3.5" />
              </button>
            )}

            {/* 可点击面包屑 */}
            <nav className="flex min-w-0 items-center gap-1 text-sm" aria-label="面包屑">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1
                return (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="shrink-0 text-gray-300">/</span>}
                    {last || !c.onClick ? (
                      <span className="truncate font-medium text-[#37352f]" aria-current="page">
                        {c.label}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={c.onClick}
                        className="n-btn shrink-0 truncate px-1.5 py-0.5 text-sm text-gray-500 hover:bg-[#efedea]"
                      >
                        {c.label}
                      </button>
                    )}
                  </React.Fragment>
                )
              })}
            </nav>

            {mode === 'exam' && exam && (
              <span className="ml-auto flex items-center gap-3">
                <span className="font-mono text-sm tabular-nums text-[#37352f]">
                  {String(Math.floor(examLeft / 60)).padStart(2, '0')}:{String(examLeft % 60).padStart(2, '0')}
                </span>
              </span>
            )}
          </div>
          <ProgressBar value={items.length ? idx + 1 : 0} max={items.length} className="rounded-none" />
        </header>

        <div className="flex min-h-0 flex-1">
          {/* 题目区左侧：可滚动分类树（独立于最左工具栏） */}
          {showTree && tree && (
            <>
              <div className="hidden w-60 shrink-0 lg:block">
                <div className="sticky top-[46px] h-[calc(100vh-46px)]">
                  <CategoryTree
                    parts={parts}
                    sections={sections}
                    sel={sel}
                    onSelect={(s) => {
                      setSel(s)
                      setKindFilter('')
                      window.scrollTo({ top: 0 })
                    }}
                    onClose={() => setTree(false)}
                  />
                </div>
              </div>
              {/* 窄屏：抽屉 */}
              <div className="fixed inset-0 z-30 lg:hidden">
                <div className="absolute inset-0 bg-black/20" onClick={() => setTree(false)} aria-hidden="true" />
                <div className="absolute inset-y-0 left-0 w-64">
                  <CategoryTree
                    parts={parts}
                    sections={sections}
                    sel={sel}
                    onSelect={(s) => {
                      setSel(s)
                      setKindFilter('')
                      setTree(false)
                      window.scrollTo({ top: 0 })
                    }}
                    onClose={() => setTree(false)}
                  />
                </div>
              </div>
            </>
          )}

          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-24 md:px-6">
          {/* 总览 */}
          {stats && mode !== 'exam' && (
            <section className="mb-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="font-medium text-[#37352f]">总进度</span>
                <span className="text-gray-600">
                  已做 <span className="font-mono">{stats.done}</span> / {stats.total}
                </span>
              </div>

              {/* 客观题：自动判分，正确率以此为准 */}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <span className="w-16 shrink-0 text-gray-500">客观题</span>
                <span className="text-gray-600">
                  <span className="font-mono">{stats.objective?.done || 0}</span>
                  <span className="text-gray-400"> / {stats.objective?.total || 0}</span>
                </span>
                <span className="text-[#0f7b6c]">
                  ✓ <span className="font-mono">{stats.objective?.right || 0}</span>
                </span>
                {stats.objective?.partial > 0 && (
                  <span className="text-[#dfab01]">
                    ◐ <span className="font-mono">{stats.objective.partial}</span>
                  </span>
                )}
                <span className="text-[#eb5757]">
                  ✕ <span className="font-mono">{stats.objective?.wrong || 0}</span>
                </span>
                <span className="ml-auto text-gray-600">
                  正确率{' '}
                  <span className="font-mono font-medium text-[#37352f]">
                    {Math.round((stats.objective?.accuracy || 0) * 100)}%
                  </span>
                </span>
              </div>
              <ProgressBar value={stats.objective?.done || 0} max={stats.objective?.total || 1} className="mt-2" />

              {/* 主观题：自评，不计入正确率 */}
              {stats.subjective?.total > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                  <span className="w-16 shrink-0 text-gray-500">主观题</span>
                  <span className="text-gray-600">
                    <span className="font-mono">{stats.subjective.done}</span>
                    <span className="text-gray-400"> / {stats.subjective.total}</span>
                  </span>
                  <span className="text-[#0f7b6c]">
                    自评对 <span className="font-mono">{stats.subjective.ok}</span>
                  </span>
                  <span className="text-[#eb5757]">
                    自评错 <span className="font-mono">{stats.subjective.bad}</span>
                  </span>
                  <span className="ml-auto text-xs text-gray-400">自评不计入正确率</span>
                </div>
              )}

              {stats.full > 0 && (
                <p className="mt-2 text-xs text-gray-400">
                  客观题得分 <span className="font-mono">{stats.earned.toFixed(1)}</span> / {stats.full}
                </p>
              )}
            </section>
          )}

          {/* ---------- 分类选择 ---------- */}
          {mode === 'category' && !sel && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold text-[#37352f] md:text-2xl">选择练习分类</h1>
                <p className="mt-1 text-sm text-gray-600">
                  共 {parts.length} 个大类、{sections.length} 个知识点。分类来自原题库的组卷结构。
                </p>
              </div>

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
                  results={results}
                  marked={marked}
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

          {/* ---------- 错题本 ---------- */}
          {mode === 'wrong' && (
            <RunView
              items={wrong}
              idx={idx}
              setIdx={setIdx}
              picks={picks}
              results={results}
              marked={marked}
              onPick={onPick}
              onFill={onFill}
              onSelf={onSelf}
              onCheck={onCheck}
              onToggleShow={onToggleShow}
              onMark={onMark}
              emptyTitle="错题本是空的"
              emptyHint="先去分类练习做题，答错的题会自动汇总到这里。"
            />
          )}

          {/* ---------- 考试：选卷 ---------- */}
          {mode === 'exam' && !exam && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold text-[#37352f] md:text-2xl">选择试卷</h1>
                <p className="mt-1 text-sm text-gray-600">
                  共 {paperList.length} 套，每套限时 {currentBank?.timeMin} 分钟。倒计时结束自动提醒交卷。
                </p>
              </div>
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
              results={results}
              marked={marked}
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
                <button
                  type="button"
                  disabled={examSubmitted}
                  onClick={() => {
                    const answered = Object.keys(results).length
                    const ok = window.confirm(
                      '确定交卷？\n\n已作答 ' + answered + ' / ' + items.length + '，未作答按 0 分计。',
                    )
                    if (!ok) return
                    setExamSubmitted(true)
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
                  className="rounded-md bg-[#2eaadc] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#2898c4] active:bg-[#2388b0] disabled:opacity-40"
                >
                  {examSubmitted ? '已交卷' : '交卷'}
                </button>
              }
            />
          )}
          </main>
        </div>
      </div>

      {/* 底部操作栏 */}
      {item && (
        <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={idx === 0}
              className="n-btn flex items-center gap-1 border border-gray-200 px-2"
            >
              <Icon name="chevronLeft" className="h-3.5 w-3.5" />
              上一题
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={idx >= items.length - 1}
              className="n-btn flex items-center gap-1 border border-gray-200 px-2"
            >
              下一题
              <Icon name="chevronRight" className="h-3.5 w-3.5" />
            </button>
            <span className="ml-auto font-mono text-xs text-gray-400">
              已答 {runStats.done}
              {runStats.full ? ' · ' + runStats.score.toFixed(1) + '/' + runStats.full.toFixed(1) : ''}
            </span>
          </div>
        </footer>
      )}
    </div>
  )
}
