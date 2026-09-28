# PROTOTYPE — throwaway (issue #66). Writes draft in-house presents p21–p26 as
# SVG into ./presents/, then exports each to a transparent 600 px PNG with
# headless Chrome, the same render path the app would bundle.
#   python3 gen_presents.py
import math, os, subprocess, pathlib

HERE = pathlib.Path(__file__).parent
OUT = HERE / "presents"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def star(cx, cy, r, rot=0):
    pts = []
    for i in range(10):
        a = math.radians(rot - 90 + i * 36)
        rr = r if i % 2 == 0 else r * 0.45
        pts.append(f"{cx + rr * math.cos(a):.1f},{cy + rr * math.sin(a):.1f}")
    return f'<polygon points="{" ".join(pts)}"/>'


def heart(cx, cy, s):
    return (f'<path d="M{cx} {cy + s * .9} C{cx - s * 1.4} {cy} {cx - s * .9} {cy - s * .9} {cx} {cy - s * .3} '
            f'C{cx + s * .9} {cy - s * .9} {cx + s * 1.4} {cy} {cx} {cy + s * .9}Z"/>')


def sheen(clip, step=70, w=26, op=.14):
    # lighter diagonal bands, like p1/p12/p16
    bands = "".join(
        f'<rect x="{x}" y="-200" width="{w}" height="1000" transform="rotate(28 300 300)"/>'
        for x in range(-300, 900, step))
    return f'<g clip-path="url(#{clip})" fill="#fff" opacity="{op}">{bands}</g>'


def bow(cx, cy, col, spread=1.0, sw=13, tails=True, h=1.0):
    s = spread
    loops = (
        f'M{cx} {cy} C{cx - 40 * s} {cy - 125 * h} {cx - 140 * s} {cy - 95 * h} {cx - 92 * s} {cy - 18} '
        f'C{cx - 62 * s} {cy + 10} {cx - 22 * s} {cy + 4} {cx} {cy} '
        f'M{cx} {cy} C{cx + 40 * s} {cy - 125 * h} {cx + 140 * s} {cy - 95 * h} {cx + 92 * s} {cy - 18} '
        f'C{cx + 62 * s} {cy + 10} {cx + 22 * s} {cy + 4} {cx} {cy}')
    t = ""
    if tails:
        t = (f'M{cx - 6} {cy + 4} C{cx - 50 * s} {cy + 30} {cx - 105 * s} {cy + 6} {cx - 118 * s} {cy + 34} '
             f'c-6 16 14 24 22 10 '
             f'M{cx + 6} {cy + 4} C{cx + 50 * s} {cy + 30} {cx + 105 * s} {cy + 6} {cx + 118 * s} {cy + 34} '
             f'c6 16 -14 24 -22 10')
    return (f'<path d="{loops} {t}" fill="none" stroke="{col}" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{sw * 1.3:.0f}" fill="{col}"/>')


def svg(body, k=1.0, cx=300, cy=300, rot=0):
    # scale the drawing about its own centre so it fills the frame like p1–p20
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">'
            f'<g transform="translate(300 300) rotate({rot}) scale({k}) translate({-cx} {-cy})">' + body + '</g></svg>')


P = {}

# p21 — tall wonky teal box, zigzags, hot-pink ribbon
body = "M190 236 L418 220 Q426 390 412 560 L202 556 Q184 400 190 236Z"
zig = "".join(
    f'<path d="M160 {y} ' + " ".join(f"l30 {-24 if i % 2 == 0 else 24}" for i in range(10))
    + '" fill="none" stroke="#45c9b6" stroke-width="15" stroke-linejoin="round"/>'
    for y in (310, 380, 450, 520))
P["p21"] = svg(
    f'<defs><clipPath id="c"><path d="{body}"/></clipPath></defs>'
    f'<path d="{body}" fill="#12a291"/><g clip-path="url(#c)">{zig}</g>'
    '<path d="M174 200 L432 184 L438 246 L180 260Z" fill="#0b7a6d"/>'
    '<path d="M288 194 L324 192 L320 558 L296 558Z" fill="#ec2b6c"/>'
    + bow(306, 188, "#ec2b6c", 1.0), 1.22, 306, 322, -3)

# p22 — wide low yellow box, orange dots, blue ribbon, big bow
body = "M112 336 L494 326 L502 522 L104 530Z"
dots = "".join(f'<circle cx="{x + (35 if (y // 60) % 2 else 0)}" cy="{y}" r="15"/>'
               for y in range(360, 540, 60) for x in range(90, 540, 70))
P["p22"] = svg(
    f'<defs><clipPath id="c"><path d="{body}"/></clipPath></defs>'
    f'<path d="{body}" fill="#ffbe17"/><g clip-path="url(#c)" fill="#f2862a">{dots}</g>'
    '<path d="M94 292 L512 282 L516 348 L90 358Z" fill="#f4a100"/>'
    '<path d="M284 286 L326 285 L328 526 L282 528Z" fill="#2c6cd4"/>'
    + bow(305, 280, "#2c6cd4", 1.35, 15), 1.3, 303, 350, 2)

