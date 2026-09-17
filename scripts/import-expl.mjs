#!/usr/bin/env node
/**
 * 批量补全解析：把 { "题目id": "解析文本" } 合并进题库文件。
 * 用法：
 *   node scripts/import-expl.mjs server/data/bank_42.json expl.json
 *   node scripts/import-expl.mjs server/data/bank_42.json expl.json --fill-only   # 只填空缺
 *   node scripts/import-expl.mjs server/data/bank_42.json expl.json --dry-run
 * expl.json 形如：
 *   { "123": "解析…", "456": "解析…" }
 */
import fs from 'node:fs'

const [bankPath, explPath, ...flags] = process.argv.slice(2)
if (!bankPath || !explPath) {
  console.error('用法: node scripts/import-expl.mjs <bank.json> <expl.json> [--fill-only] [--dry-run]')
  process.exit(1)
}
const fillOnly = flags.includes('--fill-only')
const dryRun = flags.includes('--dry-run')

const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'))
const map = JSON.parse(fs.readFileSync(explPath, 'utf8'))
if (!Array.isArray(bank.questions)) {
  console.error('题库文件缺少 questions 数组')
  process.exit(1)
}
let filled = 0, overwritten = 0, skipped = 0, missing = 0
const seen = new Set()
for (const q of bank.questions) {
  const text = map[String(q.id)]
  if (text == null) continue
  seen.add(String(q.id))
  if (q.expl && q.expl.trim() && fillOnly) { skipped++; continue }
  if (q.expl === text) { skipped++; continue }
  if (q.expl && q.expl.trim()) overwritten++
  else filled++
  q.expl = String(text)
}
missing = Object.keys(map).filter((k) => !seen.has(k)).length
console.log(`题库 ${bank.name || bankPath}: 新增解析 ${filled}, 覆盖 ${overwritten}, 跳过 ${skipped}, 未匹配到题目 ${missing}`)
if (dryRun) {
  console.log('(--dry-run，未写回)')
} else {
  fs.writeFileSync(bankPath, JSON.stringify(bank))
  console.log('已写回 ' + bankPath + '（重启服务生效）')
}
