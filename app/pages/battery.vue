<script setup lang="ts">
/**
 * Phone battery — how much capacity a phone's battery has left.
 *
 * A battery's "health %" is its current full-charge capacity as a share of
 * its design (brand-new) capacity. So with the design mAh and either the
 * health % or a measured current mAh, we can work out the other, plus how
 * much charge is actually in the battery right now.
 */

type Mode = 'health' | 'mah'

const STORAGE_KEY = 'ousa-app:battery'

type Brand = 'apple' | 'samsung' | 'google' | 'xiaomi' | 'honor' | 'oppo' | 'vivo' | 'oneplus' | 'redmagic'
type ModelGroup = { label: string, models: [name: string, mah: number][] }

/**
 * Rated battery capacity of every iPhone, newest first. Apple doesn't publish
 * mAh, so these come from regulatory filings and teardowns. Where a model
 * shipped with two battery sizes (iPhone 17 Pro / Pro Max: eSIM-only vs.
 * physical SIM), the larger eSIM figure is listed. iPhone Duo is the
 * foldable; its 5400 mAh is the combined capacity of its two cells.
 */
const IPHONES: ModelGroup[] = [
  { label: '2026', models: [['iPhone Duo', 5400], ['iPhone 18 Pro Max', 5567], ['iPhone 18 Pro', 4288]] },
  { label: '2025', models: [['iPhone 17 Pro Max', 5088], ['iPhone 17 Pro', 4252], ['iPhone Air', 3149], ['iPhone 17', 3692]] },
  { label: '2024', models: [['iPhone 16 Pro Max', 4685], ['iPhone 16 Pro', 3582], ['iPhone 16 Plus', 4674], ['iPhone 16', 3561], ['iPhone 16e', 3961]] },
  { label: '2023', models: [['iPhone 15 Pro Max', 4422], ['iPhone 15 Pro', 3274], ['iPhone 15 Plus', 4383], ['iPhone 15', 3349]] },
  { label: '2022', models: [['iPhone 14 Pro Max', 4323], ['iPhone 14 Pro', 3200], ['iPhone 14 Plus', 4325], ['iPhone 14', 3279], ['iPhone SE (3rd gen)', 2018]] },
  { label: '2021', models: [['iPhone 13 Pro Max', 4352], ['iPhone 13 Pro', 3095], ['iPhone 13', 3227], ['iPhone 13 mini', 2406]] },
  { label: '2020', models: [['iPhone 12 Pro Max', 3687], ['iPhone 12 Pro', 2815], ['iPhone 12', 2815], ['iPhone 12 mini', 2227], ['iPhone SE (2nd gen)', 1821]] },
  { label: '2019', models: [['iPhone 11 Pro Max', 3969], ['iPhone 11 Pro', 3046], ['iPhone 11', 3110]] },
  { label: '2018', models: [['iPhone XS Max', 3174], ['iPhone XS', 2658], ['iPhone XR', 2942]] },
  { label: '2017', models: [['iPhone X', 2716], ['iPhone 8 Plus', 2691], ['iPhone 8', 1821]] },
  { label: '2016', models: [['iPhone 7 Plus', 2900], ['iPhone 7', 1960], ['iPhone SE (1st gen)', 1624]] },
  { label: '2015', models: [['iPhone 6s Plus', 2750], ['iPhone 6s', 1715]] },
  { label: '2014', models: [['iPhone 6 Plus', 2915], ['iPhone 6', 1810]] },
  { label: '2013', models: [['iPhone 5s', 1560], ['iPhone 5c', 1510]] },
  { label: '2012', models: [['iPhone 5', 1440]] },
  { label: '2011', models: [['iPhone 4S', 1432]] },
  { label: '2010', models: [['iPhone 4', 1420]] },
  { label: '2009', models: [['iPhone 3GS', 1219]] },
  { label: '2008', models: [['iPhone 3G', 1150]] },
  { label: '2007', models: [['iPhone', 1400]] }
]

/**
 * Samsung Galaxy flagships, foldables and the popular A series, newest first.
 * Samsung markets a "typical" capacity (the rated minimum is ~2–3% lower);
 * the typical figure is listed since that's what spec sheets show.
 */
const SAMSUNGS: ModelGroup[] = [
  { label: 'Galaxy S', models: [
    ['Galaxy S25 Ultra', 5000], ['Galaxy S25 Edge', 3900], ['Galaxy S25+', 4900], ['Galaxy S25', 4000], ['Galaxy S25 FE', 4900],
    ['Galaxy S24 Ultra', 5000], ['Galaxy S24+', 4900], ['Galaxy S24', 4000], ['Galaxy S24 FE', 4700],
    ['Galaxy S23 Ultra', 5000], ['Galaxy S23+', 4700], ['Galaxy S23', 3900], ['Galaxy S23 FE', 4500],
    ['Galaxy S22 Ultra', 5000], ['Galaxy S22+', 4500], ['Galaxy S22', 3700],
    ['Galaxy S21 Ultra', 5000], ['Galaxy S21+', 4800], ['Galaxy S21', 4000], ['Galaxy S21 FE', 4500],
    ['Galaxy S20 Ultra', 5000], ['Galaxy S20+', 4500], ['Galaxy S20', 4000], ['Galaxy S20 FE', 4500],
    ['Galaxy S10 5G', 4500], ['Galaxy S10+', 4100], ['Galaxy S10', 3400], ['Galaxy S10e', 3100], ['Galaxy S10 Lite', 4500],
    ['Galaxy S9+', 3500], ['Galaxy S9', 3000],
    ['Galaxy S8+', 3500], ['Galaxy S8', 3000],
    ['Galaxy S7 edge', 3600], ['Galaxy S7', 3000],
    ['Galaxy S6 edge+', 3000], ['Galaxy S6 edge', 2600], ['Galaxy S6', 2550],
    ['Galaxy S5', 2800], ['Galaxy S4', 2600], ['Galaxy S III', 2100], ['Galaxy S II', 1650], ['Galaxy S', 1500]
  ] },
  { label: 'Galaxy Z (foldables)', models: [
    ['Galaxy Z Fold7', 4400], ['Galaxy Z Flip7', 4300], ['Galaxy Z Flip7 FE', 4000],
    ['Galaxy Z Fold6', 4400], ['Galaxy Z Flip6', 4000],
    ['Galaxy Z Fold5', 4400], ['Galaxy Z Flip5', 3700],
    ['Galaxy Z Fold4', 4400], ['Galaxy Z Flip4', 3700],
    ['Galaxy Z Fold3', 4400], ['Galaxy Z Flip3', 3300],
    ['Galaxy Z Fold2', 4500], ['Galaxy Z Flip 5G', 3300], ['Galaxy Z Flip', 3300], ['Galaxy Fold', 4380]
  ] },
  { label: 'Galaxy Note', models: [
    ['Galaxy Note20 Ultra', 4500], ['Galaxy Note20', 4300],
    ['Galaxy Note10+', 4300], ['Galaxy Note10', 3500], ['Galaxy Note10 Lite', 4500],
    ['Galaxy Note9', 4000], ['Galaxy Note8', 3300], ['Galaxy Note FE', 3200], ['Galaxy Note7', 3500],
    ['Galaxy Note5', 3000], ['Galaxy Note 4', 3220], ['Galaxy Note 3', 3200], ['Galaxy Note II', 3100], ['Galaxy Note', 2500]
  ] },
  { label: 'Galaxy A', models: [
    ['Galaxy A56', 5000], ['Galaxy A36', 5000], ['Galaxy A26', 5000], ['Galaxy A16', 5000], ['Galaxy A06', 5000],
    ['Galaxy A55', 5000], ['Galaxy A35', 5000], ['Galaxy A25', 5000], ['Galaxy A15', 5000], ['Galaxy A05', 5000],
    ['Galaxy A54', 5000], ['Galaxy A34', 5000], ['Galaxy A24', 5000], ['Galaxy A14', 5000],
    ['Galaxy A73', 5000], ['Galaxy A53', 5000], ['Galaxy A33', 5000],
    ['Galaxy A72', 5000], ['Galaxy A52', 4500], ['Galaxy A32', 5000],
    ['Galaxy A71', 4500], ['Galaxy A51', 4000], ['Galaxy A50', 4000]
  ] }
]

/** Google Pixel, newest first. Figures are Google's published capacities. */
const PIXELS: ModelGroup[] = [
  { label: '2026', models: [['Pixel 11 Pro Fold', 4806], ['Pixel 11 Pro XL', 5115], ['Pixel 11 Pro', 4850], ['Pixel 11', 4985], ['Pixel 10a', 5100]] },
  { label: '2025', models: [['Pixel 10 Pro Fold', 5015], ['Pixel 10 Pro XL', 5200], ['Pixel 10 Pro', 4870], ['Pixel 10', 4970], ['Pixel 9a', 5100]] },
  { label: '2024', models: [['Pixel 9 Pro Fold', 4650], ['Pixel 9 Pro XL', 5060], ['Pixel 9 Pro', 4700], ['Pixel 9', 4700], ['Pixel 8a', 4492]] },
  { label: '2023', models: [['Pixel 8 Pro', 5050], ['Pixel 8', 4575], ['Pixel Fold', 4821], ['Pixel 7a', 4385]] },
  { label: '2022', models: [['Pixel 7 Pro', 5000], ['Pixel 7', 4355], ['Pixel 6a', 4410]] },
  { label: '2021', models: [['Pixel 6 Pro', 5003], ['Pixel 6', 4614], ['Pixel 5a', 4680]] },
  { label: '2020', models: [['Pixel 5', 4080], ['Pixel 4a 5G', 3885], ['Pixel 4a', 3140]] },
  { label: '2019', models: [['Pixel 4 XL', 3700], ['Pixel 4', 2800], ['Pixel 3a XL', 3700], ['Pixel 3a', 3000]] },
  { label: '2018', models: [['Pixel 3 XL', 3430], ['Pixel 3', 2915]] },
  { label: '2017', models: [['Pixel 2 XL', 3520], ['Pixel 2', 2700]] },
  { label: '2016', models: [['Pixel XL', 3450], ['Pixel', 2770]] }
]

/**
 * Xiaomi and Redmi. Xiaomi often fits a much bigger battery in the Chinese
 * version of a phone; the global version's capacity is listed, and models
 * sold only in China are marked so.
 */
const XIAOMIS: ModelGroup[] = [
  { label: 'Xiaomi 17', models: [['Xiaomi 17 Ultra', 6000], ['Xiaomi 17 Pro Max (China)', 7500], ['Xiaomi 17 Pro (China)', 6300], ['Xiaomi 17', 6330]] },
  { label: 'Xiaomi 15', models: [['Xiaomi 15T Pro', 5500], ['Xiaomi 15T', 5500], ['Xiaomi 15 Ultra', 5410], ['Xiaomi 15', 5240]] },
  { label: 'Xiaomi 14', models: [['Xiaomi 14T Pro', 5000], ['Xiaomi 14T', 5000], ['Xiaomi 14 Ultra', 5000], ['Xiaomi 14', 4610]] },
  { label: 'Xiaomi 13', models: [['Xiaomi 13T Pro', 5000], ['Xiaomi 13T', 5000], ['Xiaomi 13 Ultra', 5000], ['Xiaomi 13 Pro', 4820], ['Xiaomi 13', 4500]] },
  { label: 'Xiaomi 12 & 11', models: [['Xiaomi 12T Pro', 5000], ['Xiaomi 12 Pro', 4600], ['Xiaomi 12', 4500], ['Xiaomi 11T Pro', 5000], ['Mi 11 Ultra', 5000], ['Mi 11', 4600]] },
  { label: 'Redmi Note', models: [['Redmi Note 14 Pro+', 5110], ['Redmi Note 14 Pro 5G', 5110], ['Redmi Note 13 Pro+', 5000], ['Redmi Note 13 Pro 5G', 5100], ['Redmi Note 12 Pro', 5000]] }
]

