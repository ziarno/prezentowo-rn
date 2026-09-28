# PROTOTYPE — throwaway (issue #66). Writes draft in-house presents p21–p40 as
# SVG into ./presents/, then exports each to a transparent 600 px PNG with
# headless Chrome, the same render path the app would bundle.
#   python3 gen_presents.py
import math, os, subprocess, pathlib

HERE = pathlib.Path(__file__).parent
OUT = HERE / "presents"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def star(cx, cy, r, rot=0, inner=0.45):
    pts = []
    for i in range(10):
        a = math.radians(rot - 90 + i * 36)
        rr = r if i % 2 == 0 else r * inner
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

# p27 — red tube with yellow spiral bands, blue ribbon
tube = "M220 200 L380 200 L380 540 A80 20 0 0 1 220 540Z"
bands = "".join(f'<rect x="{x}" y="-200" width="26" height="1000" transform="rotate(-62 300 370)"/>' for x in range(-400, 1000, 64))
P["p27"] = svg(
    f'<defs><clipPath id="c"><path d="{tube}"/></clipPath></defs>'
    f'<path d="{tube}" fill="#e0252b"/><g clip-path="url(#c)" fill="#ffc61a">{bands}</g>'
    '<ellipse cx="300" cy="200" rx="80" ry="20" fill="#f25a4d"/>'
    '<path d="M288 184 L312 184 L312 559 L288 559Z" fill="#2c6cd4"/>'
    + bow(300, 190, "#2c6cd4", .9), 1.15, 300, 325, 3)

# p28 — flat wide sky-blue plaid box, lime cross ribbon
body = "M90 330 L510 322 L514 500 L86 508Z"
plaid = ("".join(f'<rect x="{x}" y="0" width="30" height="600" fill="#fff" opacity=".2"/>' for x in range(100, 520, 80))
         + "".join(f'<rect x="0" y="{y}" width="600" height="22" fill="#fff" opacity=".2"/>' for y in (350, 440))
         + "".join(f'<rect x="{x}" y="0" width="4" height="600" fill="#1d4f8f" opacity=".35"/>' for x in range(140, 520, 80)))
P["p28"] = svg(
    f'<defs><clipPath id="c"><path d="{body}"/></clipPath></defs>'
    f'<path d="{body}" fill="#3fa9e8"/><g clip-path="url(#c)">{plaid}'
    '<rect x="0" y="398" width="600" height="32" fill="#9ccb38"/></g>'
    '<path d="M78 296 L522 288 L524 340 L76 348Z" fill="#2585c9"/>'
    '<path d="M282 292 L322 291 L324 504 L280 506Z" fill="#9ccb38"/>'
    + bow(302, 290, "#9ccb38", 1.3, 15), 1.25, 300, 340, 2)

# p29 — orange cube in three-quarter view, purple ribbon over the faces
P["p29"] = svg(
    '<polygon points="180,230 290,285 290,530 180,470" fill="#f47a1e"/>'
    '<polygon points="290,285 440,240 440,480 290,530" fill="#d85f0e"/>'
    '<polygon points="180,230 330,190 440,240 290,285" fill="#ffa24a"/>'
    '<polygon points="224.3,252.1 245.7,262.9 245.7,505.4 224.3,494.6" fill="#8a4bb0"/>'
    '<polygon points="353.5,265.9 376.5,259.1 376.5,501.6 353.5,508.4" fill="#6a338e"/>'
    '<path d="M235 257.5 L385 215 M365 262.5 L255 210" stroke="#a570c9" stroke-width="24"/>'
    + bow(310, 237, "#8a4bb0", .9), 1.3, 310, 345)

# p30 — chubby star-shaped box, yellow, red ribbon and a middle bow
P["p30"] = svg(
    f'<defs><clipPath id="c">{star(300, 350, 240, 0, .56)}</clipPath></defs>'
    f'<g fill="#ffc61a">{star(300, 350, 240, 0, .56)}</g>{sheen("c", 60, 20, .22)}'
    '<g clip-path="url(#c)"><rect x="285" y="0" width="32" height="600" fill="#e2261c"/></g>'
    + bow(301, 330, "#e2261c", 1.0), 1.12, 300, 330, -6)

