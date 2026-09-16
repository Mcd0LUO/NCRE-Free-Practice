import React from 'react'
import { ProgressBar } from './components.jsx'

// 薄弱知识点：按当前正确率从低到高，取前 5 个（排除样本太小的分类）
export default function WeakPoints({ sections = [], onPick }) {
  const ranked = sections
    .filter((s) => (s.objectiveTotal || 0) >= 3)
    .map((s) => {
      const done = s.right + s.partial + s.wrong
      return { ...s, done, acc: done ? s.right / done : 0 }
    })
    .filter((s) => s.done > 0)
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 5)

  if (!ranked.length) return null

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-gray-700">薄弱知识点</h2>
        <span className="text-xs text-gray-400">按当前正确率从低到高</span>
      </div>
      <ul className="mt-3 space-y-2">
        {ranked.map((s) => (
          <li key={s.part + ':' + s.sec} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-sm text-[#37352f]" title={s.partName + ' / ' + s.secName}>
              {s.secName}
            </span>
            <span className="w-24 shrink-0">
              <ProgressBar value={s.right} max={s.done} />
            </span>
            <span className={'w-10 shrink-0 text-right font-mono text-xs ' + (s.acc < 0.6 ? 'text-[#eb5757]' : 'text-gray-500')}>
              {Math.round(s.acc * 100)}%
            </span>
            <button type="button" onClick={() => onPick(s)} className="n-btn shrink-0 px-2 py-1 text-xs text-[#2eaadc]">
              去练
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