/**
 * Honor. Like Xiaomi, Honor ships bigger batteries in China (and sometimes
 * smaller ones in Europe); the global figure is listed.
 */
const HONORS: ModelGroup[] = [
  { label: 'Magic', models: [['Honor Magic8 Pro', 7100], ['Honor Magic7 Pro', 5850], ['Honor Magic6 Pro', 5600], ['Honor Magic5 Pro', 5100]] },
  { label: 'Magic V (foldables)', models: [['Honor Magic V5', 5820], ['Honor Magic V3', 5150], ['Honor Magic V2', 5000]] },
  { label: 'Number series', models: [['Honor 400 Pro', 5300], ['Honor 400', 5300], ['Honor 200 Pro', 5200], ['Honor 200', 5200], ['Honor 90', 5000]] }
]

/**
 * OPPO. Recent Find models keep the same battery globally as in China.
 * Find N models are foldables.
 */
const OPPOS: ModelGroup[] = [
  { label: 'Find X', models: [
    ['OPPO Find X9 Ultra', 7050], ['OPPO Find X9 Pro', 7500], ['OPPO Find X9', 7025],
    ['OPPO Find X8 Pro', 5910], ['OPPO Find X8', 5630],
    ['OPPO Find X5 Pro', 5000], ['OPPO Find X5', 4800], ['OPPO Find X3 Pro', 4500]
  ] },
  { label: 'Find N (foldables)', models: [['OPPO Find N6', 6000], ['OPPO Find N5', 5600], ['OPPO Find N3', 4805]] },
  { label: 'Reno', models: [
    ['OPPO Reno14 Pro', 6200], ['OPPO Reno14', 6000], ['OPPO Reno13 Pro', 5800], ['OPPO Reno13', 5600],
    ['OPPO Reno12 Pro', 5000], ['OPPO Reno12', 5000]
  ] }
]

/**
 * vivo. The global (non-EU) capacity is listed; vivo sells smaller-battery
 * versions in Europe (e.g. X300 Pro 5440 mAh, X300 5360 mAh).
 */
const VIVOS: ModelGroup[] = [
  { label: 'X series', models: [
    ['vivo X300 Ultra', 6600], ['vivo X300 Pro', 6510], ['vivo X300', 6040],
    ['vivo X200 Pro', 6000], ['vivo X200', 5800], ['vivo X200 FE', 6500],
    ['vivo X100 Pro', 5400], ['vivo X100', 5000], ['vivo X90 Pro', 4870], ['vivo X80 Pro', 4700]
  ] },
  { label: 'X Fold (foldables)', models: [['vivo X Fold5', 6000], ['vivo X Fold3 Pro', 5700]] },
  { label: 'V series', models: [['vivo V50', 6000], ['vivo V40', 5500], ['vivo V30', 5000]] }
]

/** OnePlus. Global capacities; the 15T is sold only in China. */
const ONEPLUSES: ModelGroup[] = [
  { label: 'Flagship', models: [
    ['OnePlus 15', 7300], ['OnePlus 15R', 7400], ['OnePlus 15T (China)', 7500],
    ['OnePlus 13', 6000], ['OnePlus 13R', 6000], ['OnePlus 13s', 5850],
    ['OnePlus 12', 5400], ['OnePlus 12R', 5500], ['OnePlus 11', 5000],
    ['OnePlus 10 Pro', 5000], ['OnePlus 10T', 4800],
    ['OnePlus 9 Pro', 4500], ['OnePlus 9', 4500],
    ['OnePlus 8 Pro', 4510], ['OnePlus 8T', 4500], ['OnePlus 8', 4300],
    ['OnePlus 7T Pro', 4085], ['OnePlus 7 Pro', 4000]
  ] },
  { label: 'Open (foldable)', models: [['OnePlus Open', 4805]] },
  { label: 'Nord', models: [['OnePlus Nord 5', 5200], ['OnePlus Nord 4', 5500], ['OnePlus Nord CE4', 5500], ['OnePlus Nord 3', 5000]] }
]

/** Nubia RedMagic gaming phones. */
const REDMAGICS: ModelGroup[] = [
  { label: 'RedMagic', models: [
    ['RedMagic 11 Pro', 7500], ['RedMagic 10S Pro', 7050], ['RedMagic 10 Pro', 7050],
    ['RedMagic 9S Pro', 6500], ['RedMagic 9 Pro', 6500], ['RedMagic 8S Pro', 6000], ['RedMagic 8 Pro', 6000],
    ['RedMagic 7S Pro', 5000], ['RedMagic 7 Pro', 5000], ['RedMagic 7', 4500]
  ] }
]

/**
 * Brand marks as 24×24 SVG paths, from Simple Icons (CC0, simpleicons.org).
 * RedMagic has no mark there, so it falls back to a lettered badge.
 * `box` is the mark's tight bounds, so wide wordmarks fill their slot.
 */
