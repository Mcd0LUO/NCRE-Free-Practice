import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, 'data')
const PROG = path.join(__dirname, 'progress.json')
const PORT = process.env.PORT || 5181

const app = express()
app.use(express.json({ limit: '4mb' }))

// ---------- banks (loaded once, served from memory) ----------
const banks = JSON.parse(fs.readFileSync(path.join(DATA, 'banks.json'), 'utf8'))
const byId = {}
for (const key of Object.keys(banks)) {
  const b = banks[key]
  byId[key] = new Map(b.questions.map(q => [q.id, q]))
  b.questionIds = b.questions.map(q => q.id)
  delete b.questions   // questions served on demand to keep payload small
}
console.log('[server] banks:', Object.keys(banks).map(k =>
  k + '=' + banks[k].name + '(' + banks[k].questionIds.length + '题)').join(', '))

// ---------- progress store (single user, flat file) ----------
let progress = { answers: {}, marks: {}, wrong: {}, sessions: [], settings: {} }
try {
  if (fs.existsSync(PROG)) progress = { ...progress, ...JSON.parse(fs.readFileSync(PROG, 'utf8')) }
} catch (e) { console.warn('[server] progress reset:', e.message) }

let saveTimer = null
function saveProgress () {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    fs.writeFile(PROG, JSON.stringify(progress), err => {
      if (err) console.warn('[server] save failed:', err.message)
    })
  }, 400)
}

// ---------- API ----------
app.get('/api/banks', (req, res) => {
  res.json(Object.values(banks).map(b => ({
    id: b.id, name: b.name, grade: b.grade, timeMin: b.timeMin,
    parts: b.parts, total: b.questionIds.length, papers: b.papers.length,
  })))
})