# p23 — purple hat box, lime ribbon
P["p23"] = svg(
    '<defs><clipPath id="c"><path d="M172 300 L428 300 L428 522 A128 34 0 0 1 172 522Z"/></clipPath></defs>'
    '<path d="M172 300 L428 300 L428 522 A128 34 0 0 1 172 522Z" fill="#8a4bb0"/>'
    '<g clip-path="url(#c)"><rect x="196" y="280" width="38" height="320" fill="#a570c9"/>'
    '<rect x="252" y="280" width="12" height="320" fill="#a570c9"/></g>'
    '<path d="M156 284 L444 284 L444 326 A144 36 0 0 1 156 326Z" fill="#6a338e"/>'
    '<ellipse cx="300" cy="284" rx="144" ry="36" fill="#b684d6"/>'
    '<path d="M285 249 L315 249 L315 555 L285 555Z" fill="#9ccb38"/>'
    '<path d="M285 249 L315 249 L315 320 L285 320Z" fill="#b6e05a"/>'
    + bow(300, 262, "#9ccb38", 1.05), 1.36, 300, 352)

# p24 — tapered navy box, yellow stars, red cross ribbon
body = "M148 232 L452 240 L406 556 L196 550Z"
stars = "".join(star(x, y, r, rot) for x, y, r, rot in [
    (200, 280, 22, 10), (268, 330, 14, -8), (380, 290, 20, 20), (420, 350, 12, 0), (230, 430, 18, 25),
    (360, 450, 22, -15), (300, 510, 13, 5), (170, 340, 11, 0), (330, 380, 10, 30), (250, 520, 11, 12)])
P["p24"] = svg(
    f'<defs><clipPath id="c"><path d="{body}"/></clipPath></defs>'
    f'<path d="{body}" fill="#233f80"/><g clip-path="url(#c)" fill="#ffc92b">{stars}'
    '<rect x="0" y="372" width="600" height="34" fill="#e2261c"/></g>'
    '<path d="M136 206 L464 214 L462 262 L138 256Z" fill="#162c60"/>'
    '<path d="M284 208 L318 209 L314 553 L290 552Z" fill="#e2261c"/>'
    + bow(301, 204, "#e2261c", 1.15), 1.25, 300, 325, 4)

# p25 — two stacked boxes: lime below, pink above
lo = "M128 362 L472 356 L476 562 L124 564Z"
hi = "M218 206 L386 214 L380 334 L224 332Z"
P["p25"] = svg(
    f'<defs><clipPath id="a"><path d="{lo}"/></clipPath><clipPath id="b"><path d="{hi}"/></clipPath></defs>'
    f'<path d="{lo}" fill="#86c33c"/>{sheen("a", 64, 22, .2)}'
    '<path d="M114 330 L486 324 L488 378 L112 384Z" fill="#65a12a"/>'
    '<path d="M282 327 L322 326 L324 563 L280 564Z" fill="#ee3f7a"/>'
    f'<path d="{hi}" fill="#ee3f7a"/>' + "".join(
        heart(x, y, 11) .replace('"/>', '" fill="#ff8db2"/>') for x, y in
        [(250, 250), (300, 290), (350, 250), (262, 316), (345, 312)])
    + '<path d="M206 182 L398 190 L400 226 L204 220Z" fill="#c8205a"/>'
    '<path d="M290 186 L318 187 L316 334 L292 333Z" fill="#ffc61a"/>'
    + bow(304, 180, "#ffc61a", .8, 12), 1.18, 300, 318, -2)

# p26 — orange gift bag with tissue paper and rope handles
bag = "M172 262 L428 262 L456 560 L144 560Z"
dots = "".join(f'<circle cx="{x + (30 if (y // 55) % 2 else 0)}" cy="{y}" r="9"/>'
               for y in range(330, 560, 55) for x in range(150, 470, 60))
P["p26"] = svg(
    f'<defs><clipPath id="c"><path d="{bag}"/></clipPath></defs>'
    '<path d="M198 266 L236 132 L272 262Z" fill="#1aae9e"/>'
    '<path d="M244 268 L312 92 L346 262Z" fill="#ffd21f"/>'
    '<path d="M318 266 L378 146 L402 262Z" fill="#4fd0c0"/>'
    '<path d="M226 270 C218 170 300 168 294 270 M306 270 C300 170 382 170 374 270" fill="none" '
    'stroke="#233f80" stroke-width="12" stroke-linecap="round"/>'
    f'<path d="{bag}" fill="#f4761e"/><g clip-path="url(#c)" fill="#ff9e4f">{dots}</g>'
    '<path d="M172 262 L428 262 L432 304 L168 304Z" fill="#d85f0e"/>'
    '<circle cx="226" cy="284" r="8" fill="#233f80"/><circle cx="294" cy="284" r="8" fill="#233f80"/>'
    '<circle cx="306" cy="284" r="8" fill="#233f80"/><circle cx="374" cy="284" r="8" fill="#233f80"/>'
    + heart(300, 430, 42).replace('"/>', '" fill="#ec2b6c"/>'), 1.19, 300, 326, -4)

OUT.mkdir(exist_ok=True)
for name, s in P.items():
    src = OUT / f"{name}.svg"
    src.write_text(s)
    png = OUT / f"{name}-600px.png"
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--default-background-color=00000000", "--window-size=600,600",
                    f"--screenshot={png}", src.resolve().as_uri()],
                   check=True, capture_output=True)
    print(png)