type BrandLogo = { box: string, wide: boolean, d: string }
const BRAND_LOGOS: Partial<Record<Brand, BrandLogo>> = {
  apple: { box: '2.22 0 19.55 24', wide: false, d: 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.090-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701' },
  samsung: { box: '0 10.17 24 3.67', wide: true, d: 'M19.8166 10.2808l.0459 2.6934h-.023l-.7793-2.6934h-1.2837v3.3925h.8481l-.0458-2.785h.023l.8366 2.785h1.2264v-3.3925zm-16.149 0l-.6418 3.427h.9284l.4699-3.1175h.0229l.4585 3.1174h.9169l-.6304-3.4269zm5.1805 0l-.424 2.6132h-.023l-.424-2.6132H6.5788l-.0688 3.427h.8596l.023-3.0832h.0114l.573 3.0831h.8711l.5731-3.083h.023l.0228 3.083h.8596l-.0802-3.4269zm-7.2664 2.4527c.0343.0802.0229.1949.0114.2522-.0229.1146-.1031.2292-.3324.2292-.2177 0-.3438-.126-.3438-.3095v-.3323H0v.2636c0 .7679.6074.9971 1.2493.9971.6189 0 1.1346-.2178 1.2149-.7794.0458-.298.0114-.4928 0-.5616-.1605-.722-1.467-.9283-1.5588-1.3295-.0114-.0688-.0114-.1375 0-.1834.023-.1146.1032-.2292.3095-.2292.2063 0 .321.126.321.3095v.2063h.8595v-.2407c0-.745-.6762-.8596-1.1576-.8596-.6074 0-1.1117.2063-1.2034.7564-.023.149-.0344.2866.0114.4585.1376.7106 1.364.9169 1.5358 1.3524m11.152 0c.0343.0803.0228.1834.0114.2522-.023.1146-.1032.2292-.3324.2292-.2178 0-.3438-.126-.3438-.3095v-.3323h-.917v.2636c0 .7564.596.9857 1.2379.9857.6189 0 1.1232-.2063 1.2034-.7794.0459-.298.0115-.4814 0-.5616-.1375-.7106-1.4327-.9284-1.5243-1.318-.0115-.0688-.0115-.1376 0-.1835.0229-.1146.1031-.2292.3094-.2292.1948 0 .321.126.321.3095v.2063h.848v-.2407c0-.745-.6647-.8596-1.146-.8596-.6075 0-1.1004.1948-1.192.7564-.023.149-.023.2866.0114.4585.1376.7106 1.341.9054 1.513 1.3524m2.8882.4585c.2407 0 .3094-.1605.3323-.2522.0115-.0343.0115-.0917.0115-.126v-2.533h.871v2.4642c0 .0688 0 .1948-.0114.2292-.0573.6419-.5616.8482-1.192.8482-.6303 0-1.1346-.2063-1.192-.8482 0-.0344-.0114-.1604-.0114-.2292v-2.4642h.871v2.533c0 .0458 0 .0916.0115.126 0 .0917.0688.2522.3095.2522m7.1518-.0344c.2522 0 .3324-.1605.3553-.2522.0115-.0343.0115-.0917.0115-.126v-.4929h-.3553v-.5043H24v.917c0 .0687 0 .1145-.0115.2292-.0573.6303-.596.8481-1.2034.8481-.6075 0-1.1461-.2178-1.2034-.8481-.0115-.1147-.0115-.1605-.0115-.2293v-1.444c0-.0574.0115-.172.0115-.2293.0802-.6419.596-.8482 1.2034-.8482s1.1347.2063 1.2034.8482c.0115.1031.0115.2292.0115.2292v.1146h-.8596v-.1948s0-.0803-.0115-.1261c-.0114-.0802-.0802-.2521-.3438-.2521-.2521 0-.321.1604-.3438.2521-.0115.0458-.0115.1032-.0115.1605v1.5702c0 .0458 0 .0916.0115.126 0 .0917.0917.2522.3323.2522' },
  google: { box: '0.31 0 23.39 24', wide: false, d: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z' },
  xiaomi: { box: '0 0 24 24', wide: false, d: 'M12 0C8.016 0 4.756.255 2.493 2.516.23 4.776 0 8.033 0 12.012c0 3.98.23 7.235 2.494 9.497C4.757 23.77 8.017 24 12 24c3.983 0 7.243-.23 9.506-2.491C23.77 19.247 24 15.99 24 12.012c0-3.984-.233-7.243-2.502-9.504C19.234.252 15.978 0 12 0zM4.906 7.405h5.624c1.47 0 3.007.068 3.764.827.746.746.827 2.233.83 3.676v4.54a.15.15 0 0 1-.152.147h-1.947a.15.15 0 0 1-.152-.148V11.83c-.002-.806-.048-1.634-.464-2.051-.358-.36-1.026-.441-1.72-.458H7.158a.15.15 0 0 0-.151.147v6.98a.15.15 0 0 1-.152.148H4.906a.15.15 0 0 1-.15-.148V7.554a.15.15 0 0 1 .15-.149zm12.131 0h1.949a.15.15 0 0 1 .15.15v8.892a.15.15 0 0 1-.15.148h-1.949a.15.15 0 0 1-.151-.148V7.554a.15.15 0 0 1 .151-.149zM8.92 10.948h2.046c.083 0 .15.066.15.147v5.352a.15.15 0 0 1-.15.148H8.92a.15.15 0 0 1-.152-.148v-5.352a.15.15 0 0 1 .152-.147Z' },
  honor: { box: '0 9.69 24 4.62', wide: true, d: 'M2.601 9.753v1.823H.807V9.753H0v4.498h.807v-1.874h1.794v1.874h.807V9.753h-.807Zm18.671.801h.898c.369 0 .667.297.667.662a.665.665 0 0 1-.667.663h-.898v-1.325Zm-.806-.801v4.498h.806v-2.002l1.68 2.002H24l-1.376-1.64a1.462 1.462 0 0 0-.444-2.858h-1.716.002Zm-7.63-.014v2.807l-1.959-2.807h-.644v4.498h.807v-2.82l1.968 2.82h.633V9.739h-.805Zm-7.532 2.26c0-.832.68-1.506 1.517-1.506A1.51 1.51 0 0 1 8.337 12c0 .832-.679 1.506-1.516 1.506-.403 0-.789-.159-1.073-.441A1.504 1.504 0 0 1 5.304 12v-.001ZM4.497 12c0 .933.566 1.774 1.434 2.132.869.357 1.868.16 2.533-.5.664-.66.863-1.653.503-2.515a2.324 2.324 0 0 0-2.146-1.425 2.316 2.316 0 0 0-2.323 2.307L4.497 12Zm11.04-.001a1.513 1.513 0 0 1 1.518-1.506c.838 0 1.516.675 1.516 1.507a1.513 1.513 0 0 1-1.518 1.506c-.402 0-.788-.159-1.072-.441a1.5 1.5 0 0 1-.444-1.066ZM14.73 12c0 .933.566 1.774 1.434 2.132.868.357 1.868.16 2.532-.5.665-.66.864-1.653.504-2.515a2.325 2.325 0 0 0-2.147-1.425 2.316 2.316 0 0 0-2.323 2.307V12Z' },
  oppo: { box: '0 9.15 24 5.71', wide: true, d: 'M2.85 12.786h-.001C1.639 12.774.858 12.2.858 11.321s.781-1.452 1.99-1.465c1.21.013 1.992.588 1.992 1.465s-.782 1.453-1.99 1.465zm.034-3.638h-.073C1.156 9.175 0 10.068 0 11.32s1.156 2.147 2.811 2.174h.073c1.655-.027 2.811-.921 2.811-2.174S4.54 9.175 2.885 9.148zm18.27 3.638c-1.21-.012-1.992-.587-1.992-1.465s.782-1.452 1.991-1.465c1.21.013 1.991.588 1.991 1.465s-.781 1.453-1.99 1.465zm.035-3.638h-.073c-1.655.027-2.811.92-2.811 2.173s1.156 2.147 2.81 2.174h.074C22.844 13.468 24 12.574 24 11.32s-1.156-2.146-2.811-2.173zm-6.126 3.638c-1.21-.012-1.99-.587-1.99-1.465s.78-1.452 1.99-1.465c1.21.013 1.991.588 1.991 1.465s-.781 1.453-1.99 1.465zm.036-3.638h-.073c-.789.013-1.464.222-1.955.574v-.37h-.857v5.5h.857v-1.931c.49.351 1.166.56 1.954.574h.074c1.655-.027 2.81-.921 2.81-2.174s-1.155-2.146-2.81-2.173zm-6.144 3.638c-1.21-.012-1.99-.587-1.99-1.465s.78-1.452 1.99-1.465c1.21.013 1.991.588 1.991 1.465s-.781 1.453-1.99 1.465zm.037-3.638H8.92c-.789.013-1.464.222-1.955.574v-.37h-.856v5.5h.856v-1.931c.491.351 1.166.56 1.955.574a3.728 3.728 0 0 0 .073 0c1.655-.027 2.811-.921 2.811-2.174s-1.156-2.146-2.81-2.173z' },
  vivo: { box: '0 8.85 24 6.29', wide: true, d: 'M19.604 14.101c-1.159 0-1.262-.95-1.262-1.24 0-.29.103-1.242 1.262-1.242h2.062c1.16 0 1.263.951 1.263 1.242 0 .29-.104 1.24-1.263 1.24m-2.062-3.527c-2.142 0-2.333 1.752-2.333 2.287 0 .535.19 2.286 2.333 2.286h2.062c2.143 0 2.334-1.751 2.334-2.286 0-.535-.19-2.287-2.334-2.287m-5.477.107c-.286 0-.345.05-.456.213-.11.164-2.022 3.082-2.022 3.082-.06.09-.126.126-.206.126-.08 0-.145-.036-.206-.126 0 0-1.912-2.918-2.022-3.082-.11-.164-.17-.213-.456-.213h-.668c-.154 0-.224.12-.127.267l2.283 3.467c.354.521.614.732 1.196.732s.842-.21 1.196-.732l2.284-3.467c.096-.146.026-.267-.128-.267m-8.876.284c0-.203.08-.284.283-.284h.505c.203 0 .283.08.283.283v3.9c0 .202-.08.283-.283.283h-.505c-.203 0-.283-.08-.283-.283zm-1.769-.285c-.287 0-.346.05-.456.213-.11.164-2.022 3.082-2.022 3.082-.061.09-.126.126-.206.126-.08 0-.145-.036-.206-.126 0 0-1.912-2.918-2.023-3.082-.11-.164-.169-.213-.455-.213H.175c-.171 0-.224.12-.127.267l2.283 3.467c.355.521.615.732 1.197.732.582 0 .842-.21 1.196-.732l2.283-3.467c.097-.146.044-.267-.127-.267m1.055-.893c-.165-.164-.165-.295 0-.46l.351-.351c.165-.165.296-.165.46 0l.352.351c.165.165.165.296 0 .46l-.352.352c-.164.165-.295.165-.46 0z' },
  oneplus: { box: '0 0 24 24', wide: false, d: 'M0 3.74V24h20.26V12.428h-2.256v9.317H2.254V5.995h9.318V3.742zM18.004 0v3.74h-3.758v2.256h3.758v3.758h2.255V5.996H24V3.74h-3.758V0zm-6.45 18.756V8.862H9.562c0 .682-.228 1.189-.577 1.504-.367.297-.91.437-1.556.437h-.245v1.625h2.133v6.31h2.237z' }
}

const BRANDS: { id: Brand, label: string, search: string }[] = [
  { id: 'apple', label: 'iPhone', search: 'Search iPhones or mAh…' },
  { id: 'samsung', label: 'Samsung', search: 'Search Galaxy models or mAh…' },
  { id: 'google', label: 'Pixel', search: 'Search Pixels or mAh…' },
  { id: 'xiaomi', label: 'Xiaomi', search: 'Search Xiaomi & Redmi or mAh…' },
  { id: 'honor', label: 'Honor', search: 'Search Honor models or mAh…' },
  { id: 'oppo', label: 'OPPO', search: 'Search OPPO models or mAh…' },
  { id: 'vivo', label: 'vivo', search: 'Search vivo models or mAh…' },
  { id: 'oneplus', label: 'OnePlus', search: 'Search OnePlus models or mAh…' },
  { id: 'redmagic', label: 'RedMagic', search: 'Search RedMagic models or mAh…' }
]

const PHONES: Record<Brand, ModelGroup[]> = {
  apple: IPHONES,
  samsung: SAMSUNGS,
  google: PIXELS,
  xiaomi: XIAOMIS,
  honor: HONORS,
  oppo: OPPOS,
  vivo: VIVOS,
  oneplus: ONEPLUSES,
  redmagic: REDMAGICS
}
const MODEL_MAH = new Map(Object.values(PHONES).flat().flatMap(g => g.models))
const brandOf = (name: string): Brand | undefined =>
  (Object.keys(PHONES) as Brand[]).find(b => PHONES[b].some(g => g.models.some(([n]) => n === name)))

const sfx = useSound()

const mode = ref<Mode>('health')
const brand = ref<Brand>('apple')
/** Picked phone model, or '' when the capacity was typed in by hand. */
const model = ref('')
const designMah = ref(5000)
const healthPct = ref(88)
const measuredMah = ref(4400)
const chargePct = ref(60)

/** Current full-charge capacity in mAh — the battery's real "100%". */
const currentMax = computed(() => {
  const design = Math.max(0, designMah.value || 0)
  return mode.value === 'health'
    ? design * clamp(healthPct.value, 0, 100) / 100
    : Math.max(0, measuredMah.value || 0)
})

const health = computed(() => {
  const design = designMah.value || 0
  if (design <= 0) return 0
  return mode.value === 'health'
    ? clamp(healthPct.value, 0, 100)
    : currentMax.value / design * 100
})

const lostMah = computed(() => Math.max(0, (designMah.value || 0) - currentMax.value))
const charge = computed(() => clamp(chargePct.value, 0, 100))
const remainingMah = computed(() => currentMax.value * charge.value / 100)

// ---------- Battery life ----------
// Rough screen-on time: charge ÷ average current draw. Real draw depends on
// the chip, screen and signal, so these are typical averages per usage style.
type Usage = 'light' | 'mixed' | 'heavy'
const USAGE: { id: Usage, label: string, hint: string, ma: number }[] = [
  { id: 'light', label: 'Light', hint: 'Messaging, reading, music', ma: 250 },
  { id: 'mixed', label: 'Mixed', hint: 'Social, video, camera', ma: 420 },
  { id: 'heavy', label: 'Heavy', hint: 'Gaming, navigation, hotspot', ma: 800 }
]
const usage = ref<Usage>('mixed')
const drainMa = computed(() => USAGE.find(u => u.id === usage.value)!.ma)
const hoursLeft = computed(() => remainingMah.value / drainMa.value)
const hoursFull = computed(() => currentMax.value / drainMa.value)
const hoursNew = computed(() => (designMah.value || 0) / drainMa.value)
const hoursLost = computed(() => Math.max(0, hoursNew.value - hoursFull.value))

function fmtHours(h: number) {
  const mins = Math.max(0, Math.round(h * 60))
  const hh = Math.floor(mins / 60)
  const mm = mins % 60
  return hh ? `${hh} h ${String(mm).padStart(2, '0')} m` : `${mm} m`
}

function setUsage(next: Usage) {
  if (usage.value === next) return
  usage.value = next
  sfx.play('select')
}

/** What the current charge would read as on the same phone when it was new. */
const newEquivalentPct = computed(() => {
  const design = designMah.value || 0
  return design > 0 ? remainingMah.value / design * 100 : 0
})

const status = computed(() => {
  const h = health.value
  if (h > 100) return { key: 'over', label: 'Above design', note: 'Measured capacity is higher than the rated capacity — usually a reading quirk on a near-new battery.' }
  if (h >= 90) return { key: 'great', label: 'Excellent', note: 'Close to brand new. Nothing to do.' }
  if (h >= 80) return { key: 'good', label: 'Good', note: 'Normal wear. Most makers consider 80%+ healthy.' }
  if (h >= 70) return { key: 'worn', label: 'Worn', note: 'Noticeably shorter days. Consider a replacement soon.' }
  return { key: 'replace', label: 'Replace', note: 'Below 70% — expect fast drain and possible slowdowns or shutdowns.' }
})

// Battery graphic: the outline is the design capacity, the hatched tail is
// capacity lost to wear, and the fill is the charge in the battery now.
const usableWidth = computed(() => clamp(health.value, 0, 100))
const fillWidth = computed(() => clamp(newEquivalentPct.value, 0, 100))

// Liquid fill: bubbles get fixed, varied positions/timings so the motion
// looks organic without any per-frame JS. Bumping `sloshKey` remounts the
// wave edge, replaying its slosh keyframes whenever the level moves.
const BUBBLES = [
  { x: 12, s: 5, t: 3.4, d: 0 },
  { x: 28, s: 3, t: 2.6, d: 1.1 },
  { x: 44, s: 6, t: 4.1, d: 0.6 },
  { x: 58, s: 3, t: 2.9, d: 2.0 },
  { x: 71, s: 4, t: 3.6, d: 1.5 },
  { x: 86, s: 3, t: 2.4, d: 0.3 }
]
const sloshKey = ref(0)
watch(fillWidth, (now, before) => {
  if (Math.abs(now - before) >= 0.5) sloshKey.value++
})

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))
}

