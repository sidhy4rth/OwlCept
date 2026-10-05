// OwlCept logo: the owl draws a sniper rifle from behind his back, scopes in on a
// ">_" command prompt and shoots it. One 6-second CSS loop inside a plain SVG, so it
// plays anywhere an <img> does (GitHub READMEs included) and holds the aim pose
// when the viewer prefers reduced motion.
//
//   node scripts/logo.mjs            → SVGs (logo, banner, light + dark) and the static mark
//   node scripts/logo.mjs --render   → also MP4 + GIF of the loop, and the icon PNGs
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url).pathname;
const assets = `${root}docs/assets/`;
mkdirSync(assets, { recursive: true });

const PALETTES = {
  light: {
    body: '#312E81', belly: '#4338CA', disc: '#4F46E5', marks: '#818CF8', wing: '#1E1B4B', brow: '#1E1B4B',
    gun: '#1F2937', gunHi: '#4B5563', gunLo: '#111827', ink: '#0F172A', muted: '#475569',
    term: '#0F172A', shadow: 'rgba(15,23,42,.14)', smoke: '#94A3B8',
  },
  dark: {
    body: '#4338CA', belly: '#4F46E5', disc: '#6366F1', marks: '#A5B4FC', wing: '#312E81', brow: '#1E1B4B',
    gun: '#475569', gunHi: '#94A3B8', gunLo: '#334155', ink: '#F8FAFC', muted: '#94A3B8',
    term: '#1E293B', shadow: 'rgba(0,0,0,.35)', smoke: '#CBD5E1',
  },
};
const AMBER = '#F59E0B';
const AMBER_DK = '#D97706';
const RED = '#EF4444';

// Rifle drawn pointing right with the pistol grip at the origin; every pose rotates about it.
const rifle = (c) => `
  <g id="rifle">
    <path d="M-48 -6 L-6 -9 L-2 5 L-40 15 L-50 12 Z" fill="${c.gun}"/>
    <rect x="-54" y="-8" width="7" height="23" rx="2" fill="${c.gunLo}"/>
    <path d="M-40 -2 L-14 -4" stroke="${c.gunHi}" stroke-width="2" stroke-linecap="round"/>
    <rect x="-8" y="-10" width="56" height="14" rx="3" fill="${c.gun}"/>
    <rect x="-2" y="-8" width="20" height="3" rx="1.5" fill="${c.gunHi}"/>
    <path d="M2 4 L7 21 L16 21 L13 4 Z" fill="${c.gunLo}"/>
    <path d="M17 4 Q19 13 27 5" fill="none" stroke="${c.gunLo}" stroke-width="2.5"/>
    <rect x="28" y="3" width="10" height="15" rx="2" fill="${c.gunLo}"/>
    <rect x="46" y="-7" width="98" height="5" rx="1.5" fill="${c.gun}"/>
    <rect x="58" y="-2" width="30" height="5" rx="2" fill="${c.gunLo}"/>
    <rect x="140" y="-9" width="14" height="9" rx="2" fill="${c.gunLo}"/>
    <rect x="7" y="-15" width="5" height="7" fill="${c.gunLo}"/>
    <rect x="34" y="-15" width="5" height="7" fill="${c.gunLo}"/>
    <rect x="-3" y="-24" width="48" height="10" rx="5" fill="${c.gunLo}"/>
    <path d="M42 -24 L54 -27 L54 -11 L42 -14 Z" fill="${c.gunLo}"/>
    <rect x="2" y="-22" width="30" height="2.5" rx="1.25" fill="${c.gunHi}"/>
    <ellipse cx="54" cy="-19" rx="2.6" ry="7.5" fill="${AMBER}"/>
    <rect x="-8" y="-23" width="6" height="8" rx="1.5" fill="${c.gun}"/>
  </g>`;

// Rifle poses: [translateX, translateY, rotateDeg]. The back copy is drawn behind the body,
// the front copy in front; they swap while the rifle is clear of the silhouette.
const HIDDEN = [190, 282, -96];
const SHOULDER = [280, 118, -38];
const AIM = [258, 212, 0];
const pose = ([x, y, r]) => `translate(${x}px,${y}px) rotate(${r}deg)`;