# p31 — tall slim magenta box with an argyle pattern, teal ribbon
body = "M235 170 L380 180 L372 560 L228 555Z"
arg = "".join(f'<polygon points="{x},{y - 35} {x + 25},{y} {x},{y + 35} {x - 25},{y}"/>'
              for y in range(170, 600, 70) for x in range(210 + (25 if (y // 70) % 2 else 0), 420, 50))
P["p31"] = svg(
    f'<defs><clipPath id="c"><path d="{body}"/></clipPath></defs>'
    f'<path d="{body}" fill="#d6206f"/><g clip-path="url(#c)" fill="#ec4f90">{arg}</g>'
    '<path d="M222 150 L392 160 L392 205 L220 196Z" fill="#a8134f"/>'
    '<path d="M294 154 L324 156 L320 558 L292 557Z" fill="#16a89a"/>'
    + bow(308, 155, "#16a89a", .95), 1.08, 305, 315, 5)

# p32 — teal striped gift bag, yellow and pink tissue, pink handles
bag = "M180 262 L420 262 L440 560 L160 560Z"
stripes = "".join(f'<rect x="0" y="{y}" width="600" height="22"/>' for y in (330, 390, 450, 510))
P["p32"] = svg(
    f'<defs><clipPath id="c"><path d="{bag}"/></clipPath></defs>'
    '<path d="M205 266 L245 140 L285 262Z" fill="#ffd21f"/>'
    '<path d="M270 266 L330 115 L360 262Z" fill="#ff8db2"/>'
    '<path d="M335 266 L380 165 L400 262Z" fill="#ffe066"/>'
    '<path d="M228 270 C220 176 296 174 290 270 M312 270 C306 176 382 176 374 270" fill="none" '
    'stroke="#ec2b6c" stroke-width="12" stroke-linecap="round"/>'
    f'<path d="{bag}" fill="#13a393"/><g clip-path="url(#c)" fill="#45c9b6">{stripes}</g>'
    '<path d="M180 262 L420 262 L423 300 L177 300Z" fill="#0b7a6d"/>'
    '<circle cx="228" cy="282" r="8" fill="#ec2b6c"/><circle cx="290" cy="282" r="8" fill="#ec2b6c"/>'
    '<circle cx="312" cy="282" r="8" fill="#ec2b6c"/><circle cx="374" cy="282" r="8" fill="#ec2b6c"/>',
    1.18, 300, 335, 3)

# p33 — lime box widening to the bottom, pink waves, purple ribbon
body = "M210 230 L390 236 L470 555 L130 552Z"
waves = "".join(f'<path d="M80 {y} ' + "q25 -22 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0"
                + '" fill="none" stroke="#ee3f7a" stroke-width="12"/>' for y in (300, 370, 440, 510))
P["p33"] = svg(
    f'<defs><clipPath id="c"><path d="{body}"/></clipPath></defs>'
    f'<path d="{body}" fill="#8cc63f"/><g clip-path="url(#c)">{waves}</g>'
    '<path d="M286 232 L316 233 L322 555 L280 555Z" fill="#7b3fa0"/>'
    + bow(301, 230, "#7b3fa0", 1.0), 1.2, 300, 340, -2)

# p34 — pyramid of three small boxes
P["p34"] = svg(
    '<defs><clipPath id="a"><polygon points="110,380 290,376 292,560 108,562"/></clipPath>'
    '<clipPath id="b"><polygon points="310,376 490,380 492,562 308,560"/></clipPath>'
    '<clipPath id="t"><polygon points="210,205 390,200 392,374 208,378"/></clipPath></defs>'
    '<polygon points="110,380 290,376 292,560 108,562" fill="#e2261c"/>' + sheen("a", 56, 18, .18)
    + '<g clip-path="url(#a)"><rect x="186" y="0" width="28" height="600" fill="#ffc61a"/></g>'
    '<polygon points="310,376 490,380 492,562 308,560" fill="#2c6cd4"/>' + sheen("b", 56, 18, .18)
    + '<g clip-path="url(#b)"><rect x="386" y="0" width="28" height="600" fill="#ff8db2"/></g>'
    '<polygon points="210,205 390,200 392,374 208,378" fill="#ffc61a"/>' + sheen("t", 56, 18, .22)
    + '<g clip-path="url(#t)"><rect x="286" y="0" width="28" height="600" fill="#13a393"/></g>'
    + bow(300, 202, "#13a393", .85), 1.15, 300, 330, 2)

# p35 — round pouch gathered at the top, pink with white dots
pouch = "M300 250 C150 250 110 400 160 480 C200 550 400 550 440 480 C490 400 450 250 300 250Z"
dots = "".join(f'<circle cx="{x + (26 if (y // 52) % 2 else 0)}" cy="{y}" r="9"/>'
               for y in range(270, 560, 52) for x in range(120, 500, 52))
P["p35"] = svg(
    f'<defs><clipPath id="c"><path d="{pouch}"/></clipPath></defs>'
    '<path d="M300 256 L212 150 Q256 176 272 140 Q300 170 328 140 Q344 176 388 150Z" fill="#ff7aa8"/>'
    f'<path d="{pouch}" fill="#ee3f7a"/><g clip-path="url(#c)" fill="#fff" opacity=".35">{dots}</g>'
    + bow(300, 250, "#ffc61a", .9), 1.18, 300, 340, -3)

# p36 — candy-wrapped gift with twisted ends
P["p36"] = svg(
    '<defs><clipPath id="c"><rect x="180" y="250" width="240" height="140" rx="56"/></clipPath></defs>'
    '<path d="M185 320 L90 236 Q112 320 90 404Z" fill="#ffc61a"/>'
    '<path d="M415 320 L510 236 Q488 320 510 404Z" fill="#ffc61a"/>'
    '<rect x="180" y="250" width="240" height="140" rx="56" fill="#16a89a"/>'
    + sheen("c", 52, 22, .35)
    + '<rect x="168" y="288" width="22" height="64" rx="8" fill="#f4a100"/>'
    '<rect x="410" y="288" width="22" height="64" rx="8" fill="#f4a100"/>',
    1.25, 300, 320, -12)

# p37 — yellow box with blue triangles, off-centre red ribbon, side bow
body = "M130 250 L470 244 L476 540 L124 548Z"
tri = "".join((f'<polygon points="{x},{y + 34} {x + 20},{y} {x + 40},{y + 34}"/>' if ((x // 60) + (y // 60)) % 2 == 0 else
               f'<polygon points="{x},{y} {x + 20},{y + 34} {x + 40},{y}"/>')
              for y in range(260, 560, 60) for x in range(110, 500, 60))
P["p37"] = svg(
    f'<defs><clipPath id="c"><path d="{body}"/></clipPath></defs>'
    f'<path d="{body}" fill="#ffc61a"/><g clip-path="url(#c)"><g fill="#2c6cd4">{tri}</g>'
    '<rect x="0" y="380" width="600" height="34" fill="#e2261c"/><rect x="378" y="0" width="32" height="600" fill="#e2261c"/></g>'
    '<path d="M116 220 L484 214 L486 268 L114 274Z" fill="#f4a100"/>'
    '<path d="M378 216 L410 215 L410 268 L378 269Z" fill="#e2261c"/>'
    + bow(394, 216, "#e2261c", .9), 1.2, 300, 340, -2)

# p38 — wrapped bottle, purple with a gathered neck
bottle = "M250 560 L350 560 Q380 560 380 520 L380 330 Q380 280 330 250 L325 170 L275 170 L270 250 Q220 280 220 330 L220 520 Q220 560 250 560Z"
P["p38"] = svg(
    f'<defs><clipPath id="c"><path d="{bottle}"/></clipPath></defs>'
    '<path d="M275 176 L244 118 L285 136 L300 100 L315 136 L356 118 L325 176Z" fill="#b684d6"/>'
    f'<path d="{bottle}" fill="#8a4bb0"/>'
    '<g clip-path="url(#c)" fill="#a570c9">' + "".join(
        f'<rect x="{x}" y="-200" width="18" height="1000" transform="rotate(28 300 360)"/>' for x in range(0, 700, 48)) + '</g>'
    + heart(300, 420, 34).replace('"/>', '" fill="#ffc61a"/>')
    + '<rect x="268" y="188" width="64" height="20" rx="4" fill="#9ccb38"/>'
    + bow(300, 196, "#9ccb38", .8, 11), 1.2, 300, 333, 4)

# p39 — sky-blue box, yellow dots, red diagonal cross, bow in the middle
body = "M150 200 L450 212 L440 540 L160 530Z"
dots = "".join(f'<circle cx="{x + (30 if (y // 60) % 2 else 0)}" cy="{y}" r="12"/>'
               for y in range(210, 560, 60) for x in range(140, 480, 60))
P["p39"] = svg(
    f'<defs><clipPath id="c"><path d="{body}"/></clipPath></defs>'
    f'<path d="{body}" fill="#4fc3f7"/><g clip-path="url(#c)"><g fill="#ffd21f">{dots}</g>'
    '<path d="M150 200 L440 540 M450 212 L160 530" stroke="#e2261c" stroke-width="28"/></g>'
    + bow(300, 368, "#e2261c", 1.0), 1.4, 300, 370, -4)

# p40 — red box with a paper gift tag on a string
body = "M160 260 L440 252 L446 540 L154 548Z"
P["p40"] = svg(
    f'<defs><clipPath id="c"><path d="{body}"/></clipPath></defs>'
    f'<path d="{body}" fill="#d62718"/>{sheen("c", 70, 26, .16)}'
    '<path d="M146 230 L454 222 L456 280 L144 288Z" fill="#a8150f"/>'
    '<path d="M285 226 L320 225 L322 544 L283 545Z" fill="#ffc61a"/>'
    '<path d="M302 226 C380 232 420 276 440 312" fill="none" stroke="#6b4a1f" stroke-width="4"/>'
    '<path d="M430 305 L500 315 L495 395 L425 385Z" fill="#fff3d6"/>'
    '<circle cx="461" cy="324" r="6" fill="#d62718"/>'
    + heart(460, 360, 14).replace('"/>', '" fill="#d62718"/>')
    + bow(302, 226, "#ffc61a", 1.0), 1.2, 320, 330, -2)

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
