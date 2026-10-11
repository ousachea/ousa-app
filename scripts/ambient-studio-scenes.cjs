// Draws Ambient Studio's scene artwork into public/ambient-studio/scenes/<name>.svg.
// Flat, layered illustrations (no photos to license); a fixed seed keeps them the same each run.
// Run: node scripts/ambient-studio-scenes.cjs
const fs = require('node:fs')
const path = require('node:path')

const OUT = path.join(__dirname, '..', 'public', 'ambient-studio', 'scenes')
const W = 1600
const H = 900

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const f = n => Math.round(n * 10) / 10

function svg(defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<defs>
<filter id="blur8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="blur24" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="24"/></filter>
<filter id="blur60" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter>
${defs}
</defs>
${body}
</svg>
`
}

const lin = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`
const rad = (id, stops, cx = 0.5, cy = 0.5, r = 0.5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`

function stars(r, n, maxY, color = '#fff') {
  let s = ''
  for (let i = 0; i < n; i++) s += `<circle cx="${f(r() * W)}" cy="${f(r() ** 1.3 * maxY)}" r="${f(0.6 + r() * 1.6)}" fill="${color}" opacity="${f(0.3 + r() * 0.7)}"/>`
  return s
}

// A ridge line across the picture: a smoothed random walk, filled down to the bottom
function ridge(r, y, rough, color, step = 80, opacity = 1) {
  let d = `M0 ${H} L0 ${y}`
  let cur = y
  for (let x = step; x <= W + step; x += step) {
    cur = Math.max(y - rough, Math.min(y + rough, cur + (r() - 0.5) * rough))
    d += ` Q${f(x - step / 2)} ${f(cur + (r() - 0.5) * rough * 0.5)} ${x} ${f(cur)}`
  }
  return `<path d="${d} L${W + step} ${H} Z" fill="${color}" opacity="${opacity}"/>`
}

function pines(r, n, baseY, minH, maxH, color) {
  let s = ''
  for (let i = 0; i < n; i++) {
    const x = r() * W
    const h = minH + r() * (maxH - minH)
    const w = h * (0.22 + r() * 0.1)
    s += `<path d="M${f(x)} ${f(baseY - h)} L${f(x + w / 2)} ${f(baseY)} L${f(x - w / 2)} ${f(baseY)} Z" fill="${color}"/>`
  }
  return s
}

function skyline(r, baseY, minH, maxH, color, windowColor, windowRate = 0.25) {
  let s = ''
  let x = -20
  while (x < W) {
    const w = 60 + r() * 110
    const h = minH + r() * (maxH - minH)
    s += `<rect x="${f(x)}" y="${f(baseY - h)}" width="${f(w)}" height="${f(h + 4)}" fill="${color}"/>`
    if (windowColor) {
      for (let wy = baseY - h + 14; wy < baseY - 10; wy += 22) {
        for (let wx = x + 10; wx < x + w - 14; wx += 18) {
          if (r() < windowRate) s += `<rect x="${f(wx)}" y="${f(wy)}" width="8" height="11" fill="${windowColor}" opacity="${f(0.4 + r() * 0.6)}"/>`
        }
      }
    }
    x += w + r() * 6
  }
  return s
}

function bokeh(r, n, y0, y1, colors, rMin, rMax, opacity = 0.5) {
  let s = ''
  for (let i = 0; i < n; i++) {
    s += `<circle cx="${f(r() * W)}" cy="${f(y0 + r() * (y1 - y0))}" r="${f(rMin + r() * (rMax - rMin))}" fill="${colors[Math.floor(r() * colors.length)]}" opacity="${f(opacity * (0.4 + r() * 0.6))}"/>`
  }
  return s
}

function rainStreaks(r, n, color, opacity = 0.25) {
  let s = ''
  for (let i = 0; i < n; i++) {
    const x = r() * W
    const y = r() * H
    const l = 20 + r() * 40
    s += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x - l * 0.15)}" y2="${f(y + l)}" stroke="${color}" stroke-width="1.2" opacity="${f(opacity * (0.4 + r() * 0.6))}"/>`
  }
  return s
}