function fmt(value: number, digits = 0) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value)
}

function setMode(next: Mode) {
  if (mode.value === next) return
  // Carry the current figure across so switching modes doesn't jump.
  if (next === 'mah') measuredMah.value = Math.round(currentMax.value)
  else healthPct.value = Math.round(health.value * 10) / 10
  mode.value = next
  sfx.play('select')
}

// The health band crossing a threshold is the one moment worth a cue.
watch(() => status.value.key, (now, before) => {
  if (!before) return
  sfx.play(now === 'replace' || now === 'worn' ? 'error' : 'success')
})

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved) {
      if (saved.mode === 'health' || saved.mode === 'mah') mode.value = saved.mode
      if (typeof saved.designMah === 'number') designMah.value = saved.designMah
      if (MODEL_MAH.get(saved.model) === designMah.value) model.value = saved.model
      brand.value = brandOf(model.value) ?? (Object.hasOwn(PHONES, saved.brand ?? '') ? saved.brand : 'apple')
      if (typeof saved.healthPct === 'number') healthPct.value = saved.healthPct
      if (typeof saved.measuredMah === 'number') measuredMah.value = saved.measuredMah
      if (typeof saved.chargePct === 'number') chargePct.value = saved.chargePct
      if (USAGE.some(u => u.id === saved.usage)) usage.value = saved.usage
    }
  } catch { /* storage unavailable — keep defaults */ }
  applySharedParams()
})

// ---------- Sharing ----------
// A shared link carries the result in the query string (?model=…&h=88&c=60&u=mixed)
// so whoever opens it sees the same battery. Viewing one doesn't overwrite
// the viewer's own saved inputs, and skips detecting their phone.

const route = useRoute()
const sharedView = ref(false)

function applySharedParams() {
  const q = route.query
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const num = (v: unknown) => {
    const n = Number.parseFloat(str(v))
    return Number.isFinite(n) ? n : null
  }
  const name = str(q.model)
  const mah = num(q.mah)
  const h = num(q.h)
  if (!MODEL_MAH.has(name) && mah === null) return

  sharedView.value = true
  chargeFromDevice.value = false
  if (MODEL_MAH.has(name)) {
    brand.value = brandOf(name) ?? brand.value
    model.value = name
    designMah.value = MODEL_MAH.get(name)!
  } else {
    model.value = ''
    designMah.value = clamp(mah!, 100, 30000)
  }
  if (h !== null) {
    mode.value = 'health'
    healthPct.value = clamp(h, 0, 100)
  }
  const c = num(q.c)
  if (c !== null) chargePct.value = clamp(c, 0, 100)
  if (USAGE.some(u => u.id === q.u)) usage.value = q.u as Usage
}

function shareUrl() {
  const url = new URL(window.location.pathname, window.location.origin)
  if (model.value) url.searchParams.set('model', model.value)
  else url.searchParams.set('mah', String(Math.round(designMah.value || 0)))
  url.searchParams.set('h', String(Math.round(health.value * 10) / 10))
  url.searchParams.set('c', String(Math.round(charge.value)))
  url.searchParams.set('u', usage.value)
  return url.toString()
}

function shareText() {
  const phone = model.value || `${fmt(designMah.value)} mAh phone`
  const style = USAGE.find(u => u.id === usage.value)!.label.toLowerCase()
  return `My ${phone} battery is at ${fmt(health.value, 1)}% health (${status.value.label}): `
    + `${fmt(currentMax.value)} of ${fmt(designMah.value)} mAh left, `
    + `about ${fmtHours(hoursFull.value)} of ${style} use per full charge.`
}

type ShareState = 'idle' | 'copied' | 'failed'
const shareState = ref<ShareState>('idle')
let shareTimer: ReturnType<typeof setTimeout> | undefined

function flashShare(next: ShareState) {
  shareState.value = next
  clearTimeout(shareTimer)
  shareTimer = setTimeout(() => (shareState.value = 'idle'), 2200)
}

/** Native share sheet where there is one (phones), otherwise copy to clipboard. */
async function shareResult() {
  const text = shareText()
  const url = shareUrl()
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Phone battery', text, url })
      sfx.play('success')
      return
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return // user closed the sheet
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    sfx.play('copy')
    flashShare('copied')
  } catch {
    sfx.play('error')
    flashShare('failed')
  }
}

function leaveSharedView() {
  window.location.assign(window.location.pathname)
}

onBeforeUnmount(() => clearTimeout(shareTimer))

function setBrand(next: Brand) {
  if (brand.value === next) return
  brand.value = next
  model.value = ''
  sfx.play('select')
}

function pickModel(name: string) {
  model.value = name
  const mah = MODEL_MAH.get(name)
  if (mah) designMah.value = mah
  sfx.play('select')
}

// ---------- Model grid ----------
// Every model for the chosen brand is laid out as a tile grid right on the
// page. The search box filters it; arrow keys move a cursor across tiles.

const listRef = ref<HTMLElement | null>(null)
const query = ref('')
const activeIndex = ref(-1)

const filteredGroups = computed(() => {
  const q = query.value.trim().toLowerCase()
  const groups = PHONES[brand.value]
  if (!q) return groups
  return groups
    .map(g => ({ label: g.label, models: g.models.filter(([n, mah]) => n.toLowerCase().includes(q) || String(mah).includes(q)) }))
    .filter(g => g.models.length)
})

/** Every selectable tile in display order; '' is the "enter manually" tile. */
const pickerOptions = computed(() => [
  ...(query.value.trim() ? [] : ['']),
  ...filteredGroups.value.flatMap(g => g.models.map(([n]) => n))
])
const optionIndex = computed(() => new Map(pickerOptions.value.map((n, i) => [n, i])))

watch(query, () => {
  activeIndex.value = query.value.trim() ? 0 : -1
  if (listRef.value) listRef.value.scrollTop = 0
})

// A new brand gets a fresh grid (it's keyed by brand, so the tiles replay
// their entrance) scrolled back to the top.
watch(brand, () => {
  query.value = ''
  activeIndex.value = -1
  if (listRef.value) listRef.value.scrollTop = 0
})

function scrollActive() {
  nextTick(() => listRef.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }))
}

function choose(name: string) {
  activeIndex.value = optionIndex.value.get(name) ?? -1
  if (name !== model.value) pickModel(name)
  if (name) revealBattery()
}

const batteryRef = ref<HTMLElement | null>(null)
const batteryFlash = ref(false)

/**
 * After picking a phone, bring the battery into view if it's off screen
 * (the stacked phone layout puts it below the inputs) and pulse it so the
 * eye lands on the change. On desktop it's usually already visible.
 */
function revealBattery() {
  nextTick(() => {
    const el = batteryRef.value
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.top < 80 || r.bottom > window.innerHeight) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    }
    batteryFlash.value = false
    requestAnimationFrame(() => (batteryFlash.value = true))
  })
}

/**
 * Rows to jump for ↑/↓ in the tile grid. The column count comes from the
 * rendered layout, and the full-width "enter manually" tile counts as one.
 */
function gridStep(dir: 1 | -1) {
  const grid = listRef.value?.querySelector('.pm-grid')
  if (!grid) return 1
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length
  const hasManual = pickerOptions.value[0] === ''
  if (hasManual && ((dir === 1 && activeIndex.value <= 0) || (dir === -1 && activeIndex.value <= cols))) return Math.max(1, activeIndex.value)
  return cols
}

function onPickerKey(e: KeyboardEvent) {
  const last = pickerOptions.value.length - 1
  const at = Math.max(0, activeIndex.value)
  switch (e.key) {
    case 'ArrowRight': activeIndex.value = Math.min(last, activeIndex.value + 1); break
    case 'ArrowLeft': activeIndex.value = Math.max(0, at - 1); break
    case 'ArrowDown': activeIndex.value = activeIndex.value < 0 ? 0 : Math.min(last, at + gridStep(1)); break
    case 'ArrowUp': activeIndex.value = Math.max(0, at - gridStep(-1)); break
    case 'Enter': {
      const name = pickerOptions.value[activeIndex.value]
      if (name !== undefined) choose(name)
      break
    }
    case 'Escape':
      if (!query.value) return
      query.value = ''
      break
    default: return
  }
  e.preventDefault()
  scrollActive()
}

// Typing a capacity by hand that no longer matches the picked model means
// it's a custom battery, so drop the model label rather than mislead.
watch(designMah, (mah) => {
  if (model.value && MODEL_MAH.get(model.value) !== mah) model.value = ''
})

watch([mode, brand, model, designMah, healthPct, measuredMah, chargePct, usage], () => {
  if (sharedView.value) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: mode.value,
      brand: brand.value,
      model: model.value,
      designMah: designMah.value,
      healthPct: healthPct.value,
      measuredMah: measuredMah.value,
      chargePct: chargePct.value,
      usage: usage.value
    }))
  } catch { /* ignore */ }
})

// ---------- Device detection ----------
// Browsers only reveal a little about the phone, so this is best-effort:
//  • Android Chromium browsers share a model code through User-Agent Client
//    Hints (e.g. "SM-S928B", "Pixel 8 Pro") and the live battery level
//    through the Battery Status API.
//  • iOS shares neither — only "iPhone" plus the screen size, which narrows
//    it to the handful of models built on that display.

/**
 * iPhones by portrait screen size in CSS points and pixel ratio. 18 Pro /
 * 18 Pro Max are assumed to keep the 17 Pro / Pro Max displays.
 */
