import React from 'react'

// 渲染 [[IMG:file]] 标记为图片；其余文本原样输出
export function RichText({ text, className = '' }) {
  if (!text) return null
  const parts = String(text).split(/(\[\[IMG:[^\]]+\]\])/g)
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const m = p.match(/^\[\[IMG:([^\]]+)\]\]$/)
        if (m) {
          return (
            <img
              key={i}
              src={'/images/' + encodeURIComponent(m[1])}
              alt={'题目配图 ' + m[1]}
              loading="lazy"
              className="my-2 max-w-full rounded-md border border-gray-200"
            />
          )
        }
        return <React.Fragment key={i}>{p}</React.Fragment>
      })}
    </span>
  )
}

// Notion 风格标签：浅色底 + 深色字，不用高饱和
const TAG_TONES = {
  gray: 'bg-gray-100 text-gray-600',
  blue: 'bg-blue-50 text-[#2eaadc]',
  red: 'bg-red-50 text-[#eb5757]',
  green: 'bg-green-50 text-[#0f7b6c]',
  yellow: 'bg-yellow-50 text-[#dfab01]',
}
export function Tag({ children, tone = 'gray', title }) {
  return (
    <span
      title={title}
      className={'inline-block rounded-md px-2 py-0.5 text-xs font-medium ' + (TAG_TONES[tone] || TAG_TONES.gray)}
    >
      {children}
    </span>
  )
}

// 文本 + 符号双重编码，不单独依赖颜色传递状态
export function Verdict({ state, children }) {
  const map = {
    ok: { cls: 'text-[#0f7b6c]', mark: '✓', sr: '正确' },
    part: { cls: 'text-[#dfab01]', mark: '◐', sr: '部分正确' },
    bad: { cls: 'text-[#eb5757]', mark: '✕', sr: '错误' },
    none: { cls: 'text-gray-400', mark: '○', sr: '未作答' },
  }
  const v = map[state] || map.none
  return (
    <span className={'inline-flex items-center gap-1.5 font-medium ' + v.cls}>
      <span aria-hidden="true">{v.mark}</span>
      <span className="sr-only">{v.sr}</span>
      {children}
    </span>
  )
}

export function ProgressBar({ value, max, className = '' }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div
      className={'h-1 w-full overflow-hidden rounded-md bg-gray-200 ' + className}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full bg-[#2eaadc] transition-colors duration-150" style={{ width: pct + '%' }} />
    </div>
  )
}

// 简洁线性图标（stroke，无填充、无装饰）
export function Icon({ name, className = 'h-4 w-4' }) {
  const paths = {
    chevronRight: <path d="M9 6l6 6-6 6" />,
    chevronLeft: <path d="M15 6l-6 6 6 6" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    grip: (
      <>
        <circle cx="9" cy="6" r="1" />
        <circle cx="15" cy="6" r="1" />
        <circle cx="9" cy="12" r="1" />
        <circle cx="15" cy="12" r="1" />
        <circle cx="9" cy="18" r="1" />
        <circle cx="15" cy="18" r="1" />
      </>
    ),
    check: <path d="M20 6L9 17l-5-5" />,
    close: <path d="M18 6L6 18M6 6l12 12" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
    edit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />,
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    flag: <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V15" />,
    link: <path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7l1-1" />,
  }
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || null}
    </svg>
  )
}

// 空状态
export function Empty({ title, hint, action }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
      <p className="font-medium text-gray-700">{title}</p>
      {hint && <p className="mx-auto mt-2 max-w-prose text-sm text-gray-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// 加载态：纯文本，不引入旋转动画装饰
export function Loading({ text = '加载中…' }) {
  return <div className="rounded-lg border border-gray-200 bg-white px-6 py-14 text-center text-sm text-gray-400 shadow-sm">{text}</div>
}

// 关键词高亮：把命中片段包成 <mark>（大小写不敏感）
export function Highlight({ text, term, className = '' }) {
  const s = String(text == null ? '' : text)
  const t = String(term == null ? '' : term).trim()
  if (!t) return <span className={className}>{s}</span>
  const low = s.toLowerCase()
  const lt = t.toLowerCase()
  const out = []
  let i = 0
  let k = 0
  let idx = low.indexOf(lt)
  while (idx >= 0 && out.length < 200) {
    if (idx > i) out.push(s.slice(i, idx))
    out.push(
      <mark key={k++} className="rounded bg-yellow-100 px-0.5 text-inherit">
        {s.slice(idx, idx + t.length)}
      </mark>,
    )
    i = idx + t.length
    idx = low.indexOf(lt, i)
  }
  out.push(s.slice(i))
  return <span className={className}>{out}</span>
}
