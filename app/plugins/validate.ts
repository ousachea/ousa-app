// Form validation shared by every app.
//
// v-validate, on a <form>: the browser's own checks (required, min, type="url"…) decide what's wrong,
// but the app shows it. On submit, if anything is missing, the form doesn't submit: the first problem
// field gets focus and a small shake, every problem field gets a red outline and a message under it,
// and nothing already typed is lost. Messages clear as soon as the field is fixed.
//
// v-check="message", on any field: an extra rule of the page's own. Pass a message while the value is
// wrong and '' (or nothing) once it's fine, e.g. v-check="parseLink(form.url) ? '' : 'Enter a link like nuxt.com'".
//
// Optional on a field: data-error="Give it a name" replaces the message for a missing value.
// Custom inputs (DatePicker) mark the element that should show the error with data-validate-target.

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

const isField = (el: Element): el is Field =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement

// The element that should look invalid: a custom control's visible part, the .input wrapper, or the field itself
function targetOf(el: Field): HTMLElement {
  return el.closest<HTMLElement>('[data-validate-target]')
    ?? (el.classList.contains('input') ? el : el.closest<HTMLElement>('.input'))
    ?? el
}

// Only spaces counts as empty, the same as the apps' own checks (which trim names before saving)
const TEXTY = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'textarea'])
const blank = (el: Field) => el.required && TEXTY.has(el.type) && el.value !== '' && !el.value.trim()
const isValid = (el: Field) => el.checkValidity() && !blank(el)

function messageFor(el: Field) {
  const v = el.validity
  if (v.customError) return el.validationMessage
  if (v.valueMissing || blank(el)) return el.dataset.error || (el instanceof HTMLSelectElement ? 'Choose one' : 'Required')
  if (v.rangeUnderflow) return `Must be at least ${(el as HTMLInputElement).min}`
  if (v.rangeOverflow) return `Must be ${(el as HTMLInputElement).max} or less`
  if (v.typeMismatch && (el as HTMLInputElement).type === 'email') return 'Enter an email address like name@example.com'
  if (v.typeMismatch && (el as HTMLInputElement).type === 'url') return 'Enter a link like https://example.com'
  if (v.badInput) return 'Enter a number'
  if (v.stepMismatch) return 'Enter a rounder number'
  return el.validationMessage
}

// Hidden stand-ins (DatePicker's required input) pass their error to the control people actually reach
function labelled(el: Field): HTMLElement {
  return el.getAttribute('aria-hidden') === 'true' ? targetOf(el).querySelector<HTMLElement>('.input, button') ?? el : el
}

let counter = 0
const errors = new WeakMap<Field, HTMLElement>()

function clear(el: Field) {
  const target = targetOf(el)
  const reach = labelled(el)
  target.classList.remove('is-invalid')
  el.removeAttribute('aria-invalid')
  reach.removeAttribute('aria-invalid')
  const msg = errors.get(el)
  if (msg) {
    const ids = (reach.getAttribute('aria-describedby') ?? '').split(' ').filter(id => id && id !== msg.id)
    if (ids.length) reach.setAttribute('aria-describedby', ids.join(' '))
    else reach.removeAttribute('aria-describedby')
    msg.remove()
    errors.delete(el)
  }
}

function show(el: Field) {
  const target = targetOf(el)
  const reach = labelled(el)
  target.classList.add('is-invalid')
  el.setAttribute('aria-invalid', 'true')
  reach.setAttribute('aria-invalid', 'true')
  let msg = errors.get(el)
  if (!msg) {
    msg = document.createElement('span')
    msg.className = 'field-error'
    msg.id = `field-error-${++counter}`
    // Under the whole label (so it doesn't squeeze in beside a unit or button), else right after the control
    const anchor = target.closest('label, .field') ?? target
    anchor.insertAdjacentElement(anchor === target ? 'afterend' : 'beforeend', msg)
    errors.set(el, msg)
    reach.setAttribute('aria-describedby', [reach.getAttribute('aria-describedby'), msg.id].filter(Boolean).join(' '))
  }
  msg.textContent = messageFor(el)
}

function shake(el: HTMLElement) {
  el.classList.remove('shake')
  // Restart the animation even if it's still running from a moment ago
  void el.offsetWidth
  el.classList.add('shake')
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true })
}

// Re-check one field as it's edited; only fields already flagged update, so nothing turns red while typing
function recheck(e: Event) {
  const el = e.target as Element
  if (!isField(el) || !el.hasAttribute('aria-invalid')) return
  if (isValid(el)) clear(el)
  else show(el)
}

function onSubmit(e: SubmitEvent) {
  const form = e.currentTarget as HTMLFormElement
  const fields = [...form.elements].filter(isField)
  const invalid = fields.filter(el => !el.willValidate || isValid(el) ? (clear(el), false) : true)
  if (!invalid.length) return

  // Stop the page's own @submit handler: this capture listener runs first on the form
  e.preventDefault()
  e.stopImmediatePropagation()
  invalid.forEach(show)
  const first = invalid[0]!
  first.focus({ preventScroll: true })
  targetOf(first).scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  shake(targetOf(first))
  useSound().play('error')
}

// Revalidate everything after an external change (e.g. a form reset by the page)
function resetAll(form: HTMLFormElement) {
  for (const el of [...form.elements].filter(isField)) clear(el)
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive<HTMLFormElement>('validate', {
    mounted(form) {
      form.noValidate = true
      form.addEventListener('submit', onSubmit as EventListener, { capture: true })
      form.addEventListener('input', recheck)
      form.addEventListener('change', recheck)
      form.addEventListener('reset', () => resetAll(form))
    },
    unmounted(form) {
      form.removeEventListener('submit', onSubmit as EventListener, { capture: true })
      form.removeEventListener('input', recheck)
      form.removeEventListener('change', recheck)
    },
    getSSRProps: () => ({ novalidate: true })
  })

  nuxtApp.vueApp.directive<Field, string | false | null | undefined>('check', {
    mounted(el, { value }) {
      el.setCustomValidity(value || '')
    },
    updated(el, { value }) {
      el.setCustomValidity(value || '')
      // Keep a visible message in step with the rule
      if (el.hasAttribute('aria-invalid')) {
        if (isValid(el)) clear(el)
        else show(el)
      }
    },
    getSSRProps: () => ({})
  })
})
