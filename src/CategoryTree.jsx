import React, { useMemo, useState } from 'react'
import { Icon, ProgressBar } from './components.jsx'

// 题目区左侧的可滚动分类树（独立于最左工具栏）
export default function CategoryTree({ parts, sections, sel, onSelect, onClose }) {
  const [q, setQ] = useState('')
  const [collapsed, setCollapsed] = useState(() => new Set())

  // 每个大类下的知识点，附带进度
  const groups = useMemo(
    () =>
      parts.map((p) => ({
        ...p,
        items: sections.filter((s) => s.part === +p.id),
      })),
    [parts, sections],
  )

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (!kw) return groups
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((s) => s.secName.toLowerCase().includes(kw) || g.name.toLowerCase().includes(kw)),
      }))
      .filter((g) => g.items.length)
  }, [groups, q])

  const toggle = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const isSel = (s) => sel && sel.part === s.part && sel.sec === s.sec

  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-[#f7f6f3]">
      {/* 头部 + 搜索 */}
      <div className="shrink-0 border-b border-gray-200 px-3 py-2.5">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-medium text-[#37352f]">分类</h2>
          <span className="text-xs text-gray-400">{sections.length} 个知识点</span>
          <button
            type="button"
            onClick={onClose}
            className="n-btn ml-auto px-1.5 py-1 lg:hidden"
            aria-label="收起分类列表"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="n-input flex items-center gap-1.5 px-2 py-1.5 focus-within:border-transparent focus-within:ring-2 focus-within:ring-blue-500">
          <span className="shrink-0 text-gray-400" aria-hidden="true">
            <Icon name="search" className="h-3.5 w-3.5" />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索知识点"
            aria-label="搜索知识点"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {/* 可滚动分类列表 */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5" aria-label="知识点分类">
        {!filtered.length && <p className="px-2 py-3 text-sm text-gray-400">没有匹配的知识点</p>}

        {filtered.map((g) => {
          const isCollapsed = collapsed.has(g.id) && !q.trim()
          const done = g.items.reduce((a, s) => a + s.done, 0)
          const total = g.items.reduce((a, s) => a + s.total, 0)
          return (
            <div key={g.id} className="mb-1">
              {/* 大类标题：可折叠 */}
              <button
                type="button"
                onClick={() => toggle(g.id)}
                aria-expanded={!isCollapsed}
                className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-[#efedea] active:bg-[#e3e1db]"
              >
                <span className="shrink-0 text-gray-400" aria-hidden="true">
                  {/* 用图标切换表达展开态，避免任何 transform */}
                  {isCollapsed ? (
                    <Icon name="chevronRight" className="h-3 w-3" />
                  ) : (
                    <Icon name="chevronDown" className="h-3 w-3" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-600">{g.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-gray-400">
                  {done}/{total}
                </span>
              </button>

              {/* 知识点 */}
              {!isCollapsed && (
                <ul className="mt-0.5 space-y-0.5 pl-1">
                  {g.items.map((s) => {
                    const active = isSel(s)
                    return (
                      <li key={s.sec}>
                        <button
                          type="button"
                          onClick={() => onSelect({ part: s.part, sec: s.sec })}
                          aria-current={active ? 'true' : undefined}
                          className={
                            'group flex w-full items-start gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150 ' +
                            (active
                              ? 'bg-[#e3e1db] '
                              : 'hover:bg-[#efedea] active:bg-[#e3e1db] ')
                          }
                        >
                          <span className="n-handle mt-0.5 shrink-0 text-gray-300">
                            <Icon name="grip" className="h-3 w-3" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={
                                'block truncate text-[13px] leading-5 ' +
                                (active ? 'font-medium text-[#37352f]' : 'text-gray-700')
                              }
                            >
                              {s.secName}
                            </span>
                            <span className="mt-1 flex items-center gap-1.5">
                              <ProgressBar
                                value={s.objectiveTotal ? s.right + s.partial + s.wrong : s.done}
                                max={s.objectiveTotal || s.total}
                                className="flex-1"
                              />
                              <span className="shrink-0 font-mono text-[10px] text-gray-400">
                                {s.objectiveTotal ? s.right + s.partial + s.wrong : s.done}/{s.objectiveTotal || s.total}
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </nav>
    </div>
  )
}