const scenes = {
  'rainy-window'(r) {
    return svg(lin('sky', [[0, '#1a2436'], [1, '#2c3c55']]) + lin('room', [[0, '#0d1118'], [1, '#07090d']]),
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>
<g filter="url(#blur24)">${bokeh(r, 46, 380, 820, ['#f2c27a', '#8fb0e0', '#e88f6a', '#cfe0ff'], 10, 34, 0.75)}</g>
<g opacity="0.9">${skyline(r, 820, 120, 380, '#152031', null)}</g>
<g filter="url(#blur8)" opacity="0.6">${rainStreaks(r, 140, '#cfe0ff', 0.5)}</g>
<path d="M0 0H${W}V${H}H0Z M180 90V780H1420V90Z" fill="url(#room)" fill-rule="evenodd"/>
<rect x="785" y="90" width="30" height="690" fill="#0b0e14"/><rect x="180" y="420" width="1240" height="26" fill="#0b0e14"/>
<rect x="140" y="780" width="1320" height="40" rx="6" fill="#141922"/>
<path d="M1230 780c-10-70 20-120 60-150-30 40-30 90-10 150zm40 0c10-60 50-100 90-110-40 30-60 70-60 110z" fill="#0a0d12"/>
<rect x="1240" y="740" width="70" height="42" rx="6" fill="#1b2230"/>`)
  },

  'tokyo-after-dark'(r) {
    let signs = ''
    for (let i = 0; i < 14; i++) {
      const left = i % 2 === 0
      const x = left ? 120 + r() * 300 : 1180 + r() * 300
      const y = 120 + r() * 480
      const c = ['#ff5fa2', '#4fd6d0', '#ffb347', '#9b8cff'][Math.floor(r() * 4)]
      signs += `<rect x="${f(x)}" y="${f(y)}" width="${f(26 + r() * 30)}" height="${f(80 + r() * 140)}" rx="4" fill="${c}" opacity="0.85"/><rect x="${f(x - 10)}" y="${f(y - 10)}" width="70" height="240" fill="${c}" opacity="0.18" filter="url(#blur24)"/>`
    }
    return svg(lin('sky', [[0, '#120d22'], [1, '#2a1838']]) + lin('road', [[0, '#1a1426'], [1, '#08070c']]),
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>
${stars(r, 40, 200, '#d9c9ff')}
<path d="M0 0H520L640 680H0Z" fill="#0f0b18"/><path d="M${W} 0H1080L960 680H${W}Z" fill="#0f0b18"/>
<g opacity="0.9">${skyline(r, 640, 80, 260, '#1b1428', '#ffcf8a', 0.2)}</g>
${signs}
<rect y="660" width="${W}" height="240" fill="url(#road)"/>
<g filter="url(#blur24)" opacity="0.5" transform="translate(0 1320) scale(1 -1)">${signs}</g>
${[0, 1, 2, 3, 4].map(i => `<circle cx="${560 + i * 120}" cy="${150 + i * 18}" r="16" fill="#ff7a59"/><circle cx="${560 + i * 120}" cy="${150 + i * 18}" r="40" fill="#ff7a59" opacity="0.3" filter="url(#blur24)"/>`).join('')}
<path d="M500 ${150}Q800 220 1100 150" stroke="#2b2238" stroke-width="3" fill="none"/>`)
  },

  'cozy-fireplace'(r) {
    let logs = ''
    for (let i = 0; i < 3; i++) logs += `<rect x="${660 + i * 80}" y="${650 - (i % 2) * 18}" width="150" height="30" rx="15" fill="#3a2214" transform="rotate(${(i - 1) * 8} ${735 + i * 80} 665)"/>`
    return svg(lin('wall', [[0, '#2a1a14'], [1, '#140c09']]) + rad('fire', [[0, '#ffd27a'], [0.35, '#ff8a3c'], [0.7, '#b8361b', 0.6], [1, '#5a1a0b', 0]], 0.5, 0.75, 0.6) + rad('glow', [[0, '#ff9b4a', 0.55], [1, '#ff9b4a', 0]]),
      `<rect width="${W}" height="${H}" fill="url(#wall)"/>
<ellipse cx="800" cy="600" rx="760" ry="420" fill="url(#glow)"/>
<rect x="430" y="250" width="740" height="560" rx="18" fill="#3d2a22"/>
<rect x="380" y="220" width="840" height="50" rx="10" fill="#4a3329"/>
<path d="M560 810V470a240 200 0 0 1 480 0V810Z" fill="#0b0605"/>
<ellipse cx="800" cy="640" rx="200" ry="160" fill="url(#fire)" filter="url(#blur8)"/>
<path d="M720 670c0-80 50-90 40-170 50 40 60 90 50 130 20-30 30-60 20-90 40 40 50 100 30 130z" fill="#ffcf6b" opacity="0.9"/>
${logs}
<rect y="810" width="${W}" height="90" fill="#0e0807"/>
<path d="M1240 900V640q0-60 60-60h140q60 0 60 60V900Z" fill="#160d0a"/><rect x="1200" y="700" width="340" height="120" rx="40" fill="#1c110d"/>
<rect x="520" y="170" width="70" height="50" rx="6" fill="#5b3f2f"/><rect x="980" y="150" width="40" height="70" rx="6" fill="#6b4b36"/>`)
  },

  'deep-focus'(r) {
    return svg(lin('bg', [[0, '#0d1a1a'], [1, '#071010']]) + rad('lamp', [[0, '#bff1e2', 0.5], [1, '#bff1e2', 0]]),
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>
<ellipse cx="560" cy="560" rx="600" ry="380" fill="url(#lamp)"/>
<g filter="url(#blur60)" opacity="0.5">${bokeh(r, 10, 100, 500, ['#3fa38c', '#2c6f7a'], 60, 140, 0.6)}</g>
<rect x="760" y="250" width="560" height="340" rx="16" fill="#0a1414" stroke="#1d3a38" stroke-width="6"/>
<rect x="790" y="280" width="500" height="280" rx="8" fill="#123a36"/>
${[0, 1, 2, 3, 4, 5].map(i => `<rect x="830" y="${320 + i * 34}" width="${f(160 + r() * 260)}" height="10" rx="5" fill="#9fd3c7" opacity="${f(0.25 + r() * 0.3)}"/>`).join('')}
<rect x="1010" y="590" width="60" height="60" fill="#0f1d1d"/>
<rect y="650" width="${W}" height="250" fill="#0b1515"/><rect y="650" width="${W}" height="10" fill="#183030"/>
<path d="M420 650l40-260 110-60" stroke="#1d3a38" stroke-width="12" fill="none" stroke-linecap="round"/>
<path d="M540 300l110 30-40 70-110-40z" fill="#1d3a38"/>
<rect x="300" y="610" width="200" height="40" rx="6" fill="#163030"/><rect x="1380" y="560" width="60" height="90" rx="10" fill="#163030"/>`)
  },

  'ocean-at-midnight'(r) {
    return svg(lin('sky', [[0, '#050a1a'], [0.6, '#122348'], [1, '#1d3462']]) + lin('sea', [[0, '#0f2142'], [1, '#050b18']]) + rad('moon', [[0, '#fffbe8', 0.5], [1, '#fffbe8', 0]]),
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>
${stars(r, 220, 480)}
<circle cx="1120" cy="210" r="200" fill="url(#moon)"/><circle cx="1120" cy="210" r="56" fill="#f6f1dc"/>
<rect y="520" width="${W}" height="380" fill="url(#sea)"/>
${Array.from({ length: 26 }, (_, i) => `<rect x="${f(1120 - (20 + i * 9) / 2 + (r() - 0.5) * 30)}" y="${530 + i * 12}" width="${20 + i * 9}" height="3" rx="1.5" fill="#f6f1dc" opacity="${f(0.55 - i * 0.018)}"/>`).join('')}
${Array.from({ length: 6 }, (_, i) => `<path d="M0 ${640 + i * 40}Q400 ${620 + i * 40} 800 ${640 + i * 40}T1600 ${640 + i * 40}" stroke="#7fa6d9" stroke-width="1.5" fill="none" opacity="${f(0.12 + i * 0.02)}"/>`).join('')}
<path d="M0 820Q500 760 1000 800T1600 790V900H0Z" fill="#0c1222"/><path d="M0 830Q500 772 1000 812" stroke="#d5e4ff" stroke-width="2" fill="none" opacity="0.25"/>`)
  },

  'forest-after-rain'(r) {
    return svg(lin('sky', [[0, '#c9dccb'], [1, '#7f9e8a']]) + lin('mist', [[0, '#e6efe6', 0], [1, '#e6efe6', 0.7]]),
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>
<circle cx="1180" cy="200" r="220" fill="#f3f7e8" opacity="0.5" filter="url(#blur60)"/>
${pines(r, 40, 560, 220, 360, '#8fae98')}
<rect y="420" width="${W}" height="200" fill="url(#mist)"/>
${pines(r, 34, 700, 300, 480, '#5a7c66')}
<rect y="560" width="${W}" height="200" fill="url(#mist)" opacity="0.7"/>
${pines(r, 26, 900, 420, 680, '#2e4a3a')}
${ridge(r, 840, 30, '#1d3027')}
${pines(r, 8, 940, 600, 900, '#14231b')}`)
  },

  'spaceship-cabin'(r) {
    return svg(lin('hull', [[0, '#1a1b2e'], [1, '#0b0c16']]) + rad('planet', [[0, '#9a8cff'], [0.7, '#4b3fa8'], [1, '#1d1850']], 0.35, 0.3, 0.8) + rad('space', [[0, '#120f2e'], [1, '#04040c']]),
      `<rect width="${W}" height="${H}" fill="url(#hull)"/>
<circle cx="800" cy="430" r="350" fill="url(#space)"/>
<clipPath id="port"><circle cx="800" cy="430" r="350"/></clipPath>
<g clip-path="url(#port)">${stars(r, 160, 900)}<circle cx="980" cy="600" r="260" fill="url(#planet)"/><ellipse cx="980" cy="600" rx="420" ry="40" fill="none" stroke="#b4b2f2" stroke-width="6" opacity="0.5" transform="rotate(-12 980 600)"/></g>
<circle cx="800" cy="430" r="350" fill="none" stroke="#2a2c45" stroke-width="40"/>
<circle cx="800" cy="430" r="372" fill="none" stroke="#3a3d5c" stroke-width="4"/>
${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<circle cx="${f(800 + Math.cos(a) * 350)}" cy="${f(430 + Math.sin(a) * 350)}" r="7" fill="#4a4e72"/>` }).join('')}
<rect y="780" width="${W}" height="120" fill="#0e0f1c"/><rect y="780" width="${W}" height="6" fill="#2a2c45"/>
${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${200 + i * 160}" y="810" width="90" height="10" rx="5" fill="${['#b4b2f2', '#4fd6d0', '#ff8fa8'][i % 3]}" opacity="0.7"/>`).join('')}
<path d="M0 0H360L200 300H0Z" fill="#141528"/><path d="M${W} 0H1240L1400 300H${W}Z" fill="#141528"/>`)
  },

  'quiet-library'(r) {
    let shelves = ''
    for (const [x0, x1] of [[60, 520], [1080, 1540]]) {
      for (let y = 120; y < 760; y += 130) {
        shelves += `<rect x="${x0 - 10}" y="${y + 100}" width="${x1 - x0 + 20}" height="12" fill="#2a1d14"/>`
        let x = x0
        while (x < x1 - 20) {
          const w = 14 + r() * 16
          const h = 70 + r() * 28
          const c = ['#6b3a2a', '#3d4a3a', '#7a5a2e', '#33405c', '#5c2f3a', '#8a7650'][Math.floor(r() * 6)]
          shelves += `<rect x="${f(x)}" y="${f(y + 100 - h)}" width="${f(w)}" height="${f(h)}" rx="2" fill="${c}" opacity="0.85"/>`
          x += w + 2
        }
      }
    }
    return svg(lin('wall', [[0, '#1c140f'], [1, '#0d0a07']]) + rad('lamp', [[0, '#ffd98f', 0.55], [1, '#ffd98f', 0]]),
      `<rect width="${W}" height="${H}" fill="url(#wall)"/>
${shelves}
<rect x="600" y="80" width="400" height="520" rx="200" fill="#2b2a3a" opacity="0.6"/><rect x="620" y="100" width="360" height="500" rx="180" fill="#3a4766" opacity="0.5"/>
<ellipse cx="800" cy="640" rx="420" ry="220" fill="url(#lamp)"/>
<rect x="520" y="680" width="560" height="24" rx="6" fill="#3a271b"/><rect x="560" y="704" width="20" height="196" fill="#2a1d14"/><rect x="1020" y="704" width="20" height="196" fill="#2a1d14"/>
<path d="M760 680v-120h-40l40-60h80l40 60h-40v120z" fill="#c9a35a"/>
<rect x="640" y="662" width="90" height="18" rx="3" fill="#7a5a2e"/><rect x="870" y="664" width="100" height="16" rx="3" fill="#e8dcc0" opacity="0.8"/>`)
  },

  'thunderstorm'(r) {
    let clouds = ''
    for (let i = 0; i < 22; i++) clouds += `<ellipse cx="${f(r() * W)}" cy="${f(60 + r() * 260)}" rx="${f(160 + r() * 220)}" ry="${f(60 + r() * 80)}" fill="${['#2a3142', '#363e52', '#1f2533'][i % 3]}" opacity="0.9"/>`
    return svg(lin('sky', [[0, '#1a1f2c'], [1, '#3a4256']]) + rad('flash', [[0, '#dfe6ff', 0.6], [1, '#dfe6ff', 0]]),
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>
<ellipse cx="1050" cy="300" rx="420" ry="300" fill="url(#flash)"/>
<g filter="url(#blur24)">${clouds}</g>
<path d="M1060 220l-60 170h55l-80 200 150-240h-60l70-130z" fill="#eef2ff"/><path d="M1060 220l-60 170h55l-80 200 150-240h-60l70-130z" fill="#cdd8ff" filter="url(#blur24)"/>
${rainStreaks(r, 320, '#c9d4ea', 0.35)}
${ridge(r, 700, 70, '#1a1f2a', 100)}
${ridge(r, 780, 40, '#10141c', 120)}`)
  },

  'peaceful-night'(r) {
    return svg(lin('sky', [[0, '#070a18'], [1, '#1b2350']]),
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>
${stars(r, 260, 600)}
<circle cx="380" cy="200" r="70" fill="#f1ecd6"/><circle cx="410" cy="180" r="66" fill="#0b0f22"/>
<circle cx="380" cy="200" r="160" fill="#f1ecd6" opacity="0.08" filter="url(#blur24)"/>
${ridge(r, 620, 60, '#141a38', 120)}
${ridge(r, 700, 40, '#0e1328', 140)}
<rect x="1050" y="590" width="150" height="110" fill="#0a0d1d"/><path d="M1030 600l95-70 95 70z" fill="#0a0d1d"/>
<rect x="1105" y="625" width="36" height="34" fill="#f5c46a"/><rect x="1105" y="625" width="36" height="34" fill="#f5c46a" filter="url(#blur24)" opacity="0.8"/>
${ridge(r, 790, 25, '#070a16', 160)}`)
  },

  'corner-cafe'(r) {
    return svg(lin('in', [[0, '#3a261b'], [1, '#1c120c']]) + rad('warm', [[0, '#ffcf96', 0.5], [1, '#ffcf96', 0]]) + lin('out', [[0, '#3c4a5c'], [1, '#22303f']]),
      `<rect width="${W}" height="${H}" fill="url(#in)"/>
<rect x="160" y="140" width="1280" height="520" rx="10" fill="url(#out)"/>
<g filter="url(#blur24)" opacity="0.7">${bokeh(r, 30, 300, 640, ['#ffd38a', '#9ec4ff', '#ff9e7a'], 10, 30, 0.8)}</g>
<g opacity="0.6">${skyline(r, 660, 120, 300, '#2a3646', '#ffd38a', 0.15)}</g>
<g opacity="0.5">${rainStreaks(r, 120, '#d6e4ff', 0.6)}</g>
<path d="M120 100H1480L1420 190H180Z" fill="#7a2f2a"/>${Array.from({ length: 12 }, (_, i) => `<path d="M${180 + i * 104} 190h52l-26 30z" fill="#7a2f2a"/>`).join('')}
<rect x="790" y="140" width="20" height="520" fill="#2a1a12"/>
<ellipse cx="800" cy="700" rx="700" ry="200" fill="url(#warm)"/>
<rect y="660" width="${W}" height="40" fill="#4a2f20"/><rect y="700" width="${W}" height="200" fill="#20140d"/>
<path d="M680 600h120v40a60 60 0 0 1-120 0z" fill="#efe4d2"/><path d="M800 610a24 24 0 0 1 0 40" stroke="#efe4d2" stroke-width="10" fill="none"/>
<path d="M715 580c-10-20 10-30 0-50M750 580c-10-20 10-30 0-50" stroke="#efe4d2" stroke-width="4" fill="none" opacity="0.4"/>
<rect x="900" y="610" width="160" height="50" rx="6" fill="#8a5a3a"/>`)
  },

  'lofi-desk'(r) {
    return svg(lin('dusk', [[0, '#3d2a5c'], [0.55, '#d8738a'], [1, '#f7b78a']]) + lin('room', [[0, '#2a1f33'], [1, '#150f1c']]),
      `<rect width="${W}" height="${H}" fill="url(#room)"/>
<rect x="700" y="110" width="700" height="460" rx="12" fill="url(#dusk)"/>
<circle cx="1100" cy="470" r="90" fill="#ffe0b0" opacity="0.8"/>
<g opacity="0.85">${skyline(r, 570, 60, 200, '#3a2846', '#ffd9a0', 0.12).replace(/x="(-?[\d.]+)"/g, (m, x) => `x="${f(700 + Number(x) * 0.44)}"`).replace(/width="([\d.]+)"/g, (m, w) => `width="${f(Number(w) * 0.44)}"`)}</g>
<rect x="1035" y="110" width="30" height="460" fill="#241a2c"/><rect x="700" y="330" width="700" height="22" fill="#241a2c"/>
<rect x="680" y="90" width="740" height="500" rx="14" fill="none" stroke="#241a2c" stroke-width="30"/>
<rect y="640" width="${W}" height="30" fill="#4a3346"/><rect y="670" width="${W}" height="230" fill="#1d1524"/>
<rect x="300" y="430" width="380" height="230" rx="12" fill="#1a1322" stroke="#3a2c44" stroke-width="8"/><rect x="320" y="450" width="340" height="190" rx="6" fill="#f2c49b" opacity="0.25"/>
<path d="M180 640c-20-100 30-180 90-220-50 70-40 150-20 220zm60 0c20-80 70-130 120-140-50 40-80 90-80 140z" fill="#2f4a3a"/><rect x="170" y="600" width="110" height="44" rx="8" fill="#6a4a5a"/>
<path d="M820 640a60 60 0 0 1 120 0" stroke="#d8738a" stroke-width="14" fill="none"/><rect x="805" y="620" width="26" height="40" rx="8" fill="#d8738a"/><rect x="929" y="620" width="26" height="40" rx="8" fill="#d8738a"/>
<rect x="1180" y="590" width="70" height="52" rx="8" fill="#efe4d2"/>`)
  },

  'neon-drive'(r) {
    let grid = ''
    for (let i = -20; i <= 20; i++) grid += `<line x1="${800 + i * 40}" y1="560" x2="${800 + i * 300}" y2="900" stroke="#ff5fd2" stroke-width="2" opacity="0.6"/>`
    for (let j = 0; j < 12; j++) {
      const y = 560 + (j / 12) ** 1.8 * 340
      grid += `<line x1="0" y1="${f(y)}" x2="${W}" y2="${f(y)}" stroke="#ff5fd2" stroke-width="2" opacity="${f(0.3 + j * 0.05)}"/>`
    }
    let sunStripes = ''
    for (let i = 0; i < 7; i++) sunStripes += `<rect x="560" y="${400 + i * 22}" width="480" height="${4 + i * 2}" fill="#14072a"/>`
    return svg(lin('sky', [[0, '#14072a'], [0.6, '#3a0f5c'], [1, '#7a1f6e']]) + lin('sun', [[0, '#ffe36e'], [1, '#ff3d8b']]) + lin('floor', [[0, '#1a0633'], [1, '#05010c']]),
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>
${stars(r, 120, 360)}
<circle cx="800" cy="420" r="240" fill="url(#sun)"/><circle cx="800" cy="420" r="300" fill="#ff3d8b" opacity="0.25" filter="url(#blur60)"/>
${sunStripes}
${ridge(r, 520, 50, '#2a0b45', 70)}
<rect y="560" width="${W}" height="340" fill="url(#floor)"/>
${grid}`)
  },

  'brown-noise-room'(r) {
    let waves = ''
    for (let i = 0; i < 9; i++) {
      const y = 300 + i * 60
      waves += `<path d="M0 ${y}Q200 ${y - 40 - r() * 40} 400 ${y}T800 ${y}T1200 ${y}T1600 ${y}V900H0Z" fill="${['#5c4636', '#4a372a', '#3a2b21', '#2c2019'][i % 4]}" opacity="${f(0.35 + i * 0.06)}"/>`
    }
    return svg(lin('bg', [[0, '#7a6250'], [1, '#2a2019']]),
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>
<circle cx="1150" cy="220" r="260" fill="#e8cdb0" opacity="0.18" filter="url(#blur60)"/>
${waves}`)
  }
}

fs.mkdirSync(OUT, { recursive: true })
let seed = 7
for (const [name, draw] of Object.entries(scenes)) {
  const file = path.join(OUT, `${name}.svg`)
  fs.writeFileSync(file, draw(rng(seed++ * 7919)).replace(/\n+/g, '\n'))
  console.log(path.relative(process.cwd(), file), Math.round(fs.statSync(file).size / 1024) + ' KB')
}
