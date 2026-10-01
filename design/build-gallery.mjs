// Builds one gallery page out of the standalone direction mockups.
// Usage: node build-gallery.mjs <out.html> [--only d01,d07] [--title "..."]
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const out = args[0]
const flag = name => {
  const i = args.indexOf(name)
  return i === -1 ? null : args[i + 1]
}
const only = flag('--only')?.split(',')
const title = flag('--title') ?? 'Truthy: 20 tasarım yönü'
const subtitle =
  flag('--subtitle') ??
  'Hepsi aynı kart, aynı içerik. Mockup’lar canlı: True / False’a dokun, cevap ekranını gör. Beğendiklerini işaretle (birden fazla olur), sonra terminale yaz.'

const base = flag('--dir') ?? here
const manifest = JSON.parse(readFileSync(join(base, 'directions.json'), 'utf-8'))
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
const text = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

const tiles = manifest
  .filter(d => !only || only.includes(d.id))
  .filter(d => existsSync(join(base, 'directions', `${d.id}.html`)))
  .map(d => {
    const html = readFileSync(join(base, 'directions', `${d.id}.html`), 'utf-8')
    const swatches = (d.palette ?? [])
      .map(c => `<span class="sw" style="background:${c}" title="${c}"></span>`)
      .join('')
    return `
  <article class="tile" id="${d.id}">
    <div class="phone"><iframe loading="lazy" title="${text(d.name)}" srcdoc="${esc(html)}"></iframe></div>
    <button class="pick" data-choice="${d.id}" onclick="this.closest('.tile').classList.toggle('on')">
      <span class="num">${d.num ?? d.id.slice(1)}</span>
      <span class="meta">
        <strong>${text(d.name)}</strong>
        <span class="why">${text(d.pitch)}</span>
        <span class="fonts">${text(d.fonts ?? '')}</span>
        <span class="sws">${swatches}</span>
      </span>
      <span class="check" aria-hidden="true">✓</span>
    </button>
  </article>`
  })
  .join('\n')

const page = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${text(title)}</title>
<style>
  :root { color-scheme: light dark; --bg:#ececec; --ink:#161616; --mute:#6a6a6a; --line:#d2d2d2; --tile:#fff; --on:#1f6feb; }
  @media (prefers-color-scheme: dark) { :root { --bg:#151515; --ink:#f1f1f1; --mute:#9a9a9a; --line:#2e2e2e; --tile:#1e1e1e; --on:#6ea8ff; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.45 -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif; }
  header { padding:28px 32px 8px; max-width:1100px; }
  h1 { margin:0 0 6px; font-size:24px; letter-spacing:-0.01em; }
  header p { margin:0; color:var(--mute); max-width:70ch; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(330px, 1fr)); gap:36px 28px; padding:28px 32px 120px; }
  .tile { display:flex; flex-direction:column; align-items:center; gap:14px; }
  /* 390x844 viewport scaled to 0.8 */
  .phone { width:312px; height:675px; border-radius:38px; overflow:hidden; background:#000; box-shadow:0 0 0 7px #0c0c0c, 0 0 0 8px #3a3a3a, 0 24px 48px -18px rgba(0,0,0,.45); }
  .phone iframe { width:390px; height:844px; border:0; transform:scale(.8); transform-origin:0 0; display:block; background:#fff; }
  .pick { all:unset; cursor:pointer; box-sizing:border-box; width:312px; display:grid; grid-template-columns:auto 1fr auto; gap:12px; align-items:start; padding:12px 14px; border-radius:14px; background:var(--tile); border:2px solid var(--line); }
  .pick:focus-visible { outline:3px solid var(--on); outline-offset:2px; }
  .num { font-variant-numeric:tabular-nums; font-weight:700; color:var(--mute); padding-top:1px; }
  .meta { display:flex; flex-direction:column; gap:3px; min-width:0; }
  .why { color:var(--mute); font-size:13px; }
  .fonts { font-size:12px; color:var(--mute); }
  .sws { display:flex; gap:4px; margin-top:4px; }
  .sw { width:18px; height:18px; border-radius:50%; border:1px solid rgba(128,128,128,.4); }
  .check { width:24px; height:24px; border-radius:50%; border:2px solid var(--line); display:grid; place-items:center; color:transparent; font-size:14px; font-weight:700; }
  .tile.on .pick { border-color:var(--on); }
  .tile.on .check { background:var(--on); border-color:var(--on); color:#fff; }
</style>
</head>
<body>
<header>
  <h1>${text(title)}</h1>
  <p>${text(subtitle)}</p>
</header>
<main class="grid">
${tiles}
</main>
</body>
</html>
`
writeFileSync(out, page)
console.log(`wrote ${out} (${(page.length / 1024).toFixed(0)} KB)`)
