// Segmented controls and tab bars: the selected option's highlight slides across to the new one instead
// of jumping (CHECKLIST.md #03). It works on every app's own .segmented / .seg / .tabs / .views group
// without touching their markup: the highlight is the group's ::after, placed from CSS variables, and
// it copies the selected option's own background, shadow and corners so each app keeps its look.
// State lives in data attributes and inline custom properties, which Vue's class patching leaves alone.
const GROUP = ':is(.segmented, .seg, .tabs, .views):is([role="radiogroup"], [role="tablist"])'
const PICKED = ':scope > :is([aria-checked="true"], [aria-selected="true"], .active, .on, :has(> input:checked))'

export default defineNuxtPlugin(() => {
  const groups = new Set<HTMLElement>()
  const skipped = new WeakSet<HTMLElement>()
  const CLEAR = 'rgba(0, 0, 0, 0)'
  const sizes = new ResizeObserver(entries => entries.forEach(e => place(e.target as HTMLElement)))

  // Read the selected option's own look with the slide switched off for a moment (and its transitions
  // paused, so the read isn't caught mid-fade), then hand the painting back to the slide
  function capture(group: HTMLElement, picked: HTMLElement) {
    const hadPill = 'pill' in group.dataset
    delete group.dataset.pill
    picked.style.transition = 'none'
    const s = getComputedStyle(picked)
    group.style.setProperty('--pill-bg', s.backgroundColor)
    group.style.setProperty('--pill-shadow', s.boxShadow)
    group.style.setProperty('--pill-radius', s.borderRadius)
    if (hadPill) group.dataset.pill = ''
    void picked.offsetWidth
    picked.style.transition = ''
  }

  function place(group: HTMLElement) {
    if (!group.isConnected) {
      sizes.unobserve(group)
      groups.delete(group)
      return
    }
    const picked = group.querySelector<HTMLElement>(PICKED)
    if (!picked || !picked.offsetWidth) {
      delete group.dataset.pill
      delete group.dataset.pillGlide
      return
    }
    if (!('pill' in group.dataset)) {
      capture(group, picked)
      // Nothing to slide (an underline tab bar), or every option paints its own colour (swatches): leave it be
      const plain = group.style.getPropertyValue('--pill-bg') === CLEAR && group.style.getPropertyValue('--pill-shadow') === 'none'
      const sibling = [...group.children].find(c => c !== picked) as HTMLElement | undefined
      if (plain || (sibling && getComputedStyle(sibling).backgroundColor !== CLEAR)) {
        sizes.unobserve(group)
        groups.delete(group)
        skipped.add(group)
        delete group.dataset.pillRel
        return
      }
    }
    group.style.setProperty('--pill-x', `${picked.offsetLeft}px`)
    group.style.setProperty('--pill-y', `${picked.offsetTop}px`)
    group.style.setProperty('--pill-w', `${picked.offsetWidth}px`)
    group.style.setProperty('--pill-h', `${picked.offsetHeight}px`)
    if (!('pill' in group.dataset)) {
      group.dataset.pill = ''
      // Appear in place first; only later moves slide
      requestAnimationFrame(() => requestAnimationFrame(() => (group.dataset.pillGlide = '')))
    }
  }

  function adopt(group: HTMLElement) {
    if (groups.has(group) || skipped.has(group)) return
    groups.add(group)
    if (getComputedStyle(group).position === 'static') group.dataset.pillRel = ''
    sizes.observe(group)
    place(group)
  }

  function scan(root: ParentNode) {
    if (root instanceof HTMLElement && root.matches(GROUP)) adopt(root)
    root.querySelectorAll<HTMLElement>(GROUP).forEach(adopt)
  }

  // Batch everything that happened in a frame into one pass
  const dirty = new Set<HTMLElement>()
  let queued = false
  function flush() {
    queued = false
    dirty.forEach(place)
    dirty.clear()
  }
  function mark(group: HTMLElement | null | undefined) {
    if (!group || !groups.has(group)) return
    dirty.add(group)
    if (!queued) {
      queued = true
      requestAnimationFrame(flush)
    }
  }

  const changes = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'childList') {
        r.addedNodes.forEach(n => n instanceof HTMLElement && scan(n))
        if (r.target instanceof HTMLElement) mark(r.target.closest<HTMLElement>(GROUP))
      } else if (r.target instanceof HTMLElement) {
        mark(r.target.closest<HTMLElement>(GROUP))
      }
    }
  })

  // The theme (light, dark or a new accent) decides the copied colours, so read them again when it changes
  const theme = new MutationObserver(() => groups.forEach((g) => {
    const picked = g.querySelector<HTMLElement>(PICKED)
    if (picked && 'pill' in g.dataset) capture(g, picked)
  }))

  onNuxtReady(() => {
    scan(document.body)
    changes.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-checked', 'aria-selected'] })
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] })
    // A radio's checked state is a property, not an attribute, so listen for the change itself
    document.addEventListener('change', e => mark((e.target as HTMLElement).closest<HTMLElement>(GROUP)), true)
    addEventListener('resize', () => groups.forEach(g => mark(g)))
  })
})
