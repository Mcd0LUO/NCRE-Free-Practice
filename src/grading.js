export const LETTERS = 'ABCDEFGH'

export function correctLetters(item) {
  return (item.letters || '').replace(/[^A-Z]/g, '')
}

const norm = (s) =>
  String(s == null ? '' : s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[（）()【】[\]　]/g, '')

// grade a pick -> { state, score, full, okN, total, detail }
export function grade(item, pick) {
  const full = item.score || 0
  if (item.kind === 'single' || item.kind === 'multi') {
    const cor = correctLetters(item)
    const got = (pick?.letters || '').split('').sort().join('')
    if (!got) return { state: 'none', score: 0, full }
    let anyRight = false, extra = false
    for (const ch of got) {
      if (cor.includes(ch)) anyRight = true
      else extra = true
    }
    const allRight = got === cor.split('').sort().join('')
    let score = 0
    if (allRight) score = full
    else if (anyRight && !extra && item.half) score = item.half
    return {
      state: allRight ? 'ok' : score > 0 ? 'part' : 'bad',
      score, full,
      detail: { cor, got },
    }
  }
  if (item.kind === 'fill') {
    const slots = (item.fills || []).filter((s) => s.alts && s.alts.length)
    if (!slots.length) return { state: 'none', score: 0, full }
    const vals = pick?.fills || []
    let okN = 0, answered = 0
    const per = slots.map((s) => {
      const v = vals[s.n - 1]
      const has = v !== undefined && String(v).trim() !== ''
      if (has) answered++
      const hit = s.alts.some((a) => norm(a) === norm(v))
      if (hit) okN++
      return { n: s.n, ok: hit, given: v, alts: s.alts }
    })
    if (!answered) return { state: 'none', score: 0, full }
    return {
      state: okN === slots.length ? 'ok' : okN > 0 ? 'part' : 'bad',
      score: (full * okN) / slots.length,
      full, okN, total: slots.length, detail: { per },
    }
  }
  // essay: self graded
  return { state: pick?.selfGrade || 'none', score: pick?.selfGrade === 'ok' ? full : 0, full }
}

export const KIND_LABEL = {
  single: '单选题',
  multi: '多选题',
  fill: '填空题',
  essay: '设计与应用题',
}
