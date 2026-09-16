const j = async (r) => {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText)
  return r.json()
}

// drop anything that isn't a real value: undefined, null, '', 'undefined', 'null'
function qs(params) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    const s = String(v).trim()
    if (s === '' || s === 'undefined' || s === 'null') continue
    sp.set(k, s)
  }
  return sp.toString()
}

export const getBanks = () => fetch('/api/banks').then(j)
export const getProgress = (bank) => fetch('/api/progress' + (bank ? '?bank=' + bank : '')).then(j)
export const getMarked = (bank) => fetch('/api/marked/' + bank).then(j)
export const getQuestion = (bank, id) => fetch('/api/questions/' + bank + '/' + id).then(j)

// 解析懒加载：列表接口默认不含 expl/refAnswer，展开解析时按 id 取全量
const detailCache = new Map()
export const getDetail = (bank, id) => {
  const key = bank + ':' + id
  if (!detailCache.has(key)) {
    detailCache.set(
      key,
      fetch('/api/questions/' + bank + '/' + id).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    )
  }
  return detailCache.get(key)
}
export const search = (bank, q, kind) =>
  fetch('/api/search/' + bank + '?' + qs({ q, kind })).then(j)
export const postMark = (id, on) =>
  fetch('/api/mark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, on }),
  }).then(j)
export const getBackups = () => fetch('/api/backups').then(j)
export const postBackup = () => fetch('/api/backup', { method: 'POST' }).then(j)
export const getStats = (bank) => fetch('/api/stats/' + bank).then(j)
export const getWrong = (bank) => fetch('/api/wrong/' + bank).then(j)
export const getPapers = (bank) => fetch('/api/papers/' + bank).then(j)
export const getPaper = (bank, ver, group) => fetch('/api/paper/' + bank + '/' + ver + '/' + group).then(j)

export const getQuestions = (bank, params = {}) =>
  fetch('/api/questions?' + qs({ bank, ...params })).then(j)

export const postAnswer = (body) =>
  fetch('/api/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(j)

export const postReset = (body) =>
  fetch('/api/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(j)

export const getExam = () => fetch('/api/exam').then(j)
export const postExam = (body) =>
  fetch('/api/exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(j)
export const delExam = () => fetch('/api/exam', { method: 'DELETE' }).then(j)

export const postSession = (body) =>
  fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(j)
