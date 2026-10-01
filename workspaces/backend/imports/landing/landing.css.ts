// Inlined into the server-rendered <head>, so the page is styled before (and
// without) the client bundle. Colours are the mobile app's tokens.
export const LANDING_CSS = `
@font-face {
  font-family: Foglihten;
  src: url(/fonts/FoglihtenNo07.ttf) format('truetype');
  font-display: swap;
}
:root {
  --paper: #fffaf2; --paper2: #f5ede0; --ink: #1d1a14;
  --ink60: rgba(29,26,20,.6); --ink15: rgba(29,26,20,.15);
  --ink08: rgba(29,26,20,.08); --green: #2f5b3a;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--paper); }
body {
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-text-size-adjust: 100%;
}
p { margin: 0; }
a { color: var(--green); }
.display { font-family: Foglihten, Georgia, serif; font-weight: normal; }
.muted { color: var(--ink60); }
.landing {
  min-height: 100vh; padding: 28px 20px 40px;
  display: flex; flex-direction: column; align-items: center;
}
.top {
  width: 100%; max-width: 1040px;
  display: flex; justify-content: space-between; align-items: center;
}
.brand { display: flex; align-items: center; gap: 8px; }
.brand img { width: 28px; height: 28px; border-radius: 7px; }
.brand span { font-family: Foglihten, Georgia, serif; font-size: 22px; }
.langs { font-size: 12px; color: var(--ink60); }
.langs a { color: var(--ink60); text-decoration: none; }
.langs a.on { color: var(--ink); font-weight: 600; }
.garland { display: block; width: 100%; height: 44px; }
.card {
  margin-top: 26px; width: 100%; max-width: 440px; padding: 0 26px 28px;
  background: #fff; border: 1px solid var(--ink08); border-radius: 18px;
  box-shadow: 0 10px 30px rgba(29,26,20,.08); text-align: center;
}
.card .garland { margin: 0 -26px; width: calc(100% + 52px); }
.eyebrow { margin-top: 14px; font-size: 15px; }
.card h1 {
  margin: 10px 0 12px; color: var(--green);
  font-size: 46px; line-height: 1.05; overflow-wrap: anywhere;
}
.chip {
  display: inline-block; padding: 3px 10px; border-radius: 12px;
  background: var(--paper2); font-size: 12px;
}
.rule { height: 1px; margin: 22px 0; background: var(--ink08); }
.getapp { margin-bottom: 12px; font-weight: 600; }
.stores { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.store {
  display: flex; align-items: center; gap: 8px; min-width: 150px;
  padding: 9px 14px; border: 1.5px solid var(--ink); border-radius: 10px;
  background: var(--ink); color: var(--paper); text-decoration: none;
  text-align: left;
}
.store.secondary { background: transparent; color: var(--ink); border-color: var(--ink15); }
.store .glyph { display: flex; width: 24px; }
.store svg { width: 22px; height: 22px; }
.store small { display: block; font-size: 10px; opacity: .75; }
.store b { display: block; font-size: 16px; font-weight: 600; }
.after { margin-top: 14px; font-size: 13px; }
.what { max-width: 440px; margin-top: 22px; font-size: 13px; line-height: 1.5; text-align: center; }
.openapp { margin-top: 14px; font-size: 13px; }
.invalid { max-width: 440px; text-align: center; }
.invalid .glyph-big { margin: 60px 0 6px; font-size: 54px; }
.invalid h1 { margin: 6px 0 10px; font-size: 38px; }
.invalid p { margin: 0 auto 10px; max-width: 360px; line-height: 1.5; }
.invalid .badsub { margin-top: 26px; margin-bottom: 12px; }
`
