import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './Sidebar.jsx'
import CategoryTree from './CategoryTree.jsx'
import RunView from './RunView.jsx'
import { Tag, ProgressBar, Icon, Loading, Empty, Highlight } from './components.jsx'
import { grade, KIND_LABEL } from './grading'
import * as api from './api.js'
import { flush, pendingCount } from './offlineQueue.js'
import Login from './Login.jsx'
import Records from './Records.jsx'
import WeakPoints from './WeakPoints.jsx'
import FocusView from './views/FocusView.jsx'
import StatsPanel from './views/StatsPanel.jsx'
import CategoryHome from './views/CategoryHome.jsx'
import CategoryPractice from './views/CategoryPractice.jsx'
import NotesView from './views/NotesView.jsx'
import ReviewView from './views/ReviewView.jsx'
import RandomView from './views/RandomView.jsx'
import WrongView from './views/WrongView.jsx'
import MarkedView from './views/MarkedView.jsx'
import SearchView from './views/SearchView.jsx'
import ExamView from './views/ExamView.jsx'
import FooterBar from './views/FooterBar.jsx'
import Lightbox from './views/Lightbox.jsx'

const EMPTY = []

export default function App() {
  const [authed, setAuthed] = useState(null)
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
  const resultsRef = useRef({})
  const justAnsweredRef = useRef(null)
  const goRef = useRef(null)

  // 错题本
  const [wrong, setWrong] = useState(null)

  const [wrongSec, setWrongSec] = useState(0)

  // 今日复习（间隔重复）
  const [reviewItems, setReviewItems] = useState(null)
  const [reviewTotal, setReviewTotal] = useState(0)
  const [reviewGraduated, setReviewGraduated] = useState(0)
  const [reviewLoading, setReviewLoading] = useState(false)

  // 标记题
  const [markedList, setMarkedList] = useState(null)

  // 随机练习 / 智能组卷
  const [randomItems, setRandomItems] = useState(null)
  const [randomCount, setRandomCount] = useState(20)
  const [randomKind, setRandomKind] = useState('')
  const [randomSmart, setRandomSmart] = useState(true)
  const [randomLoading, setRandomLoading] = useState(false)

  // 笔记 / 单题聚焦（?q= 直达、笔记跳转）
  const [notes, setNotes] = useState({})
  const [notesList, setNotesList] = useState(null)
  const [focusItem, setFocusItem] = useState(null)
  // 图片灯箱 + 深色模式
  const [lightbox, setLightbox] = useState(null)
  const [theme, setTheme] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )
  // 离线待同步条数 + 练习偏好（答完自动下一题）
  const [pending, setPending] = useState(0)
  const [autoNext, setAutoNext] = useState(() => {
    try {
      return localStorage.getItem('ncre-autonext') === '1'
    } catch {
      return false
    }
  })

  // 解析懒加载：id -> 完整题目（仅含被展开过解析的题）
  const [details, setDetails] = useState({})

  // 搜索
  const [searchQ, setSearchQ] = useState('')
  const [searchKind, setSearchKind] = useState('')
  const [searchRes, setSearchRes] = useState(null)
  const [searching, setSearching] = useState(false)
  // 搜索结果里点开某题时，用它承载题目对象
  const [searchOpen, setSearchOpen] = useState(null)
  const [searchPart, setSearchPart] = useState(0)
  // 搜索结果按分类过滤 + 关键词高亮
  const searchParts = useMemo(() => {
    const m = new Map()
    for (const h of searchRes?.items || []) m.set(h.part, h.partName)
    return [...m.entries()]
  }, [searchRes])
  const searchItems = useMemo(() => {
    const items = searchRes?.items || []
    return searchPart ? items.filter((h) => h.part === searchPart) : items
  }, [searchRes, searchPart])

  const reqId = useRef(0)

  // ---------- 鉴权 ----------
  useEffect(() => {
    let alive = true
    api
      .getMe()
      .then(() => { if (alive) setAuthed(true) })
      .catch(() => { if (alive) setAuthed(false) })
    return () => { alive = false }
  }, [])

  // ---------- 初始化 ----------
  useEffect(() => {
    if (!authed) return
    api.getBanks().then((b) => {
      setBanks(b)
      setBank(b[0]?.id ?? null)
    })
  }, [authed])

  // ?q=<id> 题目直达链接
  useEffect(() => {
    if (!authed) return
    const q = new URLSearchParams(location.search).get('q')
    if (!q) return
    api
      .getById(q)
      .then((it) => {
        if (it && it.id != null) setFocusItem(it)
      })
      .catch(() => {})
  }, [authed])

  // 图片灯箱：RichText 里的图片点击后全局放大
  useEffect(() => {
    const onImg = (e) => setLightbox(e.detail)
    window.addEventListener('ncre:image', onImg)
    return () => window.removeEventListener('ncre:image', onImg)
  }, [])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  // 深色模式：html.dark + localStorage 记忆（首屏由 index.html 内联脚本预设，避免闪白）
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem('ncre-theme', theme)
    } catch {}
  }, [theme])

  // 离线队列：联网自动补传 + 侧边栏计数
  useEffect(() => {
    const update = () => setPending(pendingCount())
    update()
    const onOnline = () => {
      flush().then(update).catch(update)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('ncre:outbox', update)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('ncre:outbox', update)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('ncre-autonext', autoNext ? '1' : '0')
    } catch {}
  }, [autoNext])

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
        const nextNotes = {}
        for (const [id, n] of Object.entries(p.notes || {})) nextNotes[+id] = n.text
        setNotes(nextNotes)
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
    (s, kind, p = 1, autoJump = false) => {
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
          // 续做：进入分类时跳到「上次做完后的下一题」= 本页第一道未作答
          if (autoJump) {
            const next = r.items.findIndex((it) => !resultsRef.current[it.id])
            setIdx(next >= 0 ? next : 0)
          }
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
    loadCategory(sel, kindFilter, 1, true)
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
    setWrongSec(0)
    api.getWrong(bank).then((r) => {
      setWrong(r.items)
      setFreshIds(new Set(r.items.map((x) => x.id)))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bank])

  // ---------- 今日复习 ----------
  const loadReview = useCallback(() => {
    if (!bank) return
    setReviewLoading(true)
    api
      .getReview(bank, 100)
      .then((r) => {
        setReviewItems(r.items)
        setReviewTotal(r.total)
        setReviewGraduated(r.graduated || 0)
        setFreshIds(new Set(r.items.map((x) => x.id)))
        resetRun()
      })
      .catch(() => setReviewItems([]))
      .finally(() => setReviewLoading(false))
  }, [bank])

  useEffect(() => {
    if (mode !== 'review' || !bank) return
    loadReview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bank])

  // ---------- 笔记列表 ----------
  useEffect(() => {
    if (mode !== 'notes' || !bank) return
    setNotesList(null)
    api.getNotes(bank).then((r) => setNotesList(r.items)).catch(() => setNotesList([]))
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

  // ---------- 随机练习 / 智能组卷 ----------
  const startRandom = useCallback(() => {
    if (!bank) return
    setRandomLoading(true)
    api
      .getRandom(bank, {
        count: randomCount,
        kind: randomKind || undefined,
        smart: randomSmart ? 1 : undefined,
      })
      .then((r) => {
        setRandomItems(r.items)
        setFreshIds(new Set(r.items.map((x) => x.id)))
        resetRun()
      })
      .catch(() => setRandomItems([]))
      .finally(() => setRandomLoading(false))
  }, [bank, randomCount, randomKind, randomSmart])

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
    if (mode === 'wrong') {
      const all = wrong ?? EMPTY
      return wrongSec ? all.filter((x) => x.sec === wrongSec) : all
    }
    if (mode === 'review') return reviewItems ?? EMPTY
    if (mode === 'random') return randomItems ?? EMPTY
    if (mode === 'marked') return markedList ?? EMPTY
    if (mode === 'exam') return exam?.items ?? EMPTY
    if (mode === 'search') return searchOpen ? [searchOpen] : EMPTY
    return EMPTY
  }, [mode, list, wrong, wrongSec, reviewItems, randomItems, markedList, exam, searchOpen])

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
  // 单题聚焦（?q= 直达 / 笔记跳转）优先；否则取当前题目集合的当前题。
  // 否则聚焦态的 onPick/onCheck 会因 App 级 item 为空而失效（只能看不能答）。
  const baseItem = focusItem || rawItem
  // 合并懒加载到的解析，保持展示层字段完整
  const item = baseItem && details[baseItem.id] ? { ...baseItem, ...details[baseItem.id] } : baseItem

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
      justAnsweredRef.current = item.id
      // 本题已重新作答 → 取消「待重刷」标记，结果立即展示
      setFreshIds((prev) => {
        if (!prev.has(item.id)) return prev
        const n = new Set(prev)
        n.delete(item.id)
        return n
      })
      // 错题本答对后不立即移除：先让用户看到判分与解析，
      // 等点「下一题」时再移出错题本（见 go()）。
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
      // 错题本：答对后点「下一题」才移出，并让后一题顺位补上（不跳号）
      if (d > 0 && mode === 'wrong' && item && displayResults[item.id]?.state === 'ok') {
        const id = item.id
        const nextLen = (wrong || []).filter((x) => x.id !== id).length
        setWrong((list) => (list || []).filter((x) => x.id !== id))
        setIdx((i) => Math.max(0, Math.min(i, nextLen - 1)))
        return
      }
      setIdx((i) => {
        const n = i + d
        if (n < 0 || n >= items.length) return i
        return n
      })
    },
    [items.length, mode, item, displayResults, wrong],
  )
  goRef.current = go

  // 答完自动下一题（仅分类 / 随机练习；错题本保持手动）
  useEffect(() => {
    if (!autoNext) return
    if (mode !== 'category' && mode !== 'random') return
    if (!item || justAnsweredRef.current !== item.id) return
    if (!displayResults[item.id]) return
    // 注意：解析懒加载会触发 item 变化并让本 effect 重跑（清理上一个 timer）。
    // 因此不能在这里提前清 justAnsweredRef，否则重跑后不再排程、永不前进。
    const t = setTimeout(() => {
      justAnsweredRef.current = null
      if (goRef.current) goRef.current(1)
    }, 1000)
    return () => clearTimeout(t)
  }, [autoNext, mode, item, displayResults])

  // 切题定位：把题卡顶部对齐到吸顶 header 下方，
  // 让下一题的题干/选项/提交按钮直接可见 —— 而不是滚回页面最顶部
  // （那里有总进度块，会把题目顶到屏幕外）。
  useEffect(() => {
    const el = document.querySelector('main article')
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [idx, items])

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
  resultsRef.current = results

  const currentBank = banks.find((b) => b.id === bank)
  const sections = stats?.sections || []
  const parts = stats?.parts || []
  const sectionsOf = (partId) => sections.filter((s) => s.part === +partId)

  // 清空进度（本级别 / 全部）：服务端权威数据 + 本地镜像一起清
  const saveNote = useCallback((id, text) => {
    setNotes((n) => {
      const m = { ...n }
      if (text && text.trim()) m[id] = text
      else delete m[id]
      return m
    })
    api.postNote(id, text || '').catch(() => {})
  }, [])

  const saveExpl = useCallback((id, text) => {
    setDetails((d) => ({ ...d, [id]: { ...(d[id] || {}), expl: text } }))
    api.postExpl(id, text).catch(() => {})
  }, [])

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

  const doLogout = useCallback(() => {
    api.logout().catch(() => {}).finally(() => window.location.reload())
  }, [])

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

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
        正在验证登录状态…
      </div>
    )
  }
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />

  const ctx = { EMPTY, authed, setAuthed, banks, setBanks, bank, setBank, stats, setStats, mode, setMode, sidebar, setSidebar, tree, setTree, sel, setSel, kindFilter, setKindFilter, list, setList, total, setTotal, page, setPage, loading, setLoading, idx, setIdx, picks, setPicks, results, setResults, freshIds, setFreshIds, marked, setMarked, hydrated, setHydrated, byIdRef, paperList, setPaperList, exam, setExam, examLeft, setExamLeft, examSubmitted, setExamSubmitted, examResult, setExamResult, savedExam, setSavedExam, runStatsRef, examLeftRef, picksRef, resultsRef, justAnsweredRef, goRef, wrong, setWrong, wrongSec, setWrongSec, reviewItems, setReviewItems, reviewTotal, setReviewTotal, reviewGraduated, setReviewGraduated, reviewLoading, setReviewLoading, markedList, setMarkedList, randomItems, setRandomItems, randomCount, setRandomCount, randomKind, setRandomKind, randomSmart, setRandomSmart, randomLoading, setRandomLoading, notes, setNotes, notesList, setNotesList, focusItem, setFocusItem, lightbox, setLightbox, theme, setTheme, pending, setPending, autoNext, setAutoNext, details, setDetails, searchQ, setSearchQ, searchKind, setSearchKind, searchRes, setSearchRes, searching, setSearching, searchOpen, setSearchOpen, searchPart, setSearchPart, searchParts, searchItems, reqId, refreshStats, resetRun, displayResults, loadCategory, loadReview, runSearch, startRandom, items, loadPaper, rawItem, baseItem, item, curId, curRevealed, submit, locked, onCheck, onPick, onFill, onSelf, onToggleShow, onMark, go, runStats, currentBank, sections, parts, sectionsOf, saveNote, saveExpl, doReset, doLogout, switchBank, examTimeUp, crumbs, showTree }
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
        reviewCount={stats?.reviewDue || 0}
        open={sidebar}
        onClose={() => setSidebar(false)}
        onReset={doReset}
        onLogout={doLogout}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        pending={pending}
        autoNext={autoNext}
        onToggleAutoNext={() => setAutoNext((v) => !v)}
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
          <FocusView ctx={ctx} />
          <StatsPanel ctx={ctx} />
          <CategoryHome ctx={ctx} />
          <CategoryPractice ctx={ctx} />
          <NotesView ctx={ctx} />
          {/* ---------- 成绩记录 ---------- */}
          {mode === 'records' && <Records bank={bank} />}

          <ReviewView ctx={ctx} />
          <RandomView ctx={ctx} />
          <WrongView ctx={ctx} />
          <MarkedView ctx={ctx} />
          <SearchView ctx={ctx} />
          <ExamView ctx={ctx} />
          </main>
        </div>
      </div>

      <FooterBar ctx={ctx} />

      <Lightbox ctx={ctx} />
    </div>
  )
}
