import React from 'react'
import { Icon, ProgressBar } from './components.jsx'

// 左侧固定侧边栏：米色背景 + 页面列表（Notion 文档结构）
export default function Sidebar({ banks, bank, onBank, mode, onMode, stats, wrongCount = 0, open, onClose }) {
  const modes = [
    { id: 'category', label: '分类练习', icon: 'list', hint: '按知识点逐类攻克' },
    { id: 'exam', label: '模拟考试', icon: 'clock', hint: '限时成套做卷' },
    { id: 'wrong', label: '错题本', icon: 'target', hint: '只刷做错的题' },
  ]

  return (
    <>
      {/* 移动端遮罩：无过渡动画，仅切换显隐 */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-gray-200 bg-[#f7f6f3] ' +
          'transition-colors duration-150 md:static md:z-auto ' +
          (open ? 'block' : 'hidden md:flex')
        }
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="font-semibold text-[#37352f]">NCRE 刷题</span>
          <button
            type="button"
            onClick={onClose}
            className="n-btn ml-auto px-1.5 py-1 md:hidden"
            aria-label="关闭侧边栏"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* 题库切换 */}
        <nav className="px-2" aria-label="题库">
          <p className="px-2 py-1 text-xs font-medium text-gray-400">题库</p>
          {banks.map((b) => {
            const active = b.id === bank
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onBank(b.id)}
                aria-current={active ? 'true' : undefined}
                className={
                  'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 ' +
                  (active ? 'bg-[#e3e1db] font-medium text-[#37352f]' : 'text-gray-600 hover:bg-[#efedea] active:bg-[#e3e1db]')
                }
              >
                <span className="n-handle text-gray-300">
                  <Icon name="grip" className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                <span className="shrink-0 text-xs text-gray-400">{b.total}</span>
              </button>
            )
          })}
        </nav>

        {/* 模式切换 */}
        <nav className="mt-4 px-2" aria-label="练习模式">
          <p className="px-2 py-1 text-xs font-medium text-gray-400">模式</p>
          {modes.map((m) => {
            const active = m.id === mode
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onMode(m.id)}
                aria-current={active ? 'true' : undefined}
                title={m.hint}
                className={
                  'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 ' +
                  (active ? 'bg-[#e3e1db] font-medium text-[#37352f]' : 'text-gray-600 hover:bg-[#efedea] active:bg-[#e3e1db]')
                }
              >
                <span className="n-handle text-gray-300">
                  <Icon name={m.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">{m.label}</span>
                {m.id === 'wrong' && wrongCount > 0 && (
                  <span className="shrink-0 rounded-md bg-red-50 px-1.5 py-0.5 font-mono text-[11px] text-[#eb5757]">
                    {wrongCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* 进度摘要 */}
        {stats && (
          <div className="mt-auto border-t border-gray-200 px-4 py-3">
            <p className="mb-1.5 text-xs font-medium text-gray-400">总进度</p>
            <ProgressBar value={stats.objective?.done || 0} max={stats.objective?.total || stats.total} />
            <p className="mt-1.5 font-mono text-xs text-gray-600">
              {stats.objective?.done || 0} / {stats.objective?.total || stats.total}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              客观题正确率 {Math.round((stats.objective?.accuracy || 0) * 100)}%
            </p>
          </div>
        )}
      </aside>
    </>
  )
}
