<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { AuditSectionId } from '~/utils/craftAudit'

// Ousa Chea's UX, Animation & Craft Audit, as a guide: each of the 90 checks shown as the same element
// done wrong (Before) and right (After), side by side. Nothing to fill in and nothing saved.
const query = ref('')
const sections = computed(() => {
  const q = query.value.trim().toLowerCase()
  return AUDIT_SECTIONS.map((section, i) => ({
    section,
    n: i + 1,
    checks: AUDIT_CHECKS.filter(c => c.section === section.id && (!q || `${c.id} ${c.title} ${c.hint} ${c.before} ${c.after}`.toLowerCase().includes(q)))
  })).filter(s => s.checks.length)
})

function jump(id: AuditSectionId) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(`audit-${id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

// The same 90 checks as a Claude skill, so Claude can audit a project against them. The files live in
// public/skills; after changing SKILL.md, run `npm run skill:zip` to rebuild the download
const SKILL = '/skills/ousa-ux-ui-animation-principal'
const { play } = useSound()
const copiedSkill = ref(false)
async function copySkill() {
  try {
    const res = await fetch(`${SKILL}/SKILL.md`)
    if (!res.ok) throw new Error(String(res.status))
    await navigator.clipboard.writeText(await res.text())
    copiedSkill.value = true
    setTimeout(() => { copiedSkill.value = false }, 1800)
    play('success')
    toast.success('SKILL.md copied', { duration: 1800 })
  } catch {
    toast.error('Couldn’t copy the skill', { description: 'Download it instead, or try again once you’re online.' })
  }
}

// With Reduce motion on (the device's or Settings'), the motion examples jump straight to their end
const motionOff = ref(false)
onMounted(() => {
  motionOff.value = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced'
})
</script>

<template>
  <ToolPage header="bar">
    <div class="guide">
      <p class="intro">
        Ousa Chea’s 90 checks for UX, animation and craft. Each one shows the same thing done two ways:
        <strong class="bad">Before</strong>, the common mistake, and <strong class="good">After</strong>, the fix.
        Press <strong>Play</strong> to replay the motion, and try the ones you can tap or drag.
      </p>
      <section class="panel skill" aria-labelledby="skill-title">
        <div class="skill-text">
          <h2 id="skill-title">Audit with Claude</h2>
          <p>Add these 90 checks to Claude as a skill, and ask it to audit your own project: it marks each one applied or not, with the evidence.</p>
          <p class="fine">Upload the .zip in Claude’s Skills settings. For Claude Code, put SKILL.md in <code>~/.claude/skills/ousa-ux-ui-animation-principal/</code>.</p>
        </div>
        <div class="skill-actions">
          <a class="btn" :href="`${SKILL}.zip`" download="ousa-ux-ui-animation-principal.zip"><AppIcon name="download" />Add the skill to Claude</a>
          <button type="button" class="btn btn-quiet" @click="copySkill"><AppIcon :name="copiedSkill ? 'check' : 'copy'" />Copy SKILL.md</button>
        </div>
      </section>

      <p v-if="motionOff" class="panel note" role="status">
        Reduce motion is on, so the motion examples jump straight to their end. Turn it off in Settings to watch them move.
      </p>

      <div v-sticky-bar class="toolbar sticky-bar">
        <div class="find">
          <AppIcon name="search" class="find-icon" />
          <input v-model="query" class="input" type="search" enterkeyhint="search" placeholder="Search the 90 checks" aria-label="Search the checks">
        </div>
        <nav class="chips" aria-label="Sections">
          <button v-for="s in sections" :key="s.section.id" type="button" class="section-chip" @click="jump(s.section.id)">
            {{ s.n }} · {{ s.section.title }} <span class="count">{{ s.checks.length }}</span>
          </button>
        </nav>
      </div>

      <section v-for="s in sections" :id="`audit-${s.section.id}`" :key="s.section.id" class="section" :aria-labelledby="`audit-${s.section.id}-title`">
        <h2 :id="`audit-${s.section.id}-title`">{{ s.n }} · {{ s.section.title }} <span class="count">{{ s.checks.length }}</span></h2>
        <AuditDemo v-for="c in s.checks" :key="c.id" :check="c" />
      </section>

      <div v-if="!sections.length" class="panel">
        <EmptyState title="Nothing matches" icon="search" action="Show all 90" @action="query = ''">
          No check matches “{{ query }}”. Try a word like motion, input or colour.
        </EmptyState>
      </div>
    </div>
  </ToolPage>
</template>

<style scoped>
.guide {
  display: grid;
  /* minmax(0, …) keeps wide examples inside their cards instead of widening the page */
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

.intro {
  max-width: 68ch;
  margin: 0;
  color: var(--ink-2);
}

.intro .bad {
  color: var(--bad-ink);
}

.intro .good {
  color: var(--good-ink);
}

.skill {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem 1.5rem;
  padding: 1.1rem 1.25rem;
}

.skill-text {
  flex: 1 1 22rem;
  min-width: 0;
}

.skill h2 {
  font-size: var(--text-title);
}

.skill p {
  margin: 0.3rem 0 0;
  color: var(--ink-2);
}

.skill .fine {
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.skill code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  overflow-wrap: anywhere;
}

.skill-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.note {
  margin: 0;
  padding: 0.85rem 1rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.toolbar {
  display: grid;
  gap: 0.6rem;
}

.find {
  position: relative;
}

.find-icon {
  position: absolute;
  top: 50%;
  left: 0.85rem;
  translate: 0 -50%;
  color: var(--ink-3);
  pointer-events: none;
}

.find .input {
  padding-left: 2.5rem;
}

/* Section chips scroll sideways on a phone; the edges fade so it's clear there's more */
.chips {
  display: flex;
  gap: 0.4rem;
  margin-inline: -0.5rem;
  padding: 0.1rem 0.5rem;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  mask-image: linear-gradient(to right, transparent, #000 0.5rem, #000 calc(100% - 1.25rem), transparent);
}

.section-chip {
  flex: none;
  min-height: 2.75rem;
  padding: 0 0.9rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  scroll-snap-align: start;
  cursor: pointer;
  transition: background-color var(--dur-fast), scale 0.1s;
}

.section-chip:hover {
  background: var(--surface-2);
}

.section-chip:active {
  scale: 0.97;
}

.count {
  margin-left: 0.2rem;
  color: var(--ink-3);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.section {
  display: grid;
  gap: 0.85rem;
  margin-top: 1rem;
  scroll-margin-top: 9rem;
}

.section h2 {
  font-size: var(--text-lg);
}
</style>