const css = (c) => `
  .anim *{transform-box:view-box}
  .rifle-back{animation:rifle 6s infinite,back 6s infinite step-end}
  .rifle-front{animation:rifle 6s infinite,front 6s infinite step-end}
  .rifle-back,.rifle-front{transform:${pose(AIM)}}
  .rifle-back{opacity:0}
  @keyframes rifle{
    0%,9%{transform:${pose(HIDDEN)};animation-timing-function:cubic-bezier(.3,0,.4,1)}
    15%{transform:${pose(SHOULDER)};animation-timing-function:cubic-bezier(.2,.7,.3,1)}
    21%{transform:translate(260px,206px) rotate(3deg)}
    25%,41.6%{transform:${pose(AIM)};animation-timing-function:cubic-bezier(.1,.9,.2,1)}
    42.4%{transform:translate(244px,208px) rotate(-8deg);animation-timing-function:ease-out}
    48%,68%{transform:${pose(AIM)};animation-timing-function:cubic-bezier(.5,0,.6,1)}
    76%{transform:${pose(SHOULDER)};animation-timing-function:cubic-bezier(.4,0,.7,1)}
    84%,100%{transform:${pose(HIDDEN)}}
  }
  @keyframes back{0%{opacity:1}15%{opacity:0}76%{opacity:1}}
  @keyframes front{0%{opacity:0}15%{opacity:1}76%{opacity:0}}

  .wing-r{transform:translate(244px,188px) rotate(-64deg);animation:wing 6s infinite}
  @keyframes wing{
    0%,4%{transform:translate(244px,188px) rotate(0deg);animation-timing-function:cubic-bezier(.4,0,.2,1)}
    9%{transform:translate(244px,188px) rotate(-176deg);animation-timing-function:cubic-bezier(.3,0,.4,1)}
    15%{transform:translate(244px,188px) rotate(-150deg);animation-timing-function:cubic-bezier(.2,.7,.3,1)}
    24%,68%{transform:translate(244px,188px) rotate(-64deg);animation-timing-function:cubic-bezier(.5,0,.6,1)}
    76%{transform:translate(244px,188px) rotate(-150deg);animation-timing-function:cubic-bezier(.4,0,.7,1)}
    81%{transform:translate(244px,188px) rotate(-176deg);animation-timing-function:cubic-bezier(.4,0,.2,1)}
    87%,100%{transform:translate(244px,188px) rotate(0deg)}
  }
  .wing-l{transform-origin:98px 196px;animation:flap 6s infinite}
  @keyframes flap{0%,8%,24%,70%,100%{transform:rotate(0)}14%,78%{transform:rotate(9deg)}}

  .head{transform-origin:170px 200px;transform:rotate(7deg) translate(4px,2px);animation:head 6s infinite}
  @keyframes head{
    0%,24%{transform:none;animation-timing-function:ease-in-out}
    30%,41.6%{transform:rotate(7deg) translate(4px,2px)}
    42.4%{transform:rotate(3deg) translate(-3px,0)}
    48%,62%{transform:rotate(7deg) translate(4px,2px);animation-timing-function:ease-in-out}
    68%,100%{transform:none}
  }
  .eye-l{transform-origin:136px 172px;transform:scaleY(.12);animation:squint 6s infinite}
  @keyframes squint{0%,3.4%,5.6%,26%{transform:none}4.4%{transform:scaleY(.08)}30%,62%{transform:scaleY(.12)}66%,88%,90%,100%{transform:none}89%{transform:scaleY(.08)}}
  .eye-r{transform-origin:204px 172px;animation:blink 6s infinite}
  @keyframes blink{0%,3.4%,5.6%,88%,90%,100%{transform:none}4.4%,89%{transform:scaleY(.08)}}
  .pupil-r{transform-origin:204px 172px;transform:scale(.72);animation:focus 6s infinite}
  @keyframes focus{0%,26%,66%,100%{transform:none}32%,60%{transform:scale(.72)}}
  .brow-l{transform-origin:130px 143px;transform:rotate(8deg) translateY(6px);animation:brow 6s infinite}
  @keyframes brow{0%,26%,66%,100%{transform:none}30%,62%{transform:rotate(8deg) translateY(6px)}}

  .glint{transform-origin:312px 193px;opacity:0;animation:glint 6s infinite}
  @keyframes glint{0%,27%,37%,100%{opacity:0;transform:scale(.2) rotate(0)}31%{opacity:1;transform:scale(1) rotate(45deg)}}

  .reticle{transform:translate(500px,206px);animation:reticle 6s infinite}
  @keyframes reticle{
    0%,25%{opacity:0;transform:translate(500px,206px) scale(3) rotate(-90deg)}
    35%,41.6%{opacity:1;transform:translate(500px,206px) scale(1) rotate(0deg)}
    43%{opacity:1;transform:translate(500px,206px) scale(1.18)}
    54%,100%{opacity:0;transform:translate(500px,206px) scale(1.5)}
  }

  .flash{opacity:0;transform:translate(414px,208px) scale(0);animation:flash 6s infinite}
  @keyframes flash{0%,41.6%{opacity:0;transform:translate(414px,208px) scale(0)}42%{opacity:1;transform:translate(414px,208px) scale(1)}44.5%,100%{opacity:0;transform:translate(414px,208px) scale(1.4)}}
  .bullet{opacity:0;animation:bullet 6s infinite linear}
  @keyframes bullet{0%,41.9%{opacity:0;transform:translate(418px,207px)}42%{opacity:1;transform:translate(418px,207px)}43.4%{opacity:1;transform:translate(474px,206px)}43.5%,100%{opacity:0;transform:translate(474px,206px)}}
  .casing{opacity:0;animation:casing 6s infinite}
  @keyframes casing{
    0%,42.2%{opacity:0;transform:translate(292px,200px)}
    42.4%{opacity:1;transform:translate(292px,200px) rotate(0)}
    47%{opacity:1;transform:translate(318px,150px) rotate(320deg);animation-timing-function:cubic-bezier(.5,0,1,1)}
    54%{opacity:1;transform:translate(338px,350px) rotate(760deg)}
    56%,100%{opacity:0;transform:translate(338px,350px) rotate(760deg)}
  }
  .smoke{opacity:0;animation:smoke 6s infinite ease-out}
  .smoke.s2{animation-delay:.12s}.smoke.s3{animation-delay:.24s}
  @keyframes smoke{0%,42.6%{opacity:0;transform:translate(414px,206px) scale(.3)}44%{opacity:.55}62%,100%{opacity:0;transform:translate(424px,166px) scale(1.6)}}

  .term-l,.term-r{animation-duration:6s;animation-iteration-count:infinite}
  .term-l{animation-name:shardL}.term-r{animation-name:shardR}
  @keyframes shardL{
    0%,43.4%{opacity:1;transform:none}
    52%,86%{opacity:0;transform:translate(-26px,54px) rotate(-38deg)}
    86.1%{opacity:0;transform:translate(0,-14px)}
    94%,100%{opacity:1;transform:none}
  }
  @keyframes shardR{
    0%,43.4%{opacity:1;transform:none}
    52%,86%{opacity:0;transform:translate(30px,60px) rotate(42deg)}
    86.1%{opacity:0;transform:translate(0,-14px)}
    94%,100%{opacity:1;transform:none}
  }
  .term-l{transform-origin:483px 206px}.term-r{transform-origin:517px 206px}
  .hitflash{opacity:0;animation:hitflash 6s infinite}
  @keyframes hitflash{0%,43.4%{opacity:0}43.6%{opacity:.9}46%,100%{opacity:0}}
  .ring{opacity:0;transform:translate(500px,206px) scale(.2);animation:ring 6s infinite ease-out}
  @keyframes ring{0%,43.4%{opacity:0;transform:translate(500px,206px) scale(.2)}43.6%{opacity:1}52%,100%{opacity:0;transform:translate(500px,206px) scale(1.7)}}

  @media (prefers-reduced-motion:reduce){.anim *{animation:none!important}}
`;

