import { grade } from './src/grading.js'

let pass = 0, fail = 0
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) { pass++ } else { fail++; console.log('  FAIL', name, 'got', JSON.stringify(got), 'want', JSON.stringify(want)) }
}

// single
const s = { kind: 'single', score: 2, letters: 'B' }
eq('single right', grade(s, { letters: 'B' }).state, 'ok')
eq('single wrong', grade(s, { letters: 'C' }).state, 'bad')
eq('single none', grade(s, { letters: '' }).state, 'none')

// multi with partial credit
const m = { kind: 'multi', score: 2, half: 1, letters: 'ABC' }
eq('multi exact', grade(m, { letters: 'ABC' }).state, 'ok')
eq('multi exact reorder', grade(m, { letters: 'CBA' }).state, 'ok')
eq('multi partial', grade(m, { letters: 'AB' }).state, 'part')
eq('multi partial score', grade(m, { letters: 'AB' }).score, 1)
eq('multi extra -> bad', grade(m, { letters: 'ABCD' }).state, 'bad')
eq('multi wrong', grade(m, { letters: 'DE' }).state, 'bad')

// fill: "两 / 二 / 2"
const f = { kind: 'fill', score: 3, fills: [{ n: 1, alts: ['两', '二', '2'] }, { n: 2, alts: ['Char', 'char(10)'] }] }
eq('fill all right', grade(f, { fills: ['二', 'CHAR'] }).state, 'ok')
eq('fill case+space insensitive', grade(f, { fills: [' 2 ', ' char(10) '] }).state, 'ok')
eq('fill half', grade(f, { fills: ['两', 'nope'] }).state, 'part')
eq('fill half score', grade(f, { fills: ['两', 'nope'] }).score, 1.5)
eq('fill all wrong', grade(f, { fills: ['x', 'y'] }).state, 'bad')
eq('fill none', grade(f, { fills: [] }).state, 'none')

// essay
eq('essay self ok', grade({ kind: 'essay', score: 10 }, { selfGrade: 'ok' }).state, 'ok')
eq('essay self bad', grade({ kind: 'essay', score: 10 }, { selfGrade: 'bad' }).state, 'bad')

// letters with messy input
eq('messy letters', grade({ kind: 'multi', score: 2, half: 1, letters: 'A,C,E,B' }, { letters: 'ABCE' }).state, 'ok')

console.log('\n' + pass + ' passed, ' + fail + ' failed')
process.exit(fail ? 1 : 0)
