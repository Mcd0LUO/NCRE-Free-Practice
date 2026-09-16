import express from 'express'
import compression from 'compression'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, 'data')
const PROG = path.join(__dirname, 'progress.json')
const PORT = process.env.PORT || 5181

const app = express()
app.disable('x-powered-by') // 不暴露技术栈
app.use(compression()) // JSON 体积大，gzip 后约省 78-87%
app.use(express.json({ limit: '4mb' }))

// ---------- 访问口令（Cookie 会话） ----------
// 口令从 600 的 env 文件读取（systemd EnvironmentFile），不写进仓库；
// 登录成功后签发 HMAC 签名的 HttpOnly Cookie，30 天内免登。
const AUTH_USER = process.env.NCRE_USER || 'admin'
const AUTH_PASS = process.env.NCRE_PASS || ''
const AUTH_SECRET = process.env.NCRE_SECRET || crypto.randomBytes(32).toString('hex')
const AUTH_ON = AUTH_PASS.length > 0
const COOKIE = 'ncre_session'
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000

function signSession (user) {
  const body = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + SESSION_TTL_MS })).toString('base64url')
  const mac = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url')
  return body + '.' + mac
}
function verifySession (token) {
  if (!token || !token.includes('.')) return null
  const [body, mac] = token.split('.')
  const expect = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url')
  if (mac.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    return p && p.exp > Date.now() ? p : null
  } catch { return null }
}
function readCookie (header, name) {
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return ''
}
const isAuthed = (req) => !AUTH_ON || !!verifySession(readCookie(req.headers.cookie, COOKIE))

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {}
  const okUser = typeof username === 'string' && username === AUTH_USER
  const okPass = typeof password === 'string' && AUTH_PASS.length > 0 &&
    password.length === AUTH_PASS.length &&
    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(AUTH_PASS))
  if (!okUser || !okPass) return res.status(401).json({ error: '用户名或密码错误' })
  res.setHeader('Set-Cookie', COOKIE + '=' + signSession(AUTH_USER) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + Math.floor(SESSION_TTL_MS / 1000))
  res.json({ ok: true })
})

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0')
  res.json({ ok: true })
})

app.get('/api/me', (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ error: 'unauthorized' })
  res.json({ ok: true, user: AUTH_USER })
})

// 除登录/登出外，API 与题目图片一律要求已登录会话
app.use((req, res, next) => {
  if (req.path === '/api/login' || req.path === '/api/logout') return next()
  if (req.path.startsWith('/api') || req.path.startsWith('/images')) {
    if (!isAuthed(req)) return res.status(401).json({ error: 'unauthorized' })
  }
  next()
})

// ---------- banks ----------
// 按等级分文件：bank_<id>.json。每库独立读取，互不影响，
// 新增等级只需放入文件，无需改动这里。
const banks = {}
const byId = {}
for (const f of fs.readdirSync(DATA)) {
  const m = f.match(/^bank_([\w-]+)\.json$/)
  if (!m) continue
  const key = m[1]
  try {
    const b = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
    byId[key] = new Map(b.questions.map(q => [q.id, q]))
    b.questionIds = b.questions.map(q => q.id)
    delete b.questions   // 题目按需下发，避免常驻大对象
    banks[key] = b
  } catch (e) {
    console.warn('[server] skip ' + f + ': ' + e.message)
  }
}
if (!Object.keys(banks).length) {
  console.error('[server] 未找到任何 bank_*.json，请先运行导出脚本生成数据')
  process.exit(1)
}
console.log('[server] banks:', Object.keys(banks).map(k =>
  k + '=' + banks[k].name + '(' + banks[k].questionIds.length + '题)').join(', '))

// ---------- progress store (single user, flat file) ----------
let progress = { answers: {}, marks: {}, wrong: {}, sessions: [], settings: {}, exam: null }
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

  // 数据分层：解析(expl/refAnswer)占用单题体积约 50%，列表页并不需要。
  // 默认剔除，前端点「查看解析」时按 id 单取（/api/questions/:bank/:id）。
  // 需要完整数据时传 fields=full（判分与解析渲染仍走单题接口，不受影响）。
  const wantFull = clean(req.query.fields) === 'full'
  const items = wantFull ? slice : slice.map(({ expl, refAnswer, ...rest }) => rest)
  res.json({ total, page: p, size: n, pages: Math.ceil(total / n), items })
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

// 单题始终返回全量（含解析），供解析懒加载使用
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
  const { bank, scope, ids } = req.body || {}
  if (scope === 'all') {
    progress = { answers: {}, marks: {}, wrong: {}, sessions: [], settings: {}, exam: null }
  } else if (scope === 'items') {
    // 只清掉指定题目（用于「重置本场考试」），不影响其它进度
    for (const id of Array.isArray(ids) ? ids : []) {
      delete progress.answers[id]
      delete progress.wrong[id]
    }
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

// ---------- 考试进行中状态（刷新 / 换设备可续考） ----------
app.get('/api/exam', (req, res) => res.json(progress.exam || null))

app.post('/api/exam', (req, res) => {
  const { bank, ver, group, left, picks, startedAt } = req.body || {}
  if (!bank || ver == null || group == null) {
    return res.status(400).json({ error: 'bank, ver, group required' })
  }
  progress.exam = {
    bank,
    ver: +ver,
    group: +group,
    left: Number.isFinite(+left) ? Math.max(0, Math.round(+left)) : null,
    picks: picks && typeof picks === 'object' ? picks : {},
    startedAt: startedAt || Date.now(),
    t: Date.now(),
  }
  saveProgress()
  res.json({ ok: true, exam: progress.exam })
})

app.delete('/api/exam', (req, res) => {
  progress.exam = null
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