const IPHONE_SCREENS: Record<string, string[]> = {
  '440x956@3': ['iPhone 18 Pro Max', 'iPhone 17 Pro Max', 'iPhone 16 Pro Max'],
  '402x874@3': ['iPhone 18 Pro', 'iPhone 17 Pro', 'iPhone 17', 'iPhone 16 Pro'],
  '420x912@3': ['iPhone Air'],
  '430x932@3': ['iPhone 16 Plus', 'iPhone 15 Pro Max', 'iPhone 15 Plus', 'iPhone 14 Pro Max'],
  '393x852@3': ['iPhone 16', 'iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro'],
  '428x926@3': ['iPhone 14 Plus', 'iPhone 13 Pro Max', 'iPhone 12 Pro Max'],
  '390x844@3': ['iPhone 16e', 'iPhone 14', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 12 Pro', 'iPhone 12'],
  '375x812@3': ['iPhone 13 mini', 'iPhone 12 mini', 'iPhone 11 Pro', 'iPhone XS', 'iPhone X'],
  '414x896@3': ['iPhone 11 Pro Max', 'iPhone XS Max'],
  '414x896@2': ['iPhone 11', 'iPhone XR'],
  '414x736@3': ['iPhone 8 Plus', 'iPhone 7 Plus', 'iPhone 6s Plus', 'iPhone 6 Plus'],
  '375x667@2': ['iPhone SE (3rd gen)', 'iPhone SE (2nd gen)', 'iPhone 8', 'iPhone 7', 'iPhone 6s', 'iPhone 6'],
  '320x568@2': ['iPhone SE (1st gen)', 'iPhone 5s', 'iPhone 5c', 'iPhone 5']
}

/** Samsung model-code stems ("SM-S928B" → "S928") for the phones listed. */
const SAMSUNG_CODES: Record<string, string> = {
  S938: 'Galaxy S25 Ultra', S937: 'Galaxy S25 Edge', S936: 'Galaxy S25+', S931: 'Galaxy S25', S731: 'Galaxy S25 FE',
  S928: 'Galaxy S24 Ultra', S926: 'Galaxy S24+', S921: 'Galaxy S24', S721: 'Galaxy S24 FE',
  S918: 'Galaxy S23 Ultra', S916: 'Galaxy S23+', S911: 'Galaxy S23', S711: 'Galaxy S23 FE',
  S908: 'Galaxy S22 Ultra', S906: 'Galaxy S22+', S901: 'Galaxy S22',
  G998: 'Galaxy S21 Ultra', G996: 'Galaxy S21+', G991: 'Galaxy S21', G990: 'Galaxy S21 FE',
  G988: 'Galaxy S20 Ultra', G985: 'Galaxy S20+', G986: 'Galaxy S20+', G980: 'Galaxy S20', G981: 'Galaxy S20', G780: 'Galaxy S20 FE', G781: 'Galaxy S20 FE',
  G977: 'Galaxy S10 5G', G975: 'Galaxy S10+', G973: 'Galaxy S10', G970: 'Galaxy S10e',
  G965: 'Galaxy S9+', G960: 'Galaxy S9', G955: 'Galaxy S8+', G950: 'Galaxy S8',
  N985: 'Galaxy Note20 Ultra', N986: 'Galaxy Note20 Ultra', N980: 'Galaxy Note20', N981: 'Galaxy Note20',
  N975: 'Galaxy Note10+', N976: 'Galaxy Note10+', N970: 'Galaxy Note10', N960: 'Galaxy Note9', N950: 'Galaxy Note8',
  F966: 'Galaxy Z Fold7', F956: 'Galaxy Z Fold6', F946: 'Galaxy Z Fold5', F936: 'Galaxy Z Fold4', F926: 'Galaxy Z Fold3', F916: 'Galaxy Z Fold2',
  F766: 'Galaxy Z Flip7', F761: 'Galaxy Z Flip7 FE', F741: 'Galaxy Z Flip6', F731: 'Galaxy Z Flip5', F721: 'Galaxy Z Flip4', F711: 'Galaxy Z Flip3',
  A566: 'Galaxy A56', A556: 'Galaxy A55', A546: 'Galaxy A54', A536: 'Galaxy A53', A525: 'Galaxy A52', A526: 'Galaxy A52',
  A366: 'Galaxy A36', A356: 'Galaxy A35', A346: 'Galaxy A34', A336: 'Galaxy A33', A325: 'Galaxy A32', A326: 'Galaxy A32',
  A266: 'Galaxy A26', A256: 'Galaxy A25', A245: 'Galaxy A24', A165: 'Galaxy A16', A166: 'Galaxy A16',
  A155: 'Galaxy A15', A156: 'Galaxy A15', A145: 'Galaxy A14', A146: 'Galaxy A14', A065: 'Galaxy A06', A055: 'Galaxy A05',
  A736: 'Galaxy A73', A725: 'Galaxy A72', A715: 'Galaxy A71', A515: 'Galaxy A51', A505: 'Galaxy A50'
}

type Detection =
  | { kind: 'exact', name: string, via: string }
  | { kind: 'candidates', names: string[], via: string }
  | { kind: 'brand', brand: Brand, via: string }

const detection = ref<Detection | null>(null)
const detectedBrandLabel = computed(() => {
  const d = detection.value
  return d?.kind === 'brand' ? BRANDS.find(b => b.id === d.brand)?.label : ''
})
const detectDismissed = ref(false)
/** What was selected before detection auto-picked a phone, for "Not my phone". */
const beforeDetect = ref<{ brand: Brand, model: string, designMah: number } | null>(null)

const liveBattery = ref<{ level: number, charging: boolean } | null>(null)
/** Whether the charge field follows the phone's live level. Typing stops it. */
const chargeFromDevice = ref(true)
const isMobileDevice = ref(false)
const isIOS = ref(false)

const squash = (v: string) => v.toLowerCase().replace(/[^a-z0-9+]/g, '')
const BRAND_WORDS = /^(galaxy|oppo|vivo|honor|xiaomi|oneplus|google)/
/** Model names keyed by their squashed form, with and without brand prefix. */
const NAME_LOOKUP = new Map<string, string>(
  [...MODEL_MAH.keys()].flatMap(n => [[squash(n), n], [squash(n).replace(BRAND_WORDS, ''), n]] as [string, string][])
)

function modelFromCode(code: string): string | undefined {
  const samsung = code.match(/^SM-([A-Z]\d{3})/i)?.[1]?.toUpperCase()
  if (samsung) return SAMSUNG_CODES[samsung]
  return NAME_LOOKUP.get(squash(code)) ?? NAME_LOOKUP.get(squash(code).replace(BRAND_WORDS, ''))
}

function brandFromCode(code: string): Brand | undefined {
  if (/^SM-/i.test(code)) return 'samsung'
  if (/pixel/i.test(code)) return 'google'
  if (/oneplus/i.test(code)) return 'oneplus'
  if (/redmi|poco|xiaomi|^mi\s|^\d{4,5}[A-Z0-9]{3,}$/i.test(code)) return 'xiaomi'
  if (/^V\d{4}/.test(code) || /vivo/i.test(code)) return 'vivo'
  if (/^NX\d{3}/i.test(code) || /redmagic|nubia/i.test(code)) return 'redmagic'
  if (/^CPH\d{4}/i.test(code) || /oppo/i.test(code)) return 'oppo'
  if (/^[A-Z]{3}-[A-Z]{1,2}\d/.test(code) || /honor/i.test(code)) return 'honor'
  return undefined
}

type UAData = { mobile?: boolean, getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string }> }

async function detectPhone(): Promise<Detection | null> {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) {
    const w = Math.min(screen.width, screen.height)
    const h = Math.max(screen.width, screen.height)
    const key = `${w}x${h}@${Math.round(devicePixelRatio)}`
    const names = (IPHONE_SCREENS[key] ?? []).filter(n => MODEL_MAH.has(n))
    if (names.length === 1) return { kind: 'exact', name: names[0]!, via: `${w}×${h} screen` }
    if (names.length > 1) return { kind: 'candidates', names, via: `${w}×${h} screen` }
    return { kind: 'brand', brand: 'apple', via: 'iPhone' }
  }

  let code = ''
  const uaData = (navigator as Navigator & { userAgentData?: UAData }).userAgentData
  if (uaData?.getHighEntropyValues) {
    try {
      code = (await uaData.getHighEntropyValues(['model'])).model ?? ''
    } catch { /* not allowed */ }
  }
  // Older browsers still put the model in the UA string; reduced UAs say "K".
  if (!code) code = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/)?.[1]?.trim() ?? ''
  if (!code || code === 'K') return null

  const name = modelFromCode(code)
  if (name) return { kind: 'exact', name, via: code }
  const b = brandFromCode(code)
  return b ? { kind: 'brand', brand: b, via: code } : null
}

function applyModel(name: string) {
  const b = brandOf(name)
  if (b) brand.value = b
  pickModel(name)
}

function undoDetect() {
  const prev = beforeDetect.value
  if (prev) {
    brand.value = prev.brand
    model.value = prev.model
    designMah.value = prev.designMah
  }
  detectDismissed.value = true
}

function useLiveCharge() {
  chargeFromDevice.value = true
  if (liveBattery.value) chargePct.value = Math.round(liveBattery.value.level * 100)
  sfx.play('select')
}

function onChargeInput() {
  if (liveBattery.value) chargeFromDevice.value = false
}

type BatteryManager = EventTarget & { level: number, charging: boolean }

onMounted(async () => {
  const ua = navigator.userAgent
  const uaData = (navigator as Navigator & { userAgentData?: UAData }).userAgentData
  isIOS.value = /iPhone|iPad|iPod/.test(ua)
  isMobileDevice.value = uaData?.mobile ?? /Mobi|Android|iPhone/.test(ua)

  // A laptop's battery says nothing about a phone, so only read it on mobile.
  const getBattery = (navigator as Navigator & { getBattery?: () => Promise<BatteryManager> }).getBattery
  if (isMobileDevice.value && typeof getBattery === 'function') {
    try {
      const battery = await getBattery.call(navigator)
      const sync = () => {
        liveBattery.value = { level: battery.level, charging: battery.charging }
        if (chargeFromDevice.value) chargePct.value = Math.round(battery.level * 100)
      }
      sync()
      battery.addEventListener('levelchange', sync)
      battery.addEventListener('chargingchange', sync)
    } catch { /* blocked by permissions policy */ }
  }

  if (sharedView.value) return
  const found = await detectPhone()
  if (!found) return
  detection.value = found
  beforeDetect.value = { brand: brand.value, model: model.value, designMah: designMah.value }
  if (found.kind === 'exact') {
    if (model.value !== found.name) applyModel(found.name)
  } else if (found.kind === 'candidates') {
    if (!found.names.includes(model.value)) brand.value = 'apple'
  } else if (brandOf(model.value) !== found.brand) {
    brand.value = found.brand
  }
})
</script>

