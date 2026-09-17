import React from 'react'
import { Icon } from '../components.jsx'

export default function FooterBar({ ctx }) {
  const { idx, items, item, go, runStats } = ctx
  return (
    <>
{/* 底部操作栏：n-safe-bottom 抬起，避开手机系统手势区 / 导航条 */}
{item && (
  <footer className="n-safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white">
    <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 pt-2 md:px-6">
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={idx === 0}
        className="n-btn flex min-h-[44px] flex-1 items-center justify-center gap-1 border border-gray-200 px-3 md:flex-none"
      >
        <Icon name="chevronLeft" className="h-3.5 w-3.5" />
        上一题
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        disabled={idx >= items.length - 1}
        className="n-btn flex min-h-[44px] flex-1 items-center justify-center gap-1 border border-gray-200 px-3 md:flex-none"
      >
        下一题
        <Icon name="chevronRight" className="h-3.5 w-3.5" />
      </button>
      <span className="ml-auto hidden font-mono text-xs text-gray-400 sm:inline">
        已答 {runStats.done}
        {runStats.full ? ' · ' + runStats.score.toFixed(1) + '/' + runStats.full.toFixed(1) : ''}
      </span>
    </div>
    <div className="mx-auto max-w-3xl px-4 sm:hidden">
      <span className="font-mono text-[11px] text-gray-400">
        已答 {runStats.done}
        {runStats.full ? ' · ' + runStats.score.toFixed(1) + '/' + runStats.full.toFixed(1) : ''}
      </span>
    </div>
  </footer>
)}
    </>
  )
}