// treat '', 'undefined', 'null', 'all' as "no filter" (defensive: a client
// serializing undefined into the query string must not blank out the result set)
const clean = (v) => {
  if (v === undefined || v === null) return undefined
  const s = String(v).trim()
  if (s === '' || s === 'undefined' || s === 'null' || s === 'all' || s === 'any') return undefined
  return s
}
const nf = (v) => {
  const s = clean(v)
  if (s === undefined) return NaN
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

// paginated + filtered questions
app.get('/api/questions', (req, res) => {
  const bank = clean(req.query.bank) || '42'
  const b = banks[bank]
  if (!b) return res.status(404).json({ error: 'bank not found' })

  const part = nf(req.query.part)
  const sec = nf(req.query.sec)
  const kind = clean(req.query.kind)
  const q = clean(req.query.q)
  const p = Math.max(1, parseInt(req.query.page, 10) || 1)
  const n = Math.min(200, Math.max(1, parseInt(req.query.size, 10) || 50))

  const hasPart = Number.isFinite(part)
  const hasSec = Number.isFinite(sec)

  let ids = b.questionIds
  if (hasPart || hasSec || kind || q) {
    const map = byId[bank]
    ids = ids.filter(id => {
      const it = map.get(id)
      if (hasPart && it.part !== part) return false
      if (hasSec && it.sec !== sec) return false
      if (kind && it.kind !== kind) return false
      if (q && !(it.stem.includes(q) || it.options.some(o => o.includes(q)))) return false
      return true
    })
  }
  const total = ids.length
  const slice = ids.slice((p - 1) * n, p * n).map(id => byId[bank].get(id))
  res.json({ total, page: p, size: n, pages: Math.ceil(total / n), items: slice })
})

// C1: 全局搜索 —— 跨分类检索题干与选项，返回分类归属便于跳转
app.get('/api/search/:bank', (req, res) => {
  const b = banks[req.params.bank]
  if (!b) return res.status(404).json({ error: 'bank not found' })
  const kw = clean(req.query.q)
  if (!kw) return res.json({ total: 0, items: [], query: '' })
  const kind = clean(req.query.kind)
  const map = byId[req.params.bank]
  const hits = []
  for (const it of map.values()) {
    if (kind && it.kind !== kind) continue
    const inStem = it.stem.includes(kw)
    const inOpt = it.options.some((o) => o.includes(kw))
    if (!inStem && !inOpt) continue
    hits.push({
      id: it.id,
      kind: it.kind,
      part: it.part,
      partName: it.partName,
      sec: it.sec,
      secName: it.secName,
      score: it.score,
      letters: it.letters,
      stem: it.stem.slice(0, 160),
      where: inStem ? 'stem' : 'option',
    })
    if (hits.length >= 300) break // 上限，避免超大响应
  }
  res.json({ total: hits.length, truncated: hits.length >= 300, query: kw, items: hits })
})

app.get('/api/questions/:bank/:id', (req, res) => {
  const it = byId[req.params.bank]?.get(+req.params.id)
  if (!it) return res.status(404).json({ error: 'not found' })
  res.json(it)
})

// 自评题型：不计入客观正确率
const SUBJECTIVE = new Set(['essay'])
const isSubjective = (item) => SUBJECTIVE.has(item.kind)

// 归一化一条作答记录的判定结果。
// 新记录直接用 state；旧记录只有 ok 布尔值，无法区分「部分正确」，按 ok 推断。
function verdictOf (rec, item) {
  if (rec.state === 'ok' || rec.state === 'part' || rec.state === 'bad' || rec.state === 'none') {
    return rec.state
  }
  return rec.ok ? 'ok' : 'bad'
}

const blankSection = (it) => ({
  part: it.part, sec: it.sec, partName: it.partName, secName: it.secName,
  total: 0, objectiveTotal: 0, subjectiveTotal: 0,
  done: 0, right: 0, partial: 0, wrong: 0,
  ok: 0, bad: 0,
  earned: 0, full: 0,
})

// stats per category
app.get('/api/stats/:bank', (req, res) => {
  const b = banks[req.params.bank]
  if (!b) return res.status(404).json({ error: 'bank not found' })
  const map = byId[req.params.bank]

  // 先按题目表建立每个分类的基数
  const sections = {}
  for (const it of map.values()) {
    const key = it.part + ':' + it.sec
    if (!sections[key]) sections[key] = blankSection(it)
    const s = sections[key]
    s.total++
    if (isSubjective(it)) s.subjectiveTotal++
    else s.objectiveTotal++
  }

  const obj = { total: 0, done: 0, right: 0, partial: 0, wrong: 0, earned: 0, full: 0 }
  const sub = { total: 0, done: 0, ok: 0, bad: 0 }
  let done = 0

  for (const [idStr, rec] of Object.entries(progress.answers)) {
    const id = +idStr
    if (!map.has(id)) continue
    const it = map.get(id)
    const s = sections[it.part + ':' + it.sec]
    const v = verdictOf(rec, it)
    if (v === 'none') continue

    done++
    s.done++
    s.earned += rec.score || 0
    s.full += it.score || 0

    if (isSubjective(it)) {
      sub.total++
      sub.done++
      if (v === 'ok') { sub.ok++; s.ok++ } else { sub.bad++; s.bad++ }
    } else {
      obj.total++
      obj.done++
      obj.earned += rec.score || 0
      obj.full += it.score || 0
      if (v === 'ok') { obj.right++; s.right++ } else if (v === 'part') { obj.partial++; s.partial++ } else { obj.wrong++; s.wrong++ }
    }
  }

  res.json({
    total: b.questionIds.length,
    done,
    // 正确率只统计可自动判分的题型，主观题自评单独看
    objective: { ...obj, accuracy: obj.done ? obj.right / obj.done : 0 },
    subjective: sub,
    accuracy: obj.done ? obj.right / obj.done : 0,
    // 兼容旧字段
    right: obj.right, wrong: obj.wrong, partial: obj.partial,
    earned: obj.earned, full: obj.full,
    parts: b.parts,
    sections: Object.values(sections).sort((a, c) => a.part - c.part || a.sec - c.sec),
  })
})

app.get('/api/wrong/:bank', (req, res) => {
  const b = banks[req.params.bank]
  if (!b) return res.status(404).json({ error: 'bank not found' })
  const map = byId[req.params.bank]
  const ids = Object.keys(progress.answers)
    .filter(id => map.has(+id) && verdictOf(progress.answers[id], map.get(+id)) !== 'ok')
    .map(Number)
    .sort((a, c) => (progress.answers[c].t || 0) - (progress.answers[a].t || 0)) // 最近的在前
  res.json({
    total: ids.length,
    // 分题型计数，方便 UI 显示「其中 N 道主观题」
    byKind: ids.reduce((a, id) => {
      const k = map.get(id).kind
      a[k] = (a[k] || 0) + 1
      return a
    }, {}),
    items: ids.map(id => ({ ...map.get(id), verdict: verdictOf(progress.answers[id], map.get(id)) })),
  })
})

// paper list (lightweight)
app.get('/api/papers/:bank', (req, res) => {
  const b = banks[req.params.bank]
  if (!b) return res.status(404).json({ error: 'bank not found' })
  res.json(b.papers.map(p => ({
    ver: p.ver, group: p.group, date: p.date,
    count: p.sections.reduce((a, s) => a + s.ids.length, 0),
  })))
})

// paper by index
app.get('/api/paper/:bank/:ver/:group', (req, res) => {
  const b = banks[req.params.bank]
  if (!b) return res.status(404).json({ error: 'bank not found' })
  const paper = b.papers.find(p => p.ver === +req.params.ver && p.group === +req.params.group)
  if (!paper) return res.status(404).json({ error: 'paper not found' })
  const map = byId[req.params.bank]
  res.json({
    ...paper,
    sections: paper.sections.map(s => ({ ...s, items: s.ids.map(id => map.get(id)).filter(Boolean) })),
  })
})

// progress —— 支持按题库过滤，前端启动时用它水合已答状态
app.get('/api/progress', (req, res) => {
  const bank = clean(req.query.bank)
  if (!bank) return res.json(progress)
  const map = byId[bank]
  if (!map) return res.status(404).json({ error: 'bank not found' })
  const answers = {}
  for (const [id, rec] of Object.entries(progress.answers)) {
    if (map.has(+id)) answers[id] = rec
  }
  const marks = {}
  for (const [id, t] of Object.entries(progress.marks)) {
    if (map.has(+id)) marks[id] = t
  }
  res.json({ answers, marks, bank })
})

// 已标记的题
app.get('/api/marked/:bank', (req, res) => {
  const b = banks[req.params.bank]
  if (!b) return res.status(404).json({ error: 'bank not found' })
  const map = byId[req.params.bank]
  const ids = Object.keys(progress.marks)
    .map(Number)
    .filter((id) => map.has(id))
    .sort((a, c) => (progress.marks[c] || 0) - (progress.marks[a] || 0))
  res.json({ total: ids.length, items: ids.map((id) => map.get(id)) })
})

// ---------- 进度备份 ----------
const BACKUP_DIR = path.join(__dirname, 'backups')
function listBackups () {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return []
    return fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .map((f) => {
        const st = fs.statSync(path.join(BACKUP_DIR, f))
        return { name: f, size: st.size, t: st.mtimeMs }
      })
  } catch {
    return []
  }
}