<template>
  <ToolPage header="bar">
    <div class="pb">
      <div class="layout">
        <!-- INPUTS -->
        <section class="card">
          <h2>Your battery</h2>

          <div v-if="sharedView" class="detect" role="status">
            <span class="detect-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 9V1.8M4.2 4.4L7 1.6l2.8 2.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /><path d="M2.5 7.5v3.2c0 .7.6 1.3 1.3 1.3h6.4c.7 0 1.3-.6 1.3-1.3V7.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
            </span>
            <div class="detect-body">
              <strong>You're viewing a shared result</strong>
              <small>Changes here aren't saved. <button type="button" class="detect-link" @click="leaveSharedView">Check my own phone instead</button></small>
            </div>
          </div>

          <Transition name="detect">
            <div v-if="detection && !detectDismissed" class="detect" role="status">
              <span class="detect-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="4" y="1.5" width="8" height="13" rx="2" stroke="currentColor" stroke-width="1.3" /><path d="M7 12.5h2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
                <span class="detect-ping" />
              </span>
              <div class="detect-body">
                <template v-if="detection.kind === 'exact'">
                  <strong>This looks like a {{ detection.name }}</strong>
                  <small>Picked automatically from {{ detection.via }}. <button type="button" class="detect-link" @click="undoDetect">Not my phone</button></small>
                </template>
                <template v-else-if="detection.kind === 'candidates'">
                  <strong>You're on an iPhone. Which one?</strong>
                  <small>iPhones only share their screen size ({{ detection.via }}), and these models all use it.</small>
                  <div class="detect-chips">
                    <button
                      v-for="n in detection.names"
                      :key="n"
                      type="button"
                      :class="{ on: model === n }"
                      @click="applyModel(n); revealBattery()"
                    >
                      {{ n }}
                    </button>
                  </div>
                </template>
                <template v-else>
                  <strong>Detected a {{ detectedBrandLabel }} phone</strong>
                  <small>Model {{ detection.via }} isn't in the list yet, so pick the closest one below.</small>
                </template>
              </div>
              <button type="button" class="detect-close" aria-label="Dismiss" @click="detectDismissed = true">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
              </button>
            </div>
          </Transition>

          <div class="seg seg-brands" role="tablist" aria-label="Phone brand">
            <button
              v-for="b in BRANDS"
              :key="b.id"
              type="button"
              :class="{ on: brand === b.id }"
              role="tab"
              :aria-selected="brand === b.id"
              @click="setBrand(b.id)"
            >
              <svg v-if="BRAND_LOGOS[b.id]" class="brand-logo" :class="{ wide: BRAND_LOGOS[b.id]!.wide }" :viewBox="BRAND_LOGOS[b.id]!.box" aria-hidden="true"><path :d="BRAND_LOGOS[b.id]!.d" /></svg>
              <span v-else class="brand-logo brand-badge" aria-hidden="true">RM</span>
              <span>{{ b.label }}</span>
            </button>
          </div>

          <div class="field">
            <span id="pm-label">Phone model</span>
            <div class="pm">
              <div class="pm-current">
                <span class="pm-icon" :class="{ wide: BRAND_LOGOS[brand]?.wide }" aria-hidden="true">
                  <Transition name="pm-logo" mode="out-in">
                    <svg v-if="BRAND_LOGOS[brand]" :key="brand" class="pm-logo" :viewBox="BRAND_LOGOS[brand]!.box"><path :d="BRAND_LOGOS[brand]!.d" /></svg>
                    <span v-else :key="`${brand}-badge`" class="brand-badge">RM</span>
                  </Transition>
                </span>
                <span class="pm-value" aria-live="polite">
                  <Transition name="pm-swap" mode="out-in">
                    <span :key="model" class="pm-value-inner">
                      <template v-if="model">
                        <strong>{{ model }}</strong>
                        <em>{{ fmt(MODEL_MAH.get(model) ?? 0) }} mAh</em>
                      </template>
                      <span v-else class="pm-placeholder">Tap your phone below</span>
                    </span>
                  </Transition>
                </span>
              </div>

              <div class="pm-search">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3" />
                  <path d="M9.5 9.5L13 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                </svg>
                <input
                  v-model="query"
                  type="text"
                  :placeholder="BRANDS.find(b => b.id === brand)?.search"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="pm-list"
                  :aria-activedescendant="activeIndex >= 0 ? `pm-opt-${activeIndex}` : undefined"
                  autocomplete="off"
                  spellcheck="false"
                  @keydown="onPickerKey"
                >
              </div>

              <div id="pm-list" ref="listRef" :key="brand" class="pm-list" role="listbox" aria-labelledby="pm-label">
                <div
                  v-if="!query.trim()"
                  id="pm-opt-0"
                  class="pm-manual"
                  role="option"
                  :aria-selected="model === ''"
                  :data-active="activeIndex === 0"
                  @click="choose('')"
                  @pointerenter="activeIndex = 0"
                >
                  <span>Other — enter capacity manually</span>
                  <svg v-if="model === ''" class="pm-check" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5l2.5 2.5 4.5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </div>

                <section v-for="group in filteredGroups" :key="group.label" role="group" :aria-label="group.label">
                  <h3 class="pm-group">{{ group.label }}</h3>
                  <div class="pm-grid">
                    <div
                      v-for="[name, mah] in group.models"
                      :id="`pm-opt-${optionIndex.get(name)}`"
                      :key="name"
                      class="pm-tile"
                      role="option"
                      :aria-selected="model === name"
                      :data-active="activeIndex === optionIndex.get(name)"
                      :style="{ '--d': `${Math.min(optionIndex.get(name) ?? 0, 16) * 14}ms` }"
                      @click="choose(name)"
                      @pointerenter="activeIndex = optionIndex.get(name) ?? -1"
                    >
                      <span class="pm-name">{{ name }}</span>
                      <span class="pm-mah">{{ fmt(mah) }} <small>mAh</small></span>
                      <span class="pm-bar" :style="{ '--w': `${Math.min(100, mah / 80)}%` }" />
                      <svg v-if="model === name" class="pm-check" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5l2.5 2.5 4.5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    </div>
                  </div>
                </section>

                <p v-if="!pickerOptions.length" class="pm-empty">
                  No model matches “{{ query.trim() }}”.
                </p>
              </div>
            </div>
            <small>Picking a model fills in its original capacity. Figures are the maker's published capacity, or regulatory filings and teardowns for iPhone. Where a phone's battery differs by region, the global version is listed.</small>
          </div>

          <label class="field">
            <span>Capacity when new</span>
            <div class="input-wrap">
              <input v-model.number="designMah" type="number" min="0" step="50" inputmode="numeric">
              <em>mAh</em>
            </div>
            <small>The rated capacity from the spec sheet, e.g. 5000 mAh.</small>
          </label>

          <div class="seg" role="tablist" aria-label="What do you know?">
            <button type="button" :class="{ on: mode === 'health' }" role="tab" :aria-selected="mode === 'health'" @click="setMode('health')">
              I know health %
            </button>
            <button type="button" :class="{ on: mode === 'mah' }" role="tab" :aria-selected="mode === 'mah'" @click="setMode('mah')">
              I know current mAh
            </button>
          </div>

          <label v-if="mode === 'health'" class="field">
            <span>Battery health</span>
            <div class="input-wrap">
              <input v-model.number="healthPct" type="number" min="0" max="100" step="1" inputmode="decimal">
              <em>%</em>
            </div>
            <input v-model.number="healthPct" class="range" type="range" min="40" max="100" step="1" aria-label="Battery health">
            <small>iPhone: Settings → Battery → Battery Health. Android: Settings → Battery, or an app like AccuBattery.</small>
          </label>

          <label v-else class="field">
            <span>Current full-charge capacity</span>
            <div class="input-wrap">
              <input v-model.number="measuredMah" type="number" min="0" step="10" inputmode="numeric">
              <em>mAh</em>
            </div>
            <small>The measured capacity a battery app reports today.</small>
          </label>

          <label class="field">
            <span class="charge-label">
              Charge right now
              <Transition name="detect" mode="out-in">
                <em v-if="liveBattery && chargeFromDevice" key="live" class="live-tag">
                  <i class="live-dot" />
                  Live from this phone{{ liveBattery.charging ? ' · charging' : '' }}
                </em>
                <button v-else-if="liveBattery" key="use" type="button" class="live-tag live-btn" @click.prevent="useLiveCharge">
                  Use live ({{ Math.round(liveBattery.level * 100) }}%)
                </button>
              </Transition>
            </span>
            <div class="input-wrap">
              <input v-model.number="chargePct" type="number" min="0" max="100" step="1" inputmode="numeric" @input="onChargeInput">
              <em>%</em>
            </div>
            <input v-model.number="chargePct" class="range" type="range" min="0" max="100" step="1" aria-label="Charge right now" @input="onChargeInput">
            <small v-if="liveBattery">Read from your phone and kept up to date. Type a value to override it.</small>
            <small v-else-if="isIOS">iPhones don't share their battery level with web pages, so enter the % from your status bar.</small>
            <small v-else>The percentage shown in your status bar.</small>
          </label>
        </section>

        <!-- RESULTS -->
        <section v-sticky-fit class="card results">
          <div class="status" :class="`s-${status.key}`">
            <span class="dot" />
            <strong>{{ status.label }}</strong>
            <span class="health">{{ fmt(health, 1) }}% health</span>
            <button type="button" class="share-btn" :class="shareState" :aria-label="shareState === 'copied' ? 'Copied' : 'Share result'" @click="shareResult">
              <Transition name="pm-swap" mode="out-in">
                <span v-if="shareState === 'copied'" key="ok" class="share-inner">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 7.5l2.5 2.5L11 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  Copied
                </span>
                <span v-else-if="shareState === 'failed'" key="fail" class="share-inner">Couldn't copy</span>
                <span v-else key="idle" class="share-inner">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 9V1.8M4.2 4.4L7 1.6l2.8 2.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /><path d="M2.5 7.5v3.2c0 .7.6 1.3 1.3 1.3h6.4c.7 0 1.3-.6 1.3-1.3V7.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
                  Share
                </span>
              </Transition>
            </button>
          </div>

          <div ref="batteryRef" class="battery ambient-motion" :class="{ flash: batteryFlash }" role="img" :aria-label="`${fmt(health, 1)}% of original capacity, ${fmt(newEquivalentPct, 1)}% of original charge`">
            <div class="cell">
              <div class="lost" :style="{ left: `${usableWidth}%` }" />
              <div class="fill" :class="`s-${status.key}`" :style="{ width: `${fillWidth}%` }">
                <div class="liquid">
                  <span
                    v-for="(b, i) in BUBBLES"
                    :key="i"
                    class="bubble"
                    :style="{ left: `${b.x}%`, width: `${b.s}px`, height: `${b.s}px`, animationDuration: `${b.t}s`, animationDelay: `${b.d}s` }"
                  />
                </div>
                <div v-if="fillWidth > 0.5" :key="sloshKey" class="wave-edge">
                  <svg class="wave wave-back" viewBox="0 0 20 80" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 0H10Q16 10 10 20T10 40T10 60T10 80H0Z" />
                  </svg>
                  <svg class="wave wave-front" viewBox="0 0 20 80" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 0H10Q16 10 10 20T10 40T10 60T10 80H0Z" />
                  </svg>
                </div>
              </div>
              <div class="cap-mark" :style="{ left: `${usableWidth}%` }" />
            </div>
            <div class="nub" />
          </div>
          <div class="legend">
            <span><i class="sw sw-fill" /> Charge now</span>
            <span><i class="sw sw-empty" /> Empty, usable</span>
            <span><i class="sw sw-lost" /> Lost to wear</span>
          </div>

          <dl class="stats">
            <div class="stat big">
              <dt>Max capacity now</dt>
              <dd>{{ fmt(currentMax) }} <em>mAh</em></dd>
              <p>Your “100%” today, out of {{ fmt(designMah) }} mAh new.</p>
            </div>
            <div class="stat">
              <dt>Lost to wear</dt>
              <dd>{{ fmt(lostMah) }} <em>mAh</em></dd>
              <p>{{ fmt(Math.max(0, 100 - health), 1) }}% of the original.</p>
            </div>
            <div class="stat">
              <dt>In the battery now</dt>
              <dd>{{ fmt(remainingMah) }} <em>mAh</em></dd>
              <p>{{ fmt(charge) }}% of {{ fmt(currentMax) }} mAh.</p>
            </div>
            <div class="stat">
              <dt>Same as new phone at</dt>
              <dd>{{ fmt(newEquivalentPct, 1) }} <em>%</em></dd>
              <p>Your {{ fmt(charge) }}% would show this on a new battery.</p>
            </div>
          </dl>

          <div class="life">
            <div class="life-head">
              <h3>Battery life</h3>
              <div class="seg life-seg" role="tablist" aria-label="How you use your phone">
                <button
                  v-for="u in USAGE"
                  :key="u.id"
                  type="button"
                  role="tab"
                  :class="{ on: usage === u.id }"
                  :aria-selected="usage === u.id"
                  @click="setUsage(u.id)"
                >
                  {{ u.label }}
                </button>
              </div>
            </div>
            <p class="life-hint">{{ USAGE.find(u => u.id === usage)!.hint }} · about {{ fmt(drainMa) }} mA average draw</p>

            <div class="life-now">
              <span class="life-label">Screen time left now</span>
              <Transition name="pm-swap" mode="out-in">
                <strong :key="fmtHours(hoursLeft)">{{ fmtHours(hoursLeft) }}</strong>
              </Transition>
              <span class="life-sub">from {{ fmt(remainingMah) }} mAh at {{ fmt(charge) }}%</span>
            </div>

            <div class="life-bars">
              <div class="life-row">
                <span>Full charge today</span>
                <div class="life-track"><div class="life-fill" :style="{ width: `${hoursNew ? Math.min(100, hoursFull / hoursNew * 100) : 0}%` }" /></div>
                <b>{{ fmtHours(hoursFull) }}</b>
              </div>
              <div class="life-row">
                <span>Full charge when new</span>
                <div class="life-track"><div class="life-fill new" style="width: 100%" /></div>
                <b>{{ fmtHours(hoursNew) }}</b>
              </div>
            </div>
            <p v-if="hoursLost >= 1 / 60" class="life-lost">
              Wear costs you about <strong>{{ fmtHours(hoursLost) }}</strong> per full charge.
            </p>
            <p class="life-foot">Estimates only: real battery life depends on your screen brightness, signal and apps.</p>
          </div>

          <p class="note">{{ status.note }}</p>
        </section>
      </div>

      <section class="card how">
        <h2>How it’s calculated</h2>
        <ul>
          <li><strong>Max capacity now</strong> = capacity when new × health %</li>
          <li><strong>Health %</strong> = current mAh ÷ capacity when new × 100</li>
          <li><strong>In the battery now</strong> = max capacity now × charge %</li>
          <li><strong>Same as new phone at</strong> = in the battery now ÷ capacity when new × 100</li>
        </ul>
      </section>
    </div>
  </ToolPage>