const terminal = (c) => `
  <g id="term">
    <rect x="466" y="180" width="68" height="52" rx="8" fill="${c.term}" stroke="${RED}" stroke-width="3"/>
    <path d="M466 192 H534" stroke="${RED}" stroke-width="2" opacity=".55"/>
    <circle cx="474" cy="186" r="2" fill="${RED}"/><circle cx="481" cy="186" r="2" fill="${RED}" opacity=".6"/>
    <path d="M478 202 l10 8 -10 8" fill="none" stroke="#F87171" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M494 219 h16" stroke="#F87171" stroke-width="4" stroke-linecap="round"/>
  </g>`;

// The owl and its scene, in a 560×400 box.
const scene = (c) => `
  <defs>
    ${rifle(c)}
    ${terminal(c)}
    <clipPath id="half-l"><path d="M440 160 H503 L497 206 L504 250 H440 Z"/></clipPath>
    <clipPath id="half-r"><path d="M503 160 H560 V250 H504 L497 206 Z"/></clipPath>
  </defs>
  <ellipse cx="170" cy="352" rx="78" ry="9" fill="${c.shadow}"/>

  <use href="#rifle" class="rifle-back"/>

  <g class="wing-l"><path d="M98 196 Q56 252 88 322 Q112 304 114 252 Z" fill="${c.wing}"/></g>
  <path d="M98 150 L84 82 L134 116 Q170 104 206 116 L256 82 L242 150 Q268 205 256 262 Q240 342 170 346 Q100 342 84 262 Q72 205 98 150 Z" fill="${c.body}"/>
  <ellipse cx="170" cy="284" rx="58" ry="56" fill="${c.belly}"/>
  <g fill="none" stroke="${c.marks}" stroke-width="3" stroke-linecap="round" opacity=".7">
    <path d="M146 262 q6 7 12 0"/><path d="M164 262 q6 7 12 0"/><path d="M182 262 q6 7 12 0"/>
    <path d="M137 284 q6 7 12 0"/><path d="M155 284 q6 7 12 0"/><path d="M173 284 q6 7 12 0"/><path d="M191 284 q6 7 12 0"/>
    <path d="M146 306 q6 7 12 0"/><path d="M164 306 q6 7 12 0"/><path d="M182 306 q6 7 12 0"/>
  </g>
  <g stroke="${AMBER}" stroke-width="4.5" stroke-linecap="round" fill="none">
    <path d="M150 343 l-7 11 M150 343 v12 M150 343 l7 11"/><path d="M190 343 l-7 11 M190 343 v12 M190 343 l7 11"/>
  </g>

  <g class="head">
    <circle cx="136" cy="172" r="39" fill="${c.disc}"/><circle cx="204" cy="172" r="39" fill="${c.disc}"/>
    <g class="eye-l">
      <circle cx="136" cy="172" r="27" fill="${AMBER}"/>
      <circle cx="136" cy="172" r="12.5" fill="#0F172A"/><circle cx="141" cy="167" r="4.5" fill="#fff"/>
    </g>
    <g class="eye-r">
      <circle cx="204" cy="172" r="27" fill="${AMBER}"/>
      <g class="pupil-r"><circle cx="204" cy="172" r="12.5" fill="#0F172A"/><circle cx="209" cy="167" r="4.5" fill="#fff"/></g>
    </g>
    <path class="brow-l" d="M100 134 L160 150" stroke="${c.brow}" stroke-width="10" stroke-linecap="round"/>
    <path d="M180 150 L240 134" stroke="${c.brow}" stroke-width="10" stroke-linecap="round"/>
    <path d="M158 194 H182 L170 216 Z" fill="${AMBER}"/><path d="M170 216 L182 194 H176 Z" fill="${AMBER_DK}"/>
  </g>

  <use href="#rifle" class="rifle-front"/>
  <g class="wing-r"><path d="M0 0 Q26 50 2 104 Q-20 90 -18 46 Z" fill="${c.wing}"/></g>
  <path class="glint" d="M312 181 L314.5 190.5 L324 193 L314.5 195.5 L312 205 L309.5 195.5 L300 193 L309.5 190.5 Z" fill="#fff"/>

  <g class="smoke"><circle r="7" fill="${c.smoke}"/></g>
  <g class="smoke s2"><circle r="5" cx="4" fill="${c.smoke}"/></g>
  <g class="smoke s3"><circle r="6" cx="-3" fill="${c.smoke}"/></g>
  <g class="flash">
    <path d="M0 -16 L5 -5 L22 0 L5 5 L0 16 L-3 5 L-8 0 L-3 -5 Z" fill="${AMBER}"/>
    <circle r="5" fill="#FEF3C7"/>
  </g>
  <rect class="bullet" x="-7" y="-1.5" width="14" height="3" rx="1.5" fill="#FDE68A"/>
  <rect class="casing" x="-3.5" y="-1.6" width="7" height="3.2" rx="1" fill="${AMBER}"/>

  <g class="term-l" clip-path="url(#half-l)"><use href="#term"/></g>
  <g class="term-r" clip-path="url(#half-r)"><use href="#term"/></g>
  <rect class="hitflash" x="466" y="180" width="68" height="52" rx="8" fill="#FEF3C7"/>
  <g class="ring"><circle r="30" fill="none" stroke="${AMBER}" stroke-width="4"/></g>

  <g class="reticle" fill="none" stroke="${RED}" stroke-linecap="round">
    <circle r="40" stroke-width="3"/>
    <path d="M-52 0 H-16 M16 0 H52 M0 -52 V-16 M0 16 V52" stroke-width="3"/>
    <path d="M-6 0 H6 M0 -6 V6" stroke-width="2"/>
  </g>`;

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}">
<title>${title}</title>
${body}
</svg>
`;

const logo = (c) => svg(560, 400, `<style>${css(c)}</style><g class="anim">${scene(c)}</g>`,
  'OwlCept: an owl draws a sniper rifle, scopes in on a command prompt and shoots it');

const banner = (c) => svg(1200, 400, `<style>${css(c)}
  .word{font:800 124px/1 ui-rounded,'SF Pro Rounded','Segoe UI',system-ui,-apple-system,Helvetica,Arial,sans-serif;letter-spacing:-4px}
  .tag{font:500 27px/1.3 system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif}</style>
  <g class="anim">${scene(c)}</g>
  <text class="word" x="600" y="214" fill="${c.ink}">Owl<tspan fill="${AMBER}">Cept</tspan></text>
  <text class="tag" x="606" y="264" fill="${c.muted}">Stops paste-and-run attacks</text>
  <text class="tag" x="606" y="300" fill="${c.muted}">at copy, paste and Enter.</text>`,
  'OwlCept: stops paste-and-run attacks at copy, paste and Enter');

// Static square mark for icons and favicons: the owl with a crosshair in one eye.
const mark = svg(64, 64, `
  <path d="M15 22 10 5l14 10q8-3 16 0L54 5l-5 17q7 10 5 22-4 15-22 16-18-1-22-16-2-12 5-22z" fill="#312E81"/>
  <ellipse cx="32" cy="49" rx="12" ry="9" fill="#4338CA"/>
  <circle cx="23" cy="30" r="10.5" fill="#4F46E5"/><circle cx="41" cy="30" r="10.5" fill="#4F46E5"/>
  <circle cx="23" cy="30" r="8" fill="${AMBER}"/><circle cx="23" cy="30" r="3.8" fill="#0F172A"/><circle cx="24.6" cy="28.4" r="1.4" fill="#fff"/>
  <circle cx="41" cy="30" r="8" fill="${AMBER}"/>
  <g stroke="#B91C1C" stroke-width="1.8" stroke-linecap="round" fill="none"><circle cx="41" cy="30" r="5"/><path d="M41 21.5v4.5M41 34v4.5M32.5 30H37M45 30h4.5"/></g>
  <path d="M13 18.5 26 22.5M38 22.5 51 18.5" stroke="#1E1B4B" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M29 37h6l-3 6z" fill="${AMBER}"/>`, 'OwlCept');

