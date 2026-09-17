import React from 'react'
import { ProgressBar } from '../components.jsx'

export default function StatsPanel({ ctx }) {
  const { stats, mode, sel, total, exam, wrong, items } = ctx
  return (
    <>
{/* 总览 */}
{stats && mode !== 'exam' && !(mode === 'category' && sel) && (
  <section className="mb-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <span className="font-medium text-[#37352f]">总进度</span>
      <span className="text-gray-600">
        已做 <span className="font-mono">{stats.done}</span> / {stats.total}
      </span>
    </div>

    {/* 客观题：自动判分，正确率以此为准 */}
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      <span className="w-16 shrink-0 text-gray-500">客观题</span>
      <span className="text-gray-600">
        <span className="font-mono">{stats.objective?.done || 0}</span>
        <span className="text-gray-400"> / {stats.objective?.total || 0}</span>
      </span>
      <span className="text-[#0f7b6c]">
        ✓ <span className="font-mono">{stats.objective?.right || 0}</span>
      </span>
      {stats.objective?.partial > 0 && (
        <span className="text-[#dfab01]">
          ◐ <span className="font-mono">{stats.objective.partial}</span>
        </span>
      )}
      <span className="text-[#eb5757]">
        ✕ <span className="font-mono">{stats.objective?.wrong || 0}</span>
      </span>
      <span className="ml-auto text-gray-600">
        正确率{' '}
        <span className="font-mono font-medium text-[#37352f]">
          {Math.round((stats.objective?.accuracy || 0) * 100)}%
        </span>
      </span>
    </div>
    <ProgressBar value={stats.objective?.done || 0} max={stats.objective?.total || 1} className="mt-2" />

    {/* 主观题：自评，不计入正确率 */}
    {stats.subjective?.total > 0 && (
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="w-16 shrink-0 text-gray-500">主观题</span>
        <span className="text-gray-600">
          <span className="font-mono">{stats.subjective.done}</span>
          <span className="text-gray-400"> / {stats.subjective.total}</span>
        </span>
        <span className="text-[#0f7b6c]">
          自评对 <span className="font-mono">{stats.subjective.ok}</span>
        </span>
        <span className="text-[#eb5757]">
          自评错 <span className="font-mono">{stats.subjective.bad}</span>
        </span>
        <span className="ml-auto text-xs text-gray-400">自评不计入正确率</span>
      </div>
    )}

    {stats.full > 0 && (
      <p className="mt-2 text-xs text-gray-400">
        客观题得分 <span className="font-mono">{stats.earned.toFixed(1)}</span> / {stats.full}
      </p>
    )}
  </section>
)}

    </>
  )
}