</template>

<style scoped>
/* This page's own palette, mapped onto the app's tokens so it follows light/dark mode */
.pb {
  --gray: var(--ink-2);
  --border: var(--line);
  --black: var(--ink);
  --white: var(--surface);
  --light: var(--surface-2);
  --font-sans: var(--font);
  --font-serif: var(--font);
  --pb-good: #3f8f5a;
  --pb-great: #2f7d4a;
  --pb-worn: #c9862b;
  --pb-replace: #c0473a;
  --pb-over: #4a76b0;
  --pb-card: var(--surface);
  --pb-on-ink: var(--surface);
  --pb-line-strong: color-mix(in srgb, var(--ink) 25%, var(--line));
  --pb-hatch-a: var(--surface-2);
  --pb-hatch-b: var(--surface);
  width: 100%;
}

:root[data-theme='dark'] .pb {
  --pb-good: #5bbd7c;
  --pb-great: #4fb070;
  --pb-worn: #e3a552;
  --pb-replace: #e86d5f;
  --pb-over: #77a3df;
}

:root[data-theme='dark'] .pb .card,
:root[data-theme='dark'] .pb .pm,
:root[data-theme='dark'] .pb .stats { box-shadow: none; }
:root[data-theme='dark'] .pb .pm-tile[data-active="true"] { box-shadow: 0 8px 18px -10px rgba(0, 0, 0, 0.8); }
:root[data-theme='dark'] .pb .range { accent-color: var(--pb-good); }

.pb .card,
.pb .stat,
.pb .pm-tile,
.pb .seg { transition: background-color 0.3s, border-color 0.3s, color 0.3s; }

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  align-items: start;
  gap: 1.5rem;
}

/* keep the battery and numbers in view while browsing the model grid */
.results {
  position: sticky;
  top: 5.5rem;
}

@media (min-width: 1001px) {
  .pm-list { max-height: 560px; }
}
@media (min-width: 1280px) {
  .seg.seg-brands { grid-template-columns: repeat(9, 1fr); }
}

@media (max-width: 1000px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  .results { position: static; }
}

.card {
  background: var(--pb-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1.75rem;
}

.card h2 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 1.25rem;
}

/* INPUTS */
.field { display: block; margin-bottom: 1.5rem; }
.field > span { display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.4rem; }
.field small { display: block; margin-top: 0.4rem; font-size: 0.75rem; color: var(--gray); line-height: 1.45; }

.input-wrap {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--white);
  transition: border-color 0.2s;
}
.input-wrap:focus-within { border-color: var(--black); }
.input-wrap input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0.7rem 0.85rem;
  font: 400 1.125rem var(--font-sans);
  font-variant-numeric: tabular-nums;
  color: var(--black);
  outline: none;
}

/* DEVICE DETECTION */
.detect {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  padding: 0.85rem 0.85rem 0.85rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--pb-card);
}
.detect-icon {
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--black);
  color: var(--pb-on-ink);
}
.detect-ping {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  border: 2px solid var(--pb-good);
  animation: detect-ping 2s cubic-bezier(.2, .8, .2, 1) infinite;
}
.detect-body { flex: 1; min-width: 0; display: grid; gap: 0.2rem; }
.detect-body strong { font-weight: 600; font-size: 0.9375rem; }
.detect-body small { font-size: 0.75rem; color: var(--gray); line-height: 1.45; }
.detect-link {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  color: var(--black);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.detect-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; }
.detect-chips button {
  border: 1px solid var(--border);
  background: var(--pb-card);
  border-radius: 999px;
  padding: 0.3rem 0.7rem;
  font: 400 0.8125rem var(--font-sans);
  color: var(--black);
  cursor: pointer;
  transition: background 0.18s, color 0.18s, border-color 0.18s, transform 0.2s cubic-bezier(.34, 1.56, .64, 1);
}
.detect-chips button:hover { border-color: var(--pb-line-strong); transform: translateY(-1px); }
.detect-chips button.on { background: var(--black); border-color: var(--black); color: var(--pb-on-ink); }
.detect-close {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--gray);
  cursor: pointer;
  transition: background 0.18s, color 0.18s;
}
.detect-close:hover { background: var(--light); color: var(--black); }

.detect-enter-active,
.detect-leave-active { transition: opacity 0.25s ease, transform 0.35s cubic-bezier(.2, .8, .2, 1); }
.detect-enter-from,
.detect-leave-to { opacity: 0; transform: translateY(-6px); }

@keyframes detect-ping {
  0% { opacity: 0.9; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.45); }
}

.field > .charge-label { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.live-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-style: normal;
  font-size: 0.75rem;
  color: var(--pb-good);
}
.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  animation: live-pulse 1.6s ease-in-out infinite;
}
.live-btn {
  border: 1px solid var(--border);
  background: var(--pb-card);
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  font-family: var(--font-sans);
  color: var(--black);
  cursor: pointer;
}
.live-btn:hover { border-color: var(--pb-line-strong); }
@keyframes live-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(63, 143, 90, 0.45); }
  50% { box-shadow: 0 0 0 5px rgba(63, 143, 90, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .detect-ping, .live-dot { animation: none; }
}

/* MODEL GRID */
.pm {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--pb-card);
  overflow: hidden;
}

.pm-current {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.85rem 0.6rem 0.6rem;
  border-bottom: 1px solid var(--border);
  background: var(--white);
}

.pm-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--black);
  color: var(--pb-on-ink);
  transition: width 0.3s cubic-bezier(.2, .8, .2, 1);
}
.pm-logo { width: 18px; height: 18px; fill: currentColor; }
.pm-icon.wide { width: 56px; }
.pm-icon.wide .pm-logo { width: 44px; }
.pm-icon .brand-badge { width: 20px; height: 20px; }
.pm-logo-enter-active,
.pm-logo-leave-active { transition: opacity 0.18s, transform 0.25s cubic-bezier(.34, 1.56, .64, 1); }
.pm-logo-enter-from { opacity: 0; transform: scale(0.5) rotate(-20deg); }
.pm-logo-leave-to { opacity: 0; transform: scale(0.5) rotate(20deg); }

.pm-value { flex: 1; min-width: 0; }
.pm-value-inner { display: flex; align-items: baseline; gap: 0.6rem; min-width: 0; }
.pm-value strong { font-weight: 600; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pm-value em { font-style: normal; font-size: 0.75rem; color: var(--gray); white-space: nowrap; font-variant-numeric: tabular-nums; }
.pm-placeholder { font-size: 0.875rem; color: var(--gray); }

.pm-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.85rem;
  border-bottom: 1px solid var(--border);
  color: var(--gray);
}
.pm-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  padding: 0.75rem 0;
  background: transparent;
  font: 400 1rem var(--font-sans); /* 16px or more, so phones don't zoom in when it's tapped */
  color: var(--black);
  outline: none;
}

.pm-list {
  max-height: 420px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.5rem;
  scroll-padding: 2.25rem 0 0.5rem;
}

.pm-group {
  position: sticky;
  top: -0.5rem;
  z-index: 1;
  margin: 0 -0.5rem;
  padding: 0.75rem 0.85rem 0.45rem;
  background: linear-gradient(var(--pb-card) 75%, transparent);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--gray);
}

.pm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 0.4rem;
}

.pm-manual {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border: 1px dashed var(--border);
  border-radius: 10px;
  font-size: 0.875rem;
  color: var(--gray);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  animation: pm-item 0.32s cubic-bezier(.2, .8, .2, 1) both;
}
.pm-manual span { flex: 1; }
.pm-manual[data-active="true"] { background: var(--light); border-color: var(--pb-line-strong); color: var(--black); }

.pm-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-height: 78px;
  padding: 0.65rem 0.7rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--pb-card);
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.22s cubic-bezier(.2, .8, .2, 1), border-color 0.18s, box-shadow 0.22s, background 0.18s;
  animation: pm-tile 0.36s cubic-bezier(.2, .8, .2, 1) var(--d, 0ms) both;
}
.pm-tile[data-active="true"] {
  transform: translateY(-2px);
  border-color: var(--pb-line-strong);
  background: var(--white);
  box-shadow: 0 8px 18px -10px rgba(0, 0, 0, 0.25);
}
.pm-tile[aria-selected="true"] { border-color: var(--black); box-shadow: 0 0 0 1px var(--black); }

.pm-name { font-size: 0.84rem; line-height: 1.25; padding-right: 1rem; }
.pm-tile[aria-selected="true"] .pm-name { font-weight: 600; }
.pm-mah { margin-top: auto; font-family: var(--font-serif); font-weight: 700; font-size: 1.2rem; line-height: 1; font-variant-numeric: tabular-nums; }
.pm-mah small { display: inline; margin: 0; font-family: var(--font-sans); font-weight: 400; font-size: 0.6875rem; color: var(--gray); }

/* thin capacity bar along the tile's bottom edge, scaled to 8000 mAh */
.pm-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  width: var(--w);
  background: var(--black);
  opacity: 0.12;
  transform-origin: left;
  transition: opacity 0.2s;
  animation: pm-bar 0.6s cubic-bezier(.2, .8, .2, 1) calc(var(--d, 0ms) + 120ms) both;
}
.pm-tile[data-active="true"] .pm-bar,
.pm-tile[aria-selected="true"] .pm-bar { opacity: 0.55; }

.pm-tile .pm-check { position: absolute; top: 0.6rem; right: 0.6rem; }
.pm-check { flex-shrink: 0; color: var(--black); animation: pm-check 0.3s cubic-bezier(.34, 1.56, .64, 1) both; }
.pm-empty { padding: 1.25rem 0.6rem; text-align: center; font-size: 0.875rem; color: var(--gray); }