for (const [name, c] of Object.entries(PALETTES)) {
  writeFileSync(`${assets}owlcept-logo-${name}.svg`, logo(c));
  writeFileSync(`${assets}owlcept-banner-${name}.svg`, banner(c));
}
writeFileSync(`${assets}owlcept-mark.svg`, mark);
writeFileSync(`${root}extension/static/icons/owl.svg`, mark);
writeFileSync(`${root}web/static/owl.svg`, mark);
console.log('svgs written');

if (process.argv.includes('--render')) await render();

// Seeks the CSS animations frame by frame in Chromium and encodes them with ffmpeg.
async function render() {
  const { chromium } = await import('playwright');
  const frames = `${root}node_modules/.cache/owlcept-frames/`;
  mkdirSync(frames, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1120, height: 800 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>html,body{margin:0;background:#fff}svg{width:1120px;height:800px;display:block}</style>${logo(PALETTES.light)}`);
  const FPS = 30, SECONDS = 6;
  for (let i = 0; i < FPS * SECONDS; i++) {
    await page.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; }), (i * 1000) / FPS);
    await page.screenshot({ path: `${frames}f${String(i).padStart(4, '0')}.png` });
  }
  // Stills used in the README and for checking poses.
  for (const [t, n] of [[0, 'idle'], [1100, 'draw'], [2300, 'scope'], [2540, 'shot'], [2900, 'hit']]) {
    await page.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; }), t);
    await page.screenshot({ path: `${frames}still-${n}.png` });
  }
  await browser.close();

  const ff = (...a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]);
  ff('-framerate', String(FPS), '-i', `${frames}f%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', `${assets}owlcept-logo.mp4`);
  ff('-framerate', String(FPS), '-i', `${frames}f%04d.png`, '-vf', 'fps=25,scale=560:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', `${assets}owlcept-logo.gif`);
  execFileSync('node', [`${root}scripts/icons.mjs`], { stdio: 'inherit' });
  copyFileSync(`${root}extension/static/icons/owl-128.png`, `${assets}owlcept-mark-128.png`);
  console.log(`rendered: ${assets}owlcept-logo.mp4, owlcept-logo.gif; stills in ${frames}`);
}
