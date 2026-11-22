// node postcss/hover-only.test.mjs
import assert from 'node:assert/strict'
import postcss from 'postcss'
import hoverOnly from './hover-only.mjs'

const squash = css => css.replace(/\s+/g, '')
const check = (input, expected) =>
  assert.equal(squash(postcss([hoverOnly()]).process(input, { from: undefined }).css), squash(expected))

check('.a:hover { color: red }', '@media (hover: hover) { .a:hover { color: red } }')
// Mixed selectors split: focus styles stay for everyone
check('.a:hover, .a:focus-visible { color: red }',
  '.a:focus-visible { color: red } @media (hover: hover) { .a:hover { color: red } }')
// Already guarded, and "not hovered" rules, are untouched
check('@media (hover: hover) and (pointer: fine) { .a:hover { x: 1 } }', '@media (hover: hover) and (pointer: fine) { .a:hover { x: 1 } }')
check('.bar:not(:hover, :focus-within) { opacity: 0 }', '.bar:not(:hover, :focus-within) { opacity: 0 }')
check('.b { x: 1 }', '.b { x: 1 }')
// A real :hover outside the :not() still counts
check('.m:hover:not(:has(.x:hover)) .t { c: 1 }', '@media (hover: hover) { .m:hover:not(:has(.x:hover)) .t { c: 1 } }')
console.log('hover-only: ok')