@keyframes pm-item {
  from { opacity: 0; transform: translateY(-4px); }
}
@keyframes pm-tile {
  from { opacity: 0; transform: translateY(6px) scale(0.96); }
}
@keyframes pm-bar {
  from { transform: scaleX(0); }
}
@keyframes pm-check {
  from { opacity: 0; transform: scale(0.4); }
}

/* Lite effects: the tile grid appears at once instead of cascading in */
:root[data-effects='lite'] .pm-tile,
:root[data-effects='lite'] .pm-bar,
:root[data-effects='lite'] .pm-manual { animation: none; }

/* selected value swap */
.pm-swap-enter-active,
.pm-swap-leave-active { transition: opacity 0.18s ease, transform 0.22s cubic-bezier(.2, .8, .2, 1); }
.pm-swap-enter-from { opacity: 0; transform: translateY(6px); }
.pm-swap-leave-to { opacity: 0; transform: translateY(-6px); }

@media (prefers-reduced-motion: reduce) {
  .pm *, .pm *::before, .pm *::after { animation: none !important; transition-duration: 0.01ms !important; }
}
.input-wrap em { font-style: normal; color: var(--gray); font-size: 0.8125rem; padding-right: 0.85rem; }

.range { width: 100%; margin-top: 0.6rem; accent-color: var(--accent); }

.seg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  margin-bottom: 1.25rem;
  background: var(--light);
  border-radius: 10px;
}
.seg button {
  border: 0;
  background: transparent;
  padding: 0.55rem 0.5rem;
  border-radius: 7px;
  font: 500 0.8125rem var(--font-sans);
  color: var(--gray);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.seg-brands { grid-template-columns: repeat(3, 1fr); }
.seg-brands button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.6rem 0.4rem 0.5rem;
}
.brand-logo {
  width: 20px;
  height: 20px;
  fill: currentColor;
  opacity: 0.55;
  transition: opacity 0.2s, transform 0.35s cubic-bezier(.34, 1.56, .64, 1);
}
.seg-brands button:hover .brand-logo { opacity: 0.8; }
.brand-logo.wide { width: 46px; }
.seg-brands button.on .brand-logo { opacity: 1; transform: scale(1.12); }
.brand-badge {
  display: inline-grid;
  place-items: center;
  font: 600 0.5625rem/1 var(--font-sans);
  letter-spacing: 0.02em;
  color: #fff;
  background: #c8102e;
  border-radius: 5px;
}
.seg-brands .brand-badge { width: 20px; height: 20px; }
.seg button.on { background: var(--pb-card); color: var(--black); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }

/* STATUS */
.status { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.5rem; }
.status strong { font-weight: 700; }
.status .health { margin-left: auto; color: var(--gray); font-size: 0.875rem; font-variant-numeric: tabular-nums; }

.share-btn {
  display: inline-flex;
  align-items: center;
  min-width: 5.75rem;
  justify-content: center;
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--pb-card);
  font: 500 0.8125rem var(--font-sans);
  color: var(--black);
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s, color 0.18s, transform 0.25s cubic-bezier(.34, 1.56, .64, 1);
}
.share-btn:hover { border-color: var(--pb-line-strong); transform: translateY(-1px); }
.share-btn:active { transform: scale(0.96); }
.share-btn.copied { border-color: var(--pb-good); color: var(--pb-good); }
.share-btn.failed { border-color: var(--pb-replace); color: var(--pb-replace); }
.share-inner { display: inline-flex; align-items: center; gap: 0.4rem; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: currentColor; }
.status.s-great { color: var(--pb-great); }
.status.s-good { color: var(--pb-good); }
.status.s-worn { color: var(--pb-worn); }
.status.s-replace { color: var(--pb-replace); }
.status.s-over { color: var(--pb-over); }

/* BATTERY */
.battery { display: flex; align-items: center; gap: 4px; scroll-margin: 6rem 0 2rem; }
.battery.flash .cell { animation: battery-flash 1.1s cubic-bezier(.2, .8, .2, 1) 0.35s; }
@keyframes battery-flash {
  0% { box-shadow: 0 0 0 0 rgba(63, 143, 90, 0.5); }
  100% { box-shadow: 0 0 0 14px rgba(63, 143, 90, 0); }
}
.cell {
  position: relative;
  flex: 1;
  height: 64px;
  border: 2px solid var(--black);
  border-radius: 12px;
  padding: 4px;
  overflow: hidden;
  background: var(--pb-card);
}
.fill {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  max-width: calc(100% - 8px);
  color: var(--liq);
  transition: width 0.9s cubic-bezier(.34, 1.25, .5, 1), color 0.4s;
}
.fill.s-great { --liq: var(--pb-great); }
.fill.s-good { --liq: var(--pb-good); }
.fill.s-worn { --liq: var(--pb-worn); }
.fill.s-replace { --liq: var(--pb-replace); }
.fill.s-over { --liq: var(--pb-over); }

/* liquid body: colour, a light band across the top like a meniscus, and a
   slow sheen drifting through */
.liquid {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 7px 0 0 7px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.06) 22%, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.12) 100%),
    currentColor;
  transition: background-color 0.4s;
}
.liquid::after {
  content: '';
  position: absolute;
  inset: 0 -50%;
  background: linear-gradient(100deg, transparent 35%, rgba(255, 255, 255, 0.22) 50%, transparent 65%);
  animation: liquid-sheen 5.5s ease-in-out infinite;
}

.bubble {
  position: absolute;
  bottom: -8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: inset -1px -1px 0 rgba(255, 255, 255, 0.4);
  animation: bubble-rise linear infinite both;
}

/* wavy leading edge: a vertical sine path twice the fill's height, scrolled
   by exactly one period so the loop is seamless */
.wave-edge {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(100% - 1px);
  width: 14px;
  overflow: hidden;
  transform-origin: left center;
  animation: slosh 1.3s cubic-bezier(.3, .7, .4, 1) both;
}
.wave {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 200%;
  fill: currentColor;
}
.wave-front { animation: wave-flow 2.2s linear infinite; }
.wave-back { opacity: 0.45; transform: translateX(3px); animation: wave-flow-back 3.1s linear infinite; }

@keyframes wave-flow {
  from { transform: translateY(0); }
  to { transform: translateY(-50%); }
}
@keyframes wave-flow-back {
  from { transform: translate(3px, -50%); }
  to { transform: translate(3px, 0); }
}
@keyframes slosh {
  0% { transform: scaleX(2.4); }
  25% { transform: scaleX(0.5); }
  45% { transform: scaleX(1.6); }
  65% { transform: scaleX(0.8); }
  82% { transform: scaleX(1.15); }
  100% { transform: scaleX(1); }
}
@keyframes bubble-rise {
  0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
  15% { opacity: 1; }
  50% { transform: translate(3px, -34px) scale(1); }
  85% { opacity: 0.9; }
  100% { transform: translate(-2px, -72px) scale(1.1); opacity: 0; }
}
@keyframes liquid-sheen {
  0%, 100% { transform: translateX(-30%); }
  50% { transform: translateX(30%); }
}

@media (prefers-reduced-motion: reduce) {
  .fill { transition-duration: 0.01ms; }
  .liquid::after, .bubble, .wave, .wave-edge { animation: none !important; }
  .bubble { display: none; }
}

/* Lite effects: still liquid, no bubbles */
:root[data-effects='lite'] .bubble { display: none; }

.lost {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  background: repeating-linear-gradient(-45deg, var(--pb-hatch-a) 0 6px, var(--pb-hatch-b) 6px 12px);
  transition: left 0.5s cubic-bezier(.2, .8, .2, 1);
}
.cap-mark {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--black);
  opacity: 0.35;
  transition: left 0.5s cubic-bezier(.2, .8, .2, 1);
}
.nub { width: 6px; height: 22px; border-radius: 0 4px 4px 0; background: var(--black); }

.legend { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.75rem; font-size: 0.75rem; color: var(--gray); }
.legend span { display: inline-flex; align-items: center; gap: 0.4rem; }
.sw { width: 12px; height: 12px; border-radius: 3px; border: 1px solid var(--border); }
.sw-fill { background: var(--pb-good); border-color: var(--pb-good); }
.sw-empty { background: var(--pb-card); }
.sw-lost { background: repeating-linear-gradient(-45deg, var(--pb-hatch-a) 0 3px, var(--pb-hatch-b) 3px 6px); }

/* STATS */
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin: 1.75rem 0 0;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.stat { background: var(--pb-card); padding: 1rem; }
.stat.big { grid-column: 1 / -1; }
.stat dt { font-size: 0.8rem; font-weight: 600; color: var(--gray); }
.stat dd { margin: 0.25rem 0 0; font-family: var(--font-serif); font-weight: 700; font-size: 1.75rem; line-height: 1.2; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.stat.big dd { font-size: 2.75rem; }
.stat dd em { font-family: var(--font-sans); font-weight: 400; font-style: normal; font-size: 0.8125rem; color: var(--gray); letter-spacing: 0; }
.stat p { font-size: 0.75rem; color: var(--gray); margin: 0.25rem 0 0; line-height: 1.4; }

.note { margin: 1.25rem 0 0; font-size: 0.875rem; }

/* BATTERY LIFE */
.life {
  margin-top: 1.5rem;
  padding: 1.1rem 1.1rem 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
}
.life-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.life-head h3 {
  font-size: 0.9rem;
  font-weight: 700;
}
.seg.life-seg { grid-template-columns: repeat(3, auto); margin: 0; padding: 3px; }
.life-seg button { padding: 0.3rem 0.75rem; font-size: 0.75rem; }
.life-hint { margin: 0.5rem 0 0; font-size: 0.75rem; color: var(--gray); }

.life-now { display: grid; gap: 0.15rem; margin-top: 1rem; }
.life-label { font-size: 0.75rem; color: var(--gray); }
.life-now strong {
  font-family: var(--font-serif);
  font-weight: 700;
  font-size: 2.5rem;
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.life-sub { font-size: 0.75rem; color: var(--gray); }

.life-bars { display: grid; gap: 0.6rem; margin-top: 1.1rem; }
.life-row {
  display: grid;
  grid-template-columns: 9.5rem 1fr 5.5rem;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8125rem;
}
.life-row span { color: var(--gray); }
.life-row b { font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
.life-track { height: 8px; border-radius: 999px; background: var(--light); overflow: hidden; }
.life-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--pb-good);
  transition: width 0.8s cubic-bezier(.34, 1.2, .5, 1);
}
.life-fill.new { background: var(--pb-line-strong); }
.life-lost { margin: 0.9rem 0 0; font-size: 0.8125rem; }
.life-lost strong { font-weight: 700; color: var(--pb-replace); }
.life-foot { margin: 0.5rem 0 0; font-size: 0.6875rem; color: var(--gray); }

@media (max-width: 480px) {
  .life-row { grid-template-columns: 1fr auto; }
  .life-track { grid-column: 1 / -1; grid-row: 2; }
}

.how { margin-top: 1.5rem; }
.how ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; font-size: 0.875rem; }
.how strong { font-weight: 700; }

@media (max-width: 760px) {
  .card { padding: 1.25rem; }
  .stats { grid-template-columns: 1fr 1fr; }
  .stats .stat:last-child { grid-column: 1 / -1; }
}
</style>
