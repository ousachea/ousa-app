// node scripts/craftAudit.test.mjs: self-check for app/utils/craftAudit.ts (the Audit app's checks)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AUDIT_CHECKS, AUDIT_SECTIONS } from '../app/utils/craftAudit.ts'

assert.equal(AUDIT_CHECKS.length, 90)
assert.equal(new Set(AUDIT_CHECKS.map(c => c.id)).size, 90)
assert.deepEqual(Object.fromEntries(AUDIT_SECTIONS.map(s => [s.prefix, AUDIT_CHECKS.filter(c => c.section === s.id).length])), { C: 20, V: 10, M: 10, T: 10, P: 20, D: 20 })
for (const c of AUDIT_CHECKS) {
  assert.ok(c.before && c.after && c.before !== c.after, `${c.id} needs two different captions`)
  assert.ok(['play', 'try', 'look'].includes(c.kind), `${c.id} kind`)
}

// Every check has an example in its section's component
const FILE = { core: 'Core', visual: 'Visual', mobile: 'Mobile', type: 'Type', polish: 'Polish', motion: 'Motion' }
for (const s of AUDIT_SECTIONS) {
  const src = readFileSync(new URL(`../app/components/audit/AuditDemo${FILE[s.id]}.vue`, import.meta.url), 'utf8')
  for (const c of AUDIT_CHECKS.filter(x => x.section === s.id)) {
    assert.ok(src.includes(`'${c.id}'`), `${c.id} has no example in AuditDemo${FILE[s.id]}.vue`)
  }
}
console.log('craftAudit: ok')
