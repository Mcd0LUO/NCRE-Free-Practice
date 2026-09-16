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

export const postSession = (body) =>
  fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(j)