app.get('/api/backups', (req, res) => res.json(listBackups()))

app.post('/api/backup', (req, res) => {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const name = 'progress-' + stamp + '.json'
    fs.writeFileSync(path.join(BACKUP_DIR, name), JSON.stringify(progress))
    // 只保留最近 30 份
    const all = listBackups()
    for (const old of all.slice(30)) {
      try { fs.unlinkSync(path.join(BACKUP_DIR, old.name)) } catch {}
    }
    res.json({ ok: true, name })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/answer', (req, res) => {
  const { bank, id, ok, score, state, given, letters, fills } = req.body || {}
  if (!bank || id == null) return res.status(400).json({ error: 'bank and id required' })
  const v = state === 'ok' || state === 'part' || state === 'bad' ? state : ok ? 'ok' : 'bad'
  progress.answers[id] = {
    bank, ok: v === 'ok', state: v, score: score || 0, given, letters, fills, t: Date.now(),
  }
  // 只有完全答对才移出错题本；部分正确仍需复习
  if (v === 'ok') delete progress.wrong[id]
  else progress.wrong[id] = { bank, state: v, t: Date.now() }
  saveProgress()
  res.json({ ok: true, state: v })
})

app.post('/api/reset', (req, res) => {
  const { bank, scope } = req.body || {}
  if (scope === 'all') {
    progress = { answers: {}, marks: {}, wrong: {}, sessions: [], settings: {} }
  } else if (scope === 'bank') {
    const map = byId[bank]
    if (map) {
      for (const id of Object.keys(progress.answers)) {
        if (map.has(+id)) { delete progress.answers[id]; delete progress.wrong[id] }
      }
    }
  }
  saveProgress()
  res.json({ ok: true })
})

app.post('/api/mark', (req, res) => {
  const { id, on } = req.body || {}
  if (on) progress.marks[id] = Date.now()
  else delete progress.marks[id]
  saveProgress()
  res.json({ ok: true })
})

app.post('/api/session', (req, res) => {
  progress.sessions.push({ ...req.body, t: Date.now() })
  if (progress.sessions.length > 200) progress.sessions = progress.sessions.slice(-200)
  saveProgress()
  res.json({ ok: true })
})

// images
app.use('/images', express.static(path.join(DATA, 'images'), { maxAge: '7d' }))

// serve built frontend if present
const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/images')) return next()
    res.sendFile(path.join(dist, 'index.html'))
  })
}

app.listen(PORT, '127.0.0.1', () => {
  console.log('[server] http://127.0.0.1:' + PORT)
})
