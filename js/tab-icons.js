// Animated tab icons (ported from icons-animation.html). Each <span class="tab-ico" data-icon="…"> in
// the tab bar gets inline SVG art (js/tab-icons-svg.js). Once its tab is selected (.tab--active) and
// has joined its card (.tabbar.is-docked, both set by js/lobby.js), the icon grows (.is-open, css) and
// plays its "open" animation — its own motion plus the shared glow and sparkles. When deselected the
// animation plays back to idle. Undocking alone (a swipe that lands back on the same tab) leaves it open. Colours come from --ico-* custom
// properties (see css/lobby.css), so icons can follow the operator theme.
(function tabIcons() {
  const ART = window.TAB_ICON_SVG;
  if (!ART) return;
  let uid = 0;
  const bar = document.querySelector('.tabbar');
  const DOCK_MS = 80;   // the dock shape transition (css/lobby.css .is-docked); the icon starts after it

  // Static copies of the same art (card banners, State 1 strip): no animation, but the same --ico-*
  // colours, so they follow the operator theme like the tabs
  document.querySelectorAll('.theme-ico[data-icon]').forEach(host => {
    const art = ART[host.dataset.icon];
    if (art) host.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${art.replace(/UID/g, `themeico${++uid}`)}</svg>`;
  });

  const tabs = document.querySelectorAll('.tabbar .tab');
  if (!tabs.length) return;

  const NS = 'http://www.w3.org/2000/svg';
  const SPEED = 2;   // playback rate for every transition (as in the reference page)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // Shared defs, once per page: the glow gradient and the four-point sparkle
  document.body.insertAdjacentHTML('beforeend', `
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <defs>
        <radialGradient id="tabfx-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#FFF2B0" stop-opacity=".95"/>
          <stop offset="1" stop-color="#FFD35A" stop-opacity="0"/>
        </radialGradient>
        <path id="tabfx-spark" d="M0-6 1.5-1.5 6 0 1.5 1.5 0 6-1.5 1.5-6 0-1.5-1.5Z"/>
      </defs>
    </svg>`);

  // Per icon: glow centre, sparkle positions (art units, 0–100 box), optional timing tweaks, and the
  // icon's own open animation. part(name) finds a [data-part]; run() registers a reversible animation;
  // once() is a one-shot that ends where it started, so it isn't played back on deselect.
  // Every icon's motion (and the shared glow) completes in the same DUR — the shortest of the
  // reference animations (raffles / medal). Delayed parts shorten so delay + duration = DUR.
  const DUR = 500;
  const POP = 'cubic-bezier(.2,.8,.3,1.2)';   // slight overshoot, from the reference
  const ICONS = {
    wheel: {
      glow: [50, 50], sparks: [[4, 6], [96, 6], [-6, 66], [106, 66]],
      open(run, part) {
        // Blue section spins up fast and eases to a stop. One turn (the reference does three over
        // 1600ms; three turns in DUR would strobe), landing back on a wedge boundary.
        run(part('wheelAll'), [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }], { duration: DUR, easing: POP });
        run(part('wheel'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
          { duration: DUR, easing: 'cubic-bezier(.2,.7,.2,1)' });
      },
    },
    free: {
      glow: [50, 50], sparks: [[2, 14], [74, 0], [-6, 74], [100, 72]],
      open(run, part, once) {
        // Slight grow — eases straight into the final size, no overshoot
        run(part('fgAll'), [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }],
          { duration: DUR, easing: 'cubic-bezier(.2,.8,.3,1)' });
        // Reel spins: the cherries run top to bottom three times (stacked copies 50 units apart),
        // speeding up then settling; the last frame matches the first
        once(part('reel'), [{ transform: 'translateY(0)' }, { transform: 'translateY(150px)' }],
          { duration: DUR, easing: 'cubic-bezier(.45,0,.2,1)' });
      },
    },
    s777: {
      glow: [50, 55], sparks: [[4, 4], [96, 4], [-6, 60], [106, 60]],
      open(run, part) {
        // Bouncy scale: the curve overshoots past the final size, then settles into it
        const bounce = 'cubic-bezier(.34,1.8,.64,1)';
        run(part('sevenC'), [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }], { duration: DUR, easing: bounce });
        ['sevenL', 'sevenR'].forEach(p => run(part(p), [{ transform: 'scale(1)' }, { transform: 'scale(1.07)' }],
          { duration: DUR - 60, delay: 60, easing: bounce }));
      },
    },
    raffles: {
      glow: [50, 52], sparks: [[6, 10], [96, 6], [-4, 42], [104, 74]],
      open(run, part) {
        // Top ticket turns slightly counterclockwise and grows a bit more than the back ticket
        run(part('ticketTop'), [{ transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(-6deg) scale(1.08)' }],
          { duration: DUR, easing: POP });
        run(part('ticketBack'), [{ transform: 'scale(1)' }, { transform: 'scale(1.07)' }], { duration: DUR, easing: POP });
      },
    },
    medal: {
      glow: [49.5, 55], sparks: [[8, 18], [94, 12], [-4, 72], [104, 68]],
      open(run, part) {
        // Grows 10%, ribbon stretches slightly upward
        run(part('medalG'), [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }], { duration: DUR, easing: POP });
        ['medRibA', 'medRibB'].forEach(p => run(part(p), [{ transform: 'scaleY(1)' }, { transform: 'scaleY(1.15)' }],
          { duration: DUR - 100, delay: 100, easing: 'ease-out' }));
      },
    },
    box: {
      glow: [50, 50], sparks: [[18, 2], [84, -4], [6, 24], [96, 22]], sparksBefore: 'lid',
      open(run, part) {
        // Box: little anticipation squash, then a hop as the lid pops
        run(part('body'), [
          { transform: 'scale(1,1)' },
          { transform: 'scale(1.03,.96)', offset: .18 },
          { transform: 'scale(.98,1.03)', offset: .32 },
          { transform: 'scale(1,1)' },
        ], { duration: DUR, easing: 'ease-out' });
        // Lid: dip, then lift straight up with a subtle tilt and settle
        run(part('lid'), [
          { transform: 'translate(0,0) rotate(0)', easing: 'ease-in' },
          { transform: 'translate(0,2px) rotate(0)', offset: .15, easing: 'cubic-bezier(.2,.8,.3,1)' },
          { transform: 'translate(0,-17px) rotate(-7deg)', offset: .6, easing: 'ease-in-out' },
          { transform: 'translate(0,-15px) rotate(-6deg)' },
        ], { duration: DUR });
        // Side ribbons peel outward (body halves pivot at the bottom, lid halves at the top)
        const skew = (p, deg) => run(part(p), [{ transform: 'skewX(0deg)' }, { transform: `skewX(${deg}deg)` }],
          { duration: DUR - 100, delay: 100, easing: 'ease-out' });
        skew('ribL', 4); skew('ribR', -4); skew('lidRibL', -10); skew('lidRibR', 10);
        // Interior glow
        run(part('floorGlow'), [{ opacity: 0 }, { opacity: 1 }], { duration: DUR - 150, delay: 150 });
      },
    },
  };

  const el = (name, attrs, parent, before) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.insertBefore(e, before || null);
    return e;
  };

  function mount(host) {
    const key = host.dataset.icon, fx = ICONS[key];
    if (!fx || !ART[key]) return;
    const id = `tabico${++uid}`;
    host.innerHTML = `<svg class="tab-ico__svg" viewBox="0 0 100 100" overflow="visible" aria-hidden="true">${ART[key].replace(/UID/g, id)}</svg>`;
    const svg = host.firstElementChild;
    const part = name => svg.querySelector(`[data-part="${name}"]`);

    // Shared glow (behind the art) and sparkles (in front, or just before `sparksBefore`)
    const glow = el('ellipse', { cx: fx.glow[0], cy: fx.glow[1], rx: 62, ry: 62, fill: 'url(#tabfx-glow)', opacity: 0 },
      svg, svg.querySelector(':scope > :not(defs)'));
    const sparks = fx.sparks.map(([x, y]) => {
      const s = el('use', { href: '#tabfx-spark', class: 'sp' }, svg, fx.sparksBefore && part(fx.sparksBefore));
      s.style.opacity = 0;
      s.dataset.x = x; s.dataset.y = y;
      return s;
    });

    const all = [], sparkAnims = [];   // reversible animations / one-shot twinkles
    const run = (target, frames, opts) => {
      const a = target.animate(frames, { fill: 'forwards', ...opts });
      a.playbackRate = SPEED;
      all.push(a);
      return a;
    };
    const once = (target, frames, opts) => {
      const a = target.animate(frames, opts);
      a.playbackRate = SPEED;
      sparkAnims.push(a);
      return a;
    };
    const clearSparks = () => { sparkAnims.forEach(a => a.cancel()); sparkAnims.length = 0; };
    let isOpen = false;

    function open(animate) {
      if (isOpen) return;
      isOpen = true;
      host.classList.add('is-open');
      all.forEach(a => a.cancel()); all.length = 0;
      clearSparks();
      fx.open(run, part, animate ? once : () => {});
      run(glow, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: DUR - 100, delay: 100, easing: 'ease-out' });
      if (!animate) { all.forEach(a => a.finish()); return; }
      // Sparkles pop and twinkle, staggered
      sparks.forEach((s, i) => {
        const t = `translate(${s.dataset.x}px,${s.dataset.y}px)`;
        const a = s.animate([
          { transform: `${t} scale(0)`, opacity: 0 },
          { transform: `${t} scale(1.3)`, opacity: 1, offset: .5 },
          { transform: `${t} scale(0)`, opacity: 0 },
        ], { fill: 'forwards', duration: 700, delay: 450 + i * 110 });   // twinkle as the motion lands
        a.playbackRate = SPEED;
        sparkAnims.push(a);
      });
    }

    // Idle: play the open animation backwards
    function idle(animate) {
      clearTimeout(openTimer);
      if (!isOpen) return;
      isOpen = false;
      host.classList.remove('is-open');
      clearSparks();
      all.forEach(a => { a.reverse(); if (!animate) a.finish(); });
    }

    const tab = host.closest('.tab');
    let openTimer;
    const sync = () => {
      if (!tab.classList.contains('tab--active')) { idle(!reduce.matches); return; }
      if (isOpen || (bar && !bar.classList.contains('is-docked'))) return;
      clearTimeout(openTimer);
      openTimer = setTimeout(() => {
        if (tab.classList.contains('tab--active') && (!bar || bar.classList.contains('is-docked'))) open(!reduce.matches);
      }, DOCK_MS);
    };
    new MutationObserver(sync).observe(tab, { attributes: true, attributeFilter: ['class'] });
    if (bar) new MutationObserver(sync).observe(bar, { attributes: true, attributeFilter: ['class'] });
    if (tab.classList.contains('tab--active')) open(false);   // selected tab on load starts open, without playing
  }

  document.querySelectorAll('.tab-ico[data-icon]').forEach(mount);
})();
