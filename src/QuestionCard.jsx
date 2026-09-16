import React, { useEffect, useState } from 'react'
import { LETTERS, correctLetters, KIND_LABEL } from './grading'
import { RichText, Tag, Verdict, Icon } from './components.jsx'

export default function QuestionCard({
  item, index, total, pick, result, locked = false,
  onPick, onFill, onSelf, onCheck, onToggleShow, marked, onMark,
  note = '', onNote,
}) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [draft, setDraft] = useState(note || '')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setDraft(note || '')
    setNoteOpen(false)
    setCopied(false)
  }, [item.id, note])

  const copyLink = () => {
    const url = location.origin + '/?q=' + item.id
    const done = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done).catch(() => {})
    else done()
  }

  const cor = correctLetters(item)
  const checked = !!result
  const showExp = result?.revealed
  const pickLetters = pick?.letters || ''

  const kindTone = { single: 'blue', multi: 'yellow', fill: 'green', essay: 'gray' }[item.kind] || 'gray'

  return (
    <article className="group relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-6">
      {/* Drag Handle Illusion —— 左侧 ⋮⋮ 仅 hover 显现 */}
      <span
        className="n-handle absolute left-1.5 top-5 hidden cursor-grab select-none text-gray-300 md:block"
        aria-hidden="true"
      >
        <Icon name="grip" className="h-4 w-4" />
      </span>

      {/* 元信息行 */}
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Tag tone={kindTone}>{KIND_LABEL[item.kind] || item.kind}</Tag>
        <Tag>{item.score} 分</Tag>
        {item.verdict === 'part' && <Tag tone="yellow">上次：部分正确</Tag>}
        {item.verdict === 'bad' && <Tag tone="red">上次：答错</Tag>}
        {result?.restored && <Tag tone="gray">已作答</Tag>}
        <Tag tone="gray" title={item.partName + ' / ' + item.secName}>
          {item.secName}
        </Tag>
        <span className="ml-auto flex items-center gap-2 text-xs text-gray-400">
          <span className="font-mono">
            {index + 1} / {total}
          </span>
          {onMark && (
            <button
              type="button"
              onClick={onMark}
              aria-pressed={!!marked}
              aria-label={marked ? '取消标记' : '标记此题'}
              className={
                'n-btn -my-1 px-1.5 py-1 ' + (marked ? 'text-[#dfab01]' : 'text-gray-300')
              }
            >
              <Icon name="flag" className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={copyLink}
            aria-label="复制本题链接"
            title="复制本题链接"
            className="n-btn -my-1 px-1.5 py-1 text-[11px] text-gray-300"
          >
            {copied ? '已复制' : <Icon name="link" className="h-3.5 w-3.5" />}
          </button>
        </span>
      </header>

      {/* 题干 */}
      <div className="n-measure mb-4 whitespace-pre-wrap text-[15px] leading-7 text-[#37352f]">
        <RichText text={item.stem} />
        {item.images?.length > 0 && null}
      </div>

      {/* 选项 */}
      {(item.kind === 'single' || item.kind === 'multi') && (
        <ul className="space-y-1">
          {item.options.map((opt, i) => {
            const L = LETTERS[i]
            const on = pickLetters.includes(L)
            const isCor = cor.includes(L)
            // 状态仅用背景 + 符号，不改变边框颜色
            let stateCls = 'hover:bg-[#efedea] active:bg-[#e3e1db]'
            if (checked) {
              if (isCor) stateCls = 'bg-green-50'
              else if (on) stateCls = 'bg-red-50'
              else stateCls = 'opacity-60'
            } else if (on) {
              stateCls = 'bg-blue-50'
            }
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={checked || locked}
                  onClick={() => onPick(L)}
                  aria-pressed={on}
                  className={
                    'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors duration-150 ' +
                    (checked ? 'cursor-default ' : '') + stateCls
                  }
                >
                  <span
                    className={
                      'mt-0.5 w-4 shrink-0 text-sm font-medium ' +
                      (on || (checked && isCor) ? 'text-[#37352f]' : 'text-gray-400')
                    }
                  >
                    {L}
                  </span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-6 text-[#37352f]">
                    <RichText text={opt} />
                  </span>
                  {checked && isCor && (
                    <span className="mt-0.5 shrink-0 text-[#0f7b6c]" aria-label="正确选项">
                      <Icon name="check" className="h-4 w-4" />
                    </span>
                  )}
                  {checked && on && !isCor && (
                    <span className="mt-0.5 shrink-0 text-[#eb5757]" aria-label="你选择的错误项">
                      <Icon name="close" className="h-4 w-4" />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {item.kind === 'multi' && (
        <p className="mt-2 text-xs text-gray-400">
          多选题：选出所有正确项
          {item.half ? '（全对 ' + item.score + ' 分，部分对 ' + item.half + ' 分）' : ''}
        </p>
      )}

      {/* 填空 */}
      {item.kind === 'fill' && (
        <div className="space-y-2">
          {(item.fills || []).some((s) => s.alts?.length) ? (
            (item.fills || [])
              .filter((s) => s.alts?.length)
              .map((s) => {
                const given = pick?.fills?.[s.n - 1] ?? ''
                const per = result?.detail?.per?.find((x) => x.n === s.n)
                return (
                  <div key={s.n} className="flex flex-wrap items-center gap-3">
                    <label className="w-16 shrink-0 text-sm text-gray-600" htmlFor={'blank-' + s.n}>
                      第 {s.n} 空
                    </label>
                    <input
                      id={'blank-' + s.n}
                      value={given}
                      disabled={checked || locked}
                      onChange={(e) => onFill(s.n - 1, e.target.value)}
                      aria-label={'第 ' + s.n + ' 空作答'}
                      className={
                        'n-input min-w-0 flex-1 px-3 py-2 text-sm disabled:bg-gray-50 ' +
                        (per ? (per.ok ? 'bg-green-50' : 'bg-red-50') : '')
                      }
                    />
                    {per && (
                      <span
                        className={
                          'shrink-0 text-xs ' + (per.ok ? 'text-[#0f7b6c]' : 'text-[#eb5757]')
                        }
                      >
                        {per.ok ? '✓ 正确' : '✕ 应为 ' + per.alts.join(' / ')}
                      </span>
                    )}
                  </div>
                )
              })
          ) : (
            <p className="text-sm text-gray-400">此题原库未给出结构化答案，请查看解析后自评。</p>
          )}
        </div>
      )}

      {/* 主观题：先给参考答案，再自评（原先只渲染两个按钮，答案被浪费了） */}
      {item.kind === 'essay' && (
        <div className="space-y-3">
          {item.refAnswer || item.expl ? (
            <div className="rounded-md bg-gray-50 px-3 py-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-600">参考答案</span>
                <span className="text-[11px] text-gray-400">主观题无自动判分，请对照后自评</span>
                <button
                  type="button"
                  onClick={onToggleShow}
                  className="n-btn ml-auto px-2 py-0.5 text-xs text-[#2eaadc] hover:bg-transparent hover:underline"
                >
                  {showExp ? '收起' : '展开全文'}
                </button>
              </div>
              <div
                className={
                  'n-measure whitespace-pre-wrap text-sm leading-6 text-[#37352f] ' +
                  (showExp ? '' : 'max-h-40 overflow-hidden')
                }
              >
                <RichText text={item.refAnswer || item.expl} />
              </div>
            </div>
          ) : (
            <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-400">
              原题库未提供此题的参考答案（49 道主观题中有 24 道缺失）。
            </p>
          )}

          {!checked && !locked && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">自评：</span>
              <button type="button" onClick={() => onSelf('ok')} className="n-btn border border-gray-200">
                我答对了
              </button>
              <button type="button" onClick={() => onSelf('bad')} className="n-btn border border-gray-200">
                我答错了
              </button>
            </div>
          )}

          {checked && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Verdict state={result.state}>
                {result.state === 'ok' ? '已标记为答对' : '已标记为答错'}
              </Verdict>
              <button
                type="button"
                onClick={() => onSelf(result.state === 'ok' ? 'bad' : 'ok')}
                className="n-btn border border-gray-200 px-2 py-1 text-xs"
              >
                改为{result.state === 'ok' ? '答错' : '答对'}
              </button>
            </div>
          )}
        </div>
      )}

      {locked && !checked && (
        <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500">
          本场考试已交卷，不能再作答。
        </p>
      )}

      {/* B3: 已作答但未展开结果时，提示上次的选择 */}
      {!checked && !locked && (pick?.letters || (pick?.fills || []).some(Boolean)) && (
        <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500">
          上次作答：
          {pick.letters ? <span className="font-mono text-gray-700">{pick.letters}</span> : null}
          {!pick.letters && (pick.fills || []).some(Boolean) ? (
            <span className="text-gray-700">
              {(pick.fills || []).map((f, i) => (f ? '第' + (i + 1) + '空 ' + f : null)).filter(Boolean).join('，')}
            </span>
          ) : null}
        </p>
      )}

      {/* 确认按钮 */}
      {!checked && !locked && item.kind !== 'essay' && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onCheck}
            className="rounded-md bg-[#2eaadc] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#2898c4] active:bg-[#2388b0]"
          >
            确认答案
          </button>
        </div>
      )}

      {/* 结果与解析 */}
      {checked && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <Verdict state={result.state}>
            {result.state === 'ok' ? '正确' : result.state === 'part' ? '部分正确' : '错误'}
            {result.full ? (
              <span className="ml-1 font-normal text-gray-600">
                得分 {(+(result.score || 0)).toFixed(1)} / {result.full}
              </span>
            ) : null}
            {result.okN != null ? (
              <span className="ml-1 font-normal text-gray-600">
                （答对 {result.okN} / {result.total} 空）
              </span>
            ) : null}
          </Verdict>

          {cor && (
            <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm">
              <span className="text-gray-600">正确答案：</span>
              <span className="font-mono font-medium text-[#37352f]">{cor}</span>
            </p>
          )}

          {showExp && (
            <div className="mt-3 space-y-3">
              {item.refAnswer && (
                <div className="rounded-md bg-gray-50 px-3 py-2">
                  <p className="mb-1 text-xs font-medium text-gray-600">参考答案</p>
                  <p className="n-measure whitespace-pre-wrap text-sm leading-6 text-[#37352f]">
                    {item.refAnswer}
                  </p>
                </div>
              )}
              <div>
                <p className="mb-1 text-xs font-medium text-gray-600">解析</p>
                <div className="n-measure whitespace-pre-wrap text-sm leading-6 text-[#37352f]">
                  <RichText text={item.expl} />
                </div>
              </div>
            </div>
          )}

          {item.kind !== 'essay' && (
            <button
              type="button"
              onClick={onToggleShow}
              className="n-btn mt-3 px-0 text-[#2eaadc] hover:bg-transparent hover:underline"
            >
              {showExp ? '隐藏解析' : '查看解析'}
            </button>
          )}
        </div>
      )}

      {/* 我的笔记 */}
      {onNote && (
        <div className="mt-4 border-t border-gray-200 pt-3">
          <button
            type="button"
            onClick={() => setNoteOpen((v) => !v)}
            className="n-btn px-0 text-xs text-[#2eaadc] hover:bg-transparent hover:underline"
          >
            {note ? '我的笔记（已记录）' : '添加笔记'}
          </button>
          {noteOpen && (
            <div className="mt-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                placeholder="写下你的理解、易错点…"
                className="n-input w-full px-3 py-2 text-sm"
              />
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onNote(draft.trim())
                    setNoteOpen(false)
                  }}
                  className="rounded-md bg-[#2eaadc] px-3 py-1 text-xs font-medium text-white hover:bg-[#2898c4]"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft('')
                    onNote('')
                    setNoteOpen(false)
                  }}
                  className="n-btn border border-gray-200 px-3 py-1 text-xs text-gray-600"
                >
                  删除
                </button>
              </div>
            </div>
          )}
          {!noteOpen && note && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{note}</p>}
        </div>
      )}
    </article>
  )
}
