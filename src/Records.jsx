import React, { useEffect, useState } from 'react'
import { Tag, Loading, Empty } from './components.jsx'
import * as api from './api.js'

const bankLabel = (b) => (b === '42' ? '四级' : b === '36' ? '三级' : b)

export default function Records({ bank }) {
  const [sessions, setSessions] = useState(null)
  const [daily, setDaily] = useState(null)

  useEffect(() => {
    if (!bank) return
    let alive = true
    setSessions(null)
    setDaily(null)
    api.getSessions(bank).then((s) => alive && setSessions(s)).catch(() => alive && setSessions([]))
    api.getDaily(bank, 30).then((d) => alive && setDaily(d)).catch(() => alive && setDaily([]))
    return () => { alive = false }
  }, [bank])

  const days = daily || []
  const today = days[days.length - 1] || { done: 0, right: 0 }
  const last7 = days.slice(-7)
  const weekDone = last7.reduce((a, d) => a + d.done, 0)
  const weekRight = last7.reduce((a, d) => a + d.right, 0)
  const maxDone = Math.max(1, ...days.map((d) => d.done))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#37352f] md:text-2xl">成绩记录</h1>
        <p className="mt-1 text-sm text-gray-600">历史考试与每日做题统计。</p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="font-medium text-[#37352f]">今日已做 <span className="font-mono">{today.done}</span> 题</span>
          <span className="text-gray-600">近 7 日 <span className="font-mono">{weekDone}</span> 题</span>
          <span className="text-[#0f7b6c]">✓ <span className="font-mono">{weekRight}</span></span>
          <span className="ml-auto text-gray-600">
            正确率 <span className="font-mono">{weekDone ? Math.round((weekRight / weekDone) * 100) : 0}%</span>
          </span>
        </div>
        <div className="mt-4 flex h-24 items-end gap-1">
          {days.slice(-30).map((d) => (
            <div key={d.date} className="flex-1" title={d.date + ' · ' + d.done + ' 题'}>
              <div
                className="w-full rounded-sm bg-[#2eaadc]"
                style={{ height: Math.round((d.done / maxDone) * 88) + 'px', minHeight: d.done ? 3 : 1, opacity: d.done ? 1 : 0.2 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-gray-400">
          <span>{days[0]?.date?.slice(5)}</span>
          <span>{days[days.length - 1]?.date?.slice(5)}</span>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">历史考试</h2>
        {sessions === null ? (
          <Loading text="读取成绩…" />
        ) : !sessions.length ? (
          <Empty title="还没有交卷记录" hint="去「模拟考试」做一套，交卷后会记录在这里。" />
        ) : (
          <ul className="space-y-1.5">
            {sessions.map((s, i) => {
              const acc = s.answered ? Math.round((s.right / s.answered) * 100) : 0
              return (
                <li key={i} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Tag tone="blue">{bankLabel(s.bank)}</Tag>
                    <span className="font-medium text-[#37352f]">{s.ver} 第 {s.group} 套</span>
                    {s.auto && <Tag tone="gray">自动交卷</Tag>}
                    <span className="ml-auto font-mono text-xs text-gray-400">
                      {new Date(s.t || Date.now()).toLocaleString('zh-CN', { hour12: false })}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-600">
                    <span>作答 <span className="font-mono">{s.answered}</span> / {s.total}</span>
                    <span className="text-[#0f7b6c]">✓ <span className="font-mono">{s.right}</span></span>
                    <span>正确率 <span className="font-mono">{acc}%</span></span>
                    <span>得分 <span className="font-mono text-[#37352f]">{(s.score || 0).toFixed(1)}</span> / {s.full || '—'}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
