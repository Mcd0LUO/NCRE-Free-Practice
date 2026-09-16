import React, { useEffect, useRef, useState } from 'react'
import { Icon, ProgressBar } from './components.jsx'
import * as api from './api.js'

// 进度备份：明文单文件，误清即不可恢复，这里给一个手动快照入口
function BackupRow() {
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const doBackup = () => {
    setBusy(true)
    api
      .postBackup()
      .then(() => {
        setMsg('已备份')
        setTimeout(() => setMsg(''), 2500)
      })
      .catch(() => setMsg('备份失败'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="mt-2 flex items-center gap-2 border-t border-gray-200 pt-2">
      <button
        type="button"
        onClick={doBackup}
        disabled={busy}
        className="n-btn px-1.5 py-0.5 text-[11px] text-gray-500"
      >
        备份进度
      </button>
      {msg && <span className="text-[11px] text-gray-400">{msg}</span>}
    </div>
  )
}

// 进度重置：清空服务端保存的作答记录，不可撤销
function ResetRow({ onReset }) {
  const [msg, setMsg] = useState('')
  const ask = (scope, label) => {
    if (!window.confirm(label + '？\n\n会清除服务端保存的作答记录，且不可撤销。')) return
    onReset(scope)
    setMsg('已清空')
    setTimeout(() => setMsg(''), 2500)
  }
  return (
    <div className="mt-2 flex items-center gap-2 border-t border-gray-200 pt-2">
      <button
        type="button"
        onClick={() => ask('bank', '清空本级别进度')}
        className="n-btn px-1.5 py-0.5 text-[11px] text-gray-500"
      >
        清空本级别
      </button>
      <button
        type="button"
        onClick={() => ask('all', '清空全部进度')}
        className="n-btn px-1.5 py-0.5 text-[11px] text-[#eb5757]"
      >
        清空全部
      </button>
      {msg && <span className="text-[11px] text-gray-400">{msg}</span>}
    </div>
  )
}

// 进度导出 / 导入（JSON 文件，便于换机或备份）
function ExportRow() {
  const [msg, setMsg] = useState('')
  const fileRef = useRef(null)

  const doExport = () => {
    api
      .exportProgress()
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'ncre-progress-' + new Date().toISOString().slice(0, 10) + '.json'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        setMsg('已导出')
        setTimeout(() => setMsg(''), 2500)
      })
      .catch(() => setMsg('导出失败'))
  }

  const doImport = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      let data
      try {
        data = JSON.parse(String(reader.result))
      } catch {
        setMsg('文件格式错误')
        return
      }
      api
        .importProgress(data)
        .then(() => {
          setMsg('已导入，刷新中…')
          setTimeout(() => window.location.reload(), 700)
        })
        .catch(() => setMsg('导入失败'))
    }
    reader.readAsText(f)
    e.target.value = ''
  }

  return (
    <div className="mt-2 flex items-center gap-2 border-t border-gray-200 pt-2">
      <button type="button" onClick={doExport} className="n-btn px-1.5 py-0.5 text-[11px] text-gray-500">
        导出进度
      </button>
      <button type="button" onClick={() => fileRef.current?.click()} className="n-btn px-1.5 py-0.5 text-[11px] text-gray-500">
        导入进度
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={doImport} />
      {msg && <span className="text-[11px] text-gray-400">{msg}</span>}
    </div>
  )
}

// 深色模式切换
function ThemeRow({ theme, onToggle }) {
  return (
    <div className="mt-2 flex items-center gap-2 border-t border-gray-200 pt-2">
      <button type="button" onClick={onToggle} className="n-btn px-1.5 py-0.5 text-[11px] text-gray-500">
        {theme === 'dark' ? '切换浅色' : '切换深色'}
      </button>
    </div>
  )
}

// 退出登录
function LogoutRow({ onLogout }) {
  return (
    <div className="mt-2 flex items-center gap-2 border-t border-gray-200 pt-2">
      <button
        type="button"
        onClick={onLogout}
        className="n-btn px-1.5 py-0.5 text-[11px] text-gray-500"
      >
        退出登录
      </button>
    </div>
  )
}

// 左侧固定侧边栏：米色背景 + 页面列表（Notion 文档结构）
export default function Sidebar({ banks, bank, onBank, mode, onMode, stats, wrongCount = 0, markedCount = 0, open, onClose, onReset, onLogout, theme, onToggleTheme }) {
  const modes = [
    { id: 'category', label: '分类练习', icon: 'list', hint: '按知识点逐类攻克' },
    { id: 'random', label: '随机练习', icon: 'target', hint: '随机抽题 / 智能组卷' },
    { id: 'exam', label: '模拟考试', icon: 'clock', hint: '限时成套做卷' },
    { id: 'wrong', label: '错题本', icon: 'target', hint: '只刷做错的题' },
    { id: 'marked', label: '标记题', icon: 'flag', hint: '我标记待复习的题' },
    { id: 'notes', label: '我的笔记', icon: 'edit', hint: '带笔记的题目' },
    { id: 'records', label: '成绩记录', icon: 'clock', hint: '历史考试与每日统计' },
    { id: 'search', label: '全局搜索', icon: 'search', hint: '按关键词搜题干与选项' },
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
                {m.id === 'marked' && markedCount > 0 && (
                  <span className="shrink-0 rounded-md bg-yellow-50 px-1.5 py-0.5 font-mono text-[11px] text-[#dfab01]">
                    {markedCount}
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
            <BackupRow />
            <ResetRow onReset={onReset} />
            <LogoutRow onLogout={onLogout} />
            <ExportRow />
            <ThemeRow theme={theme} onToggle={onToggleTheme} />
          </div>
        )}
      </aside>
    </>
  )
}
