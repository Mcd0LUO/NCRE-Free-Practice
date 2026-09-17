// 离线写队列：断网时把作答/标记/笔记/解析先存本地，联网后自动补传
const KEY = 'ncre-outbox'

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}
function write(q) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q))
  } catch {}
  window.dispatchEvent(new Event('ncre:outbox'))
}

export function pendingCount() {
  return read().length
}

export function enqueue(path, body) {
  const q = read()
  q.push({ path, body, t: Date.now() })
  write(q)
}

// POST JSON：网络异常 / 5xx 入队，联网后补传；4xx 视为业务错误（不入队）
export async function postJSON(path, body) {
  try {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      if (r.status >= 500) enqueue(path, body)
      throw new Error('http ' + r.status)
    }
    return await r.json()
  } catch (e) {
    if (!/^http /.test(String(e && e.message))) enqueue(path, body)
    throw e
  }
}

// 联网后按顺序补传；遇网络/5xx 停止并保留剩余，4xx 丢弃避免死循环
export async function flush() {
  const q = read()
  if (!q.length) return 0
  let sent = 0
  let i = 0
  for (; i < q.length; i++) {
    try {
      const r = await fetch(q[i].path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(q[i].body),
      })
      if (r.ok) sent++
      else if (r.status >= 500) break
    } catch {
      break
    }
  }
  write(q.slice(i))
  return sent
}
