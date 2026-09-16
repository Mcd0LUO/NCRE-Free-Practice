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
  // 本轮仍需重刷的题 id（错题本 / 标记题 / 考试）：即使服务端已有作答记录，
  // 也从展示层隐藏，允许重新作答；一旦作答即从集合移除。
  const [freshIds, setFreshIds] = useState(() => new Set())
  const [marked, setMarked] = useState(() => new Set())
  const [hydrated, setHydrated] = useState(false)
  // 题目 id -> 题目对象，供水合时补全分值；避免为每道已答题单独请求
  const byIdRef = useRef(new Map())

  // 考试
  const [paperList, setPaperList] = useState([])
  const [exam, setExam] = useState(null)
  const [examLeft, setExamLeft] = useState(0)
  const [examSubmitted, setExamSubmitted] = useState(false)
  const [examResult, setExamResult] = useState(null)
  // 服务端保存的「进行中考试」：刷新 / 换设备后续考
  const [savedExam, setSavedExam] = useState(null)
  const runStatsRef = useRef({ done: 0, right: 0, score: 0, full: 0 })
  const examLeftRef = useRef(0)
  const picksRef = useRef({})

  // 错题本
  const [wrong, setWrong] = useState(null)

  // 标记题
  const [markedList, setMarkedList] = useState(null)

  // 解析懒加载：id -> 完整题目（仅含被展开过解析的题）
  const [details, setDetails] = useState({})

  // 搜索
  const [searchQ, setSearchQ] = useState('')
  const [searchKind, setSearchKind] = useState('')
  const [searchRes, setSearchRes] = useState(null)
  const [searching, setSearching] = useState(false)
  // 搜索结果里点开某题时，用它承载题目对象
  const [searchOpen, setSearchOpen] = useState(null)

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

  // A1: 从服务端恢复已答状态与标记。
  // 服务端一直是权威数据源，此前前端只写不读，刷新即丢。
  useEffect(() => {
    if (!bank) return
    let alive = true
    setHydrated(false)
    api
      .getProgress(bank)
      .then((p) => {
        if (!alive) return
        const nextResults = {}
        const nextPicks = {}
        for (const [id, rec] of Object.entries(p.answers || {})) {
          nextResults[+id] = {
            state: rec.state || (rec.ok ? 'ok' : 'bad'),
            score: rec.score || 0,
            full: byIdRef.current?.get(+id)?.score ?? rec.full ?? 0,
            revealed: false,
            restored: true,
          }
          if (rec.letters || rec.fills) {
            nextPicks[+id] = { letters: rec.letters, fills: rec.fills }
          }
        }
        setResults(nextResults)
        setPicks(nextPicks)
        setMarked(new Set(Object.keys(p.marks || {}).map(Number)))
        setHydrated(true)
      })
      .catch(() => {
        if (alive) setHydrated(true)
      })
    return () => {
      alive = false
    }
  }, [bank])

  // 只重置浏览位置。已答记录（results/picks）是服务端水合出来的权威镜像，
  // 绝不能在这里清空 —— 否则进入分类/切换模式时会把刚恢复的作答状态抹掉，
  // 这正是「答完题刷新后进度消失」的根因。
  const resetRun = useCallback(() => {
    setIdx(0)
  }, [])

  // 展示层结果 = 已答记录 − 本轮要重刷的题。
  const displayResults = useMemo(() => {
    if (!freshIds.size) return results
    const out = {}
    for (const [id, r] of Object.entries(results)) {
      if (!freshIds.has(+id)) out[id] = r
    }
    return out
  }, [results, freshIds])

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
    setFreshIds(new Set())
    loadCategory(sel, kindFilter, 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bank, sel, kindFilter])

  // ---------- 错题本 ----------
  // 依赖里绝不能放 results：本 effect 会调用 resetRun()（setResults 新对象），
  // 而 results 若在依赖中，每次重置都会再次触发本 effect，形成无限渲染。
  // 答完题后列表由 submit() 就地更新，不需要重新拉取。
  useEffect(() => {
    if (mode !== 'wrong' || !bank) return
    resetRun()
    setWrong(null)
    api.getWrong(bank).then((r) => {
      setWrong(r.items)
      setFreshIds(new Set(r.items.map((x) => x.id)))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bank])

  // ---------- 标记题 ----------
  // 同理：marked 不放依赖，取消标记时就地移除，避免再次触发放置态的 effect。
  useEffect(() => {
    if (mode !== 'marked' || !bank) return
    resetRun()
    setMarkedList(null)
    api.getMarked(bank).then((r) => {
      setMarkedList(r.items)
      setFreshIds(new Set(r.items.map((x) => x.id)))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bank])

  // ---------- 搜索 ----------
  const runSearch = useCallback(
    (kw, kind, silent) => {
      if (!bank) return Promise.resolve()
      const term = (kw ?? '').trim()
      if (!term) {
        setSearchRes(null)
        return Promise.resolve()
      }
      if (!silent) setSearching(true)
      return api
        .search(bank, term, kind)
        .then(setSearchRes)
        .catch(() => setSearchRes(null))
        .finally(() => setSearching(false))
    },
    [bank],
  )

  // ---------- 考试 ----------
  useEffect(() => {
    if (mode !== 'exam' || !bank) return
    setPaperList([])
    api.getPapers(bank).then(setPaperList)
  }, [mode, bank])

  // 进入考试模式时，读取服务端是否有一场未完成的考试（用于续考提示）
  useEffect(() => {
    if (mode !== 'exam' || !bank) return
    let alive = true
    api
      .getExam()
      .then((e) => {
        if (alive) setSavedExam(e && String(e.bank) === String(bank) ? e : null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [mode, bank])

  useEffect(() => {
    if (!exam || examSubmitted) return
    const t = setInterval(() => setExamLeft((v) => (v <= 0 ? 0 : v - 1)), 1000)
    return () => clearInterval(t)
  }, [exam, examSubmitted])

  // 当前题目集合（分类 / 错题 / 标记 / 考试 / 搜索）。
  // 必须定义在依赖它的 effect 之前：依赖数组会在 render 期求值，
  // 放到后面会让下面的自动交卷 effect 触发 TDZ（Cannot access 'items' before initialization）。
  const items = useMemo(() => {
    if (mode === 'category') return list ?? EMPTY
    if (mode === 'wrong') return wrong ?? EMPTY
    if (mode === 'marked') return markedList ?? EMPTY
    if (mode === 'exam') return exam?.items ?? EMPTY
    if (mode === 'search') return searchOpen ? [searchOpen] : EMPTY
    return EMPTY
  }, [mode, list, wrong, markedList, exam, searchOpen])

  // A2: 倒计时归零自动交卷（此前只显示「时间到」，并不会真正收卷）
  useEffect(() => {
    if (!exam || examSubmitted || examLeft > 0) return
    setExamSubmitted(true)
    const answered = items.reduce((n, it) => n + (displayResults[it.id] ? 1 : 0), 0)
    api
      .postSession({
        bank,
        ver: exam.ver,
        group: exam.group,
        total: exam.items.length,
        answered,
        right: runStatsRef.current.right,
        score: runStatsRef.current.score,
        full: runStatsRef.current.full,
        auto: true,
      })
      .catch(() => {})
    api.delExam().catch(() => {})
    setSavedExam(null)
    setExamResult({
      total: exam.items.length,
      answered,
      right: runStatsRef.current.right,
      score: runStatsRef.current.score,
      full: runStatsRef.current.full,
      auto: true,
    })
  }, [exam, examSubmitted, examLeft, bank, displayResults, items])

  // 考试进行中：周期性把剩余时间与当前选择写回服务端，刷新 / 换设备即可续考
  useEffect(() => {
    if (mode !== 'exam' || !exam || examSubmitted) return
    const save = () =>
      api
        .postExam({
          bank,
          ver: exam.ver,
          group: exam.group,
          left: examLeftRef.current,
          picks: picksRef.current,
          startedAt: exam.startedAt,
        })
        .catch(() => {})
    const t = setTimeout(save, 1200)
    const iv = setInterval(save, 15000)
    const onHide = () => {
      if (document.visibilityState === 'hidden') save()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      clearTimeout(t)
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [mode, exam, examSubmitted, bank])

  const loadPaper = async (ver, group, resume = null) => {
    const p = await api.getPaper(bank, ver, group)
    const flat = p.sections.flatMap((s) => s.items)
    const total = (banks.find((b) => b.id === bank)?.timeMin ?? 90) * 60
    const left = resume && Number.isFinite(resume.left) ? resume.left : total
    const startedAt = (resume && resume.startedAt) || Date.now()
    const picks0 = (resume && resume.picks) || {}
    resetRun()
    setExamSubmitted(false)
    setExamResult(null)
    setPicks(picks0)
    setFreshIds(new Set(flat.map((x) => x.id)))
    setExam({ ...p, items: flat, startedAt })
    setExamLeft(left)
    api
      .postExam({ bank, ver: p.ver, group: p.group, left, picks: picks0, startedAt })
      .catch(() => {})
    window.scrollTo({ top: 0 })
  }

  // 刷新题目集合的 id 索引
  useEffect(() => {
    for (const it of items) byIdRef.current.set(it.id, it)
  }, [items])

  const rawItem = items[idx]
  // 合并懒加载到的解析，保持展示层字段完整
  const item = rawItem && details[rawItem.id] ? { ...rawItem, ...details[rawItem.id] } : rawItem

  // 解析懒加载：解析区块一旦可见（判分后 revealed=true，或用户点开）就拉一次全量。
  // 原先只在 onToggleShow 里取，但判分时 revealed 已置 true，用户不会再点按钮，
  // 导致解析区块展开却是空的。
  const curId = item?.id
  const curRevealed = curId != null ? !!displayResults[curId]?.revealed : false
  useEffect(() => {
    if (curId == null || !curRevealed) return
    if (details[curId]) return // 已取过（解析本身可能为空，也算取过）
    let alive = true
    api
      .getDetail(bank, curId)
      .then((full) => {
        if (alive && full) setDetails((d) => ({ ...d, [curId]: full }))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [curId, curRevealed, details, bank])

  const submit = useCallback(
    async (r) => {
      if (!item) return
      setResults((s) => ({ ...s, [item.id]: { ...r, revealed: true } }))
      // 本题已重新作答 → 取消「待重刷」标记，结果立即展示
      setFreshIds((prev) => {
        if (!prev.has(item.id)) return prev
        const n = new Set(prev)
        n.delete(item.id)
        return n
      })
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

  // 交卷后锁定作答。必须在 onCheck 之前声明：onCheck 的闭包会读取它，
  // 而 const 存在暂时性死区，放到后面会让渲染期调用直接抛 ReferenceError。
  const locked = mode === 'exam' && examSubmitted

  const onCheck = useCallback(() => {
    if (!item || displayResults[item.id] || locked) return
    const r = grade(item, picks[item.id])
    if (r.state === 'none') {
      if (!window.confirm('还没有作答，直接看答案吗？')) return
      submit({ state: 'bad', score: 0, full: item.score })
      return
    }
    submit(r)
  }, [item, picks, displayResults, submit, locked])

  const onPick = useCallback(
    (L) => {
      if (!item || displayResults[item.id] || locked) return
      const cur = picks[item.id]?.letters || ''
      let next
      if (item.kind === 'single') next = cur === L ? '' : L
      else next = (cur.includes(L) ? cur.replace(L, '') : cur + L).split('').sort().join('')
      setPicks((s) => ({ ...s, [item.id]: { ...s[item.id], letters: next } }))
    },
    [item, picks, displayResults, locked],
  )

  const onFill = useCallback(
    (slot, val) => {
      if (!item || locked) return
      setPicks((s) => {
        const p = { ...(s[item.id] || {}) }
        p.fills = [...(p.fills || [])]
        p.fills[slot] = val
        return { ...s, [item.id]: p }
      })
    },
    [item, locked],
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
      api.postMark(id, on).catch(() => {})
      // 标记题列表就地同步：取消标记时从列表移除，避免依赖 marked 触发重新拉取
      if (on) {
        const it = byIdRef.current.get(id)
        if (it) setMarkedList((list) => (list && !list.some((x) => x.id === id) ? [it, ...list] : list))
      } else {
        setMarkedList((list) => (list || []).filter((x) => x.id !== id))
      }
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
          if (item && !displayResults[item.id]) onCheck()
          else go(1)
        }
        return
      }
      if (e.key === 'ArrowLeft') return go(-1)
      if (e.key === 'ArrowRight') return go(1)
      if (e.key === 'Enter') {
        e.preventDefault()
        if (item && !displayResults[item.id]) onCheck()
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
  }, [item, displayResults, onCheck, go, onPick])

  // ---------- 派生 ----------
  // 统计只针对「当前题目集合」（分类 / 错题 / 标记 / 考试），
  // 否则会把整个题库的历史作答都算进来。
  const runStats = useMemo(() => {
    let done = 0
    let right = 0
    let score = 0
    let full = 0
    for (const it of items) {
      const r = displayResults[it.id]
      if (!r) continue
      done++
      score += r.score || 0
      full += r.full || 0
      if (r.state === 'ok') right++
    }
    return { done, right, score, full }
  }, [items, displayResults])

  runStatsRef.current = runStats
  examLeftRef.current = examLeft
  picksRef.current = picks

  const currentBank = banks.find((b) => b.id === bank)
  const sections = stats?.sections || []
  const parts = stats?.parts || []
  const sectionsOf = (partId) => sections.filter((s) => s.part === +partId)

  // 清空进度（本级别 / 全部）：服务端权威数据 + 本地镜像一起清
  const doReset = useCallback(
    (scope) => {
      const body = scope === 'bank' ? { bank, scope } : { scope }
      api
        .postReset(body)
        .then(() => {
          setResults({})
          setPicks({})
          setFreshIds(new Set())
          setWrong(null)
          setMarked(new Set())
          setMarkedList(null)
          setSavedExam(null)
          refreshStats()
        })
        .catch(() => {})
    },
    [bank, refreshStats],
  )

  const switchBank = (id) => {
    setBank(id)
    setSel(null)
    setExam(null)
    setList(null)
    setWrong(null)
    setFreshIds(new Set())
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
          setSearchOpen(null)
          setFreshIds(new Set())
          resetRun()
        }}
        stats={stats}
        wrongCount={stats?.wrong || 0}
        markedCount={marked.size}
        open={sidebar}
        onClose={() => setSidebar(false)}
        onReset={doReset}
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

          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-32 md:px-6">
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
                  results={displayResults}
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

          {/* ---------- 错题本 ---------- */}
          {mode === 'wrong' && (
            <RunView
              items={wrong}
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
              emptyTitle="错题本是空的"
              emptyHint="先去分类练习做题，答错的题会自动汇总到这里。"
            />
          )}

          {/* ---------- 标记题 ---------- */}
          {mode === 'marked' && (
            <RunView
              items={markedList}
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
              emptyTitle="还没有标记任何题目"
              emptyHint="做题时点右上角的旗标即可标记，标记的题会集中到这里。"
            />
          )}

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
                  </p>
                  {searchRes.total === 0 ? (
                    <Empty title="没有匹配的题目" hint="换个关键词试试，或清除题型筛选。" />
                  ) : (
                    <ul className="space-y-1.5">
                      {searchRes.items.map((h) => (
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
                            <p className="mt-1.5 line-clamp-2 text-sm text-[#37352f]">{h.stem}</p>
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
          </main>
        </div>
      </div>

      {/* 底部操作栏：n-safe-bottom 抬起，避开手机系统手势区 / 导航条 */}
      {item && (
        <footer className="n-safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 pt-2 md:px-6">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={idx === 0}
              className="n-btn flex min-h-[44px] flex-1 items-center justify-center gap-1 border border-gray-200 px-3 md:flex-none"
            >
              <Icon name="chevronLeft" className="h-3.5 w-3.5" />
              上一题
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={idx >= items.length - 1}
              className="n-btn flex min-h-[44px] flex-1 items-center justify-center gap-1 border border-gray-200 px-3 md:flex-none"
            >
              下一题
              <Icon name="chevronRight" className="h-3.5 w-3.5" />
            </button>
            <span className="ml-auto hidden font-mono text-xs text-gray-400 sm:inline">
              已答 {runStats.done}
              {runStats.full ? ' · ' + runStats.score.toFixed(1) + '/' + runStats.full.toFixed(1) : ''}
            </span>
          </div>
          <div className="mx-auto max-w-3xl px-4 sm:hidden">
            <span className="font-mono text-[11px] text-gray-400">
              已答 {runStats.done}
              {runStats.full ? ' · ' + runStats.score.toFixed(1) + '/' + runStats.full.toFixed(1) : ''}
            </span>
          </div>
        </footer>
      )}
    </div>
  )
}
