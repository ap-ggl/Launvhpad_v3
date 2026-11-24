// Shared sections: a section with data-clone-from="<id>" gets a copy of that section's content
// (Prize Drops reuses the Raffles Prizes, Games and Rules). Runs first so later setup (game tiles,
// scrollbars, countdowns) applies to the copies too. Ids inside the copy are dropped to keep them unique.
document.querySelectorAll('[data-clone-from]').forEach(target => {
  const src = document.getElementById(target.dataset.cloneFrom);
  if (!src) return;
  target.innerHTML = src.innerHTML;
  target.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
});

// Card title bars (Figma "Title and Close" 7171:6570): every card in the list starts with its
// data-title and a ✕ that collapses the launchpad (wired in protoToggles). Long titles scroll (tabCards).
document.querySelectorAll('#promo-list > .promo-card').forEach(card => {
  const bar = document.createElement('header');
  bar.className = 'card-title';
  bar.innerHTML = `<button class="card-title__close" type="button" aria-label="Close"><img src="assets/icons/close-16.svg" width="16" height="16" alt=""></button>
    <h2 class="card-title__text"><span class="card-title__inner"></span></h2>`;
  bar.querySelector('.card-title__inner').textContent = card.dataset.title || '';
  card.prepend(bar);
});

// Countdowns: each ticks down from the value shown in the Figma frame (00:01:25:36 = d:h:m:s)
document.querySelectorAll('.countdown').forEach(function countdown(root) {
  const el = unit => root.querySelector(`[data-unit="${unit}"]`);
  const parts = { d: el('d'), h: el('h'), m: el('m'), s: el('s') };
  let remaining =
    +parts.d.textContent * 86400 + +parts.h.textContent * 3600 +
    +parts.m.textContent * 60 + +parts.s.textContent;
  const pad = n => String(n).padStart(2, '0');

  setInterval(() => {
    if (remaining <= 0) return;
    remaining -= 1;
    parts.d.textContent = pad(Math.floor(remaining / 86400));
    parts.h.textContent = pad(Math.floor(remaining / 3600) % 24);
    parts.m.textContent = pad(Math.floor(remaining / 60) % 60);
    parts.s.textContent = pad(remaining % 60);
  }, 1000);
});

// Promo card accordion (every card with sections): panels are [Main, section 1..4]; handle i
// sits between panel i and panel i+1 and controls panel i+1. Exactly one panel is open;
// closing a section reopens Main. Deep link the Raffles card with ?open=swap|prizes|games|rules.
document.querySelectorAll('.promo-card').forEach(function promoAccordion(card) {
  if (!card.querySelector('.promo-main')) return;
  const panels = [card.querySelector('.promo-main'), ...card.querySelectorAll('.promo-section')];
  const handles = [...card.querySelectorAll('.info-handle')];
  const CHEVRON_UP = 'assets/icons/chevron-up.svg';
  const CHEVRON_DOWN = 'assets/icons/chevron-down.svg';

  // Short-card fallback (cards with .promo-card__body[data-flow-below]): when the card is shorter
  // than that, the body gets .is-flow — panels open to their full content height and the whole
  // body (Main, handles, sections) scrolls. Panels animate their height in JS since auto heights
  // can't be transitioned; the body scrolls so the opened section starts at the top.
  const body = card.querySelector('.promo-card__body[data-flow-below]');
  const isFlow = () => !!body?.classList.contains('is-flow');
  const frame = p => {
    const cs = getComputedStyle(p);
    return { height: cs.height, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom };
  };

  function open(index, instant = false) {
    const changed = isFlow() ? panels.filter((p, i) => p.classList.contains('is-open') !== (i === index)) : [];
    const from = changed.map(frame);
    changed.forEach(p => p.getAnimations().forEach(a => a.cancel()));
    panels.forEach((panel, i) => {
      const isOpen = i === index;
      panel.classList.toggle('is-open', isOpen);
      panel.inert = !isOpen;
    });
    handles.forEach((handle, i) => {
      const isOpen = i + 1 === index;     // handle directly above the open panel
      handle.classList.toggle('is-open', isOpen);
      handle.classList.toggle('is-after-open', i === index); // handle directly below it
      handle.setAttribute('aria-expanded', String(isOpen));
      handle.querySelectorAll('img').forEach(img => { img.src = isOpen ? CHEVRON_DOWN : CHEVRON_UP; });
    });
    if (!changed.length) return;

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Opened section's handle to the top: sum of the final heights above it (offsetTop would
    // report the sticky handle's stuck position instead)
    let top = 0;
    for (let el = index === 0 ? null : handles[index - 1].previousElementSibling; el; el = el.previousElementSibling) top += el.offsetHeight;
    if (!instant && !reduce && card.closest('.screen.is-ready')) {
      const duration = parseFloat(getComputedStyle(card).getPropertyValue('--acc-dur')) * 1000 || 180;
      const easing = getComputedStyle(card).getPropertyValue('--acc-ease').trim() || 'ease-out';
      changed.forEach((p, k) => {
        p.animate([from[k], frame(p)], { duration, easing }).finished.then(updateFades, () => {});
      });
    }
    body.scrollTo({ top, behavior: instant ? 'instant' : reduce ? 'auto' : 'smooth' });
  }

  // Top/bottom fades on the flow body: each shows only while content is hidden past that edge
  function updateFades() {
    if (!body) return;
    const flow = isFlow();
    body.classList.toggle('is-scrolled', flow && body.scrollTop > 0);
    body.classList.toggle('has-more', flow && body.scrollTop + body.clientHeight < body.scrollHeight - 1);
  }
  if (body) {
    body.addEventListener('scroll', updateFades, { passive: true });
    new ResizeObserver(() => {
      const flow = card.clientHeight < +body.dataset.flowBelow;
      if (flow !== isFlow()) {
        panels.forEach(p => p.getAnimations().forEach(a => a.cancel()));
        body.classList.toggle('is-flow', flow);
        body.scrollTop = 0;
      }
      updateFades();
    }).observe(card);
  }

  handles.forEach((handle, i) => {
    handle.addEventListener('click', () => {
      open(panels[i + 1].classList.contains('is-open') ? 0 : i + 1);
    });
  });

  // "Swap Tickets for Prizes" button on Main opens the Swap Tickets section
  card.querySelector('.promo-main .btn--attention')?.addEventListener('click', () => open(1));
  // Any [data-opens="<section id>"] in the card opens that section (e.g. Prize Drops "Not Active" → Games)
  card.querySelectorAll('[data-opens]').forEach(btn => {
    const i = panels.findIndex(p => p.id === btn.dataset.opens);
    if (i > 0) btn.addEventListener('click', () => open(i));
  });
  // Card left out of view (tabCards) → back to Main, without animating
  card.addEventListener('promo:reset', () => { if (!panels[0].classList.contains('is-open')) open(0, true); });

  const names = card.id === 'promo-raffles' ? ['main', 'swap', 'prizes', 'games', 'rules'] : [];
  const requested = names.indexOf(new URLSearchParams(location.search).get('open'));
  open(requested > 0 ? requested : 0);
});

// Prototype controls: each switch adds a .no-<name> class to the screen; the hidden bars
// collapse to 0 and the game area / promo card grow into the freed space.
//   Jackpot Madness → JackpotMadness bar                   on by default  (?jackpot=off)
//   Safari          → Status Bar, URL Bar, Bottom Nav Bar  off by default (?safari=on)
(function protoToggles() {
  const screen = document.querySelector('.screen');
  if (!screen) return;
  const params = new URLSearchParams(location.search);

  [['toggle-jackpot', 'jackpot', true], ['toggle-safari', 'safari', false]].forEach(([id, name, defaultOn]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const set = on => {
      screen.classList.toggle(`no-${name}`, !on);
      btn.setAttribute('aria-pressed', String(on));
    };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-pressed') !== 'true'));
    const param = params.get(name);
    set(param === 'on' ? true : param === 'off' ? false : defaultOn);
  });

  // Launchpad type + state → data-lp-type / data-lp-state on the screen (?type=, ?state=; Floating by default).
  //   Dropdown: State 1 | 2 | 3.   Floating: hidden | small | 3 (Full = State 3).
  // CSS animates the overlay between states; content of inactive states is made inert.
  const radios = [...document.querySelectorAll('input[name="lp-state"]')];
  const typeRadios = [...document.querySelectorAll('input[name="lp-type"]')];
  const stateLayers = {
    0: document.querySelector('.overlay__s0'),
    1: document.querySelector('.overlay__s1'),
    2: document.querySelector('.overlay__s2'),
    3: document.querySelector('.overlay__s3'),
  };
  const floatLayer = document.querySelector('.overlay__fl');
  const flToggle = document.querySelector('.fl-toggle');
  const flOpen = document.querySelector('.fl-open');
  const STATES = { dropdown: ['0', '1', '2', '3'], floating: ['hidden', 'small', '3'] };   // Dropdown 0 = Hidden
  const s1Hide = document.querySelector('.overlay__s1-hide');
  const HOME = { dropdown: '1', floating: 'small' };   // where ✕ / swipe-up from State 3 lands
  const lpType = () => screen.dataset.lpType || 'dropdown';
  const overlay = document.querySelector('.overlay');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let bounce = null;

  // Launchpad size/shape bounce. Reads the current geometry, switches state, reads the target
  // geometry from CSS, then animates old → slightly past target → back. Overshoot is capped in px
  // (not proportional) so a big State 3 → 1 collapse doesn't dip below the strip's height.
  const GEOMETRY = ['top', 'height', 'left', 'right',
    'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'];
  const readGeometry = () => {
    const cs = getComputedStyle(overlay);
    return Object.fromEntries(GEOMETRY.map(p => [p, parseFloat(cs[p])]));
  };
  const overshoot = d => (d === 0 ? 0 : Math.sign(d) * Math.min(Math.abs(d) * 0.03 + 0.75, 6));
  const BOUNCE_MS = 200;   // keep in sync with --lp-dur in css/lobby.css

  const frame = f => Object.fromEntries(GEOMETRY.map(p => [p, `${f(p)}px`]));
  // bounciness scales the overshoot (1 = default); single = one overshoot then settle, without the dip back
  function animateGeometry(from, to, bounciness = 1, single = false) {
    const over = p => overshoot(to[p] - from[p]) * bounciness;
    bounce = overlay.animate([
      { ...frame(p => from[p]), easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
      { ...frame(p => to[p] + over(p)), offset: 0.6, easing: 'ease-in-out' },
      ...(single ? [] : [{ ...frame(p => to[p] - over(p) * 0.35), offset: 0.82, easing: 'ease-in-out' }]),
      frame(p => to[p]),
    ], { duration: BOUNCE_MS });
    bounce.onfinish = () => { bounce = null; };
  }
  // Floating Full ↔ Small/Hidden: Full drops in from (and retracts to) the top edge, full width,
  // instead of growing out of the pill. On the way back the pill waits (.lp-pill-wait) until Full
  // has retracted, then fades in.
  function retractToTop(from) {
    screen.classList.add('lp-pill-wait');
    bounce = overlay.animate([frame(p => from[p]), frame(p => (p === 'height' ? 0 : from[p]))],
      { duration: BOUNCE_MS, easing: 'cubic-bezier(0.4, 0, 1, 1)' });
    const done = () => { bounce = null; screen.classList.remove('lp-pill-wait'); };
    bounce.onfinish = done;
    bounce.oncancel = done;
  }
  const PILL = ['small', 'hidden'];

  const setState = n => {
    const prev = screen.dataset.lpState;
    const animate = overlay && screen.classList.contains('is-ready') && !reduceMotion.matches
      && prev !== n;
    const from = animate ? readGeometry() : null;   // includes any in-flight bounce
    bounce?.cancel();

    screen.dataset.lpState = n;
    if (n !== '2') screen.classList.remove('lp-no-reserve');   // see grantTicket
    radios.forEach(r => { r.checked = r.value === n && !r.closest('label').hidden; });
    Object.entries(stateLayers).forEach(([k, el]) => { if (el) el.inert = k !== n; });
    if (s1Hide) s1Hide.inert = n !== '1';
    if (floatLayer) {
      floatLayer.inert = n !== 'small' && n !== 'hidden';
      flOpen.inert = n !== 'small';
      flToggle.setAttribute('aria-expanded', String(n === 'small'));
      flToggle.setAttribute('aria-label', n === 'small' ? 'Hide launchpad' : 'Show launchpad');
    }

    if (!animate) return;
    if (PILL.includes(prev) && n === '3') {
      const to = readGeometry();
      animateGeometry({ ...to, height: 0 }, to);
    } else if (prev === '3' && PILL.includes(n)) {
      retractToTop(from);
    } else if (prev === 'hidden' && n === 'small') {
      animateGeometry(from, readGeometry(), 0.6, true);   // Hidden → Small: one gentle bounce (user tweak)
    } else {
      animateGeometry(from, readGeometry());
    }
  };
  radios.forEach(r => r.addEventListener('change', () => setState(r.value)));

  // Type switch: shows that type's state options and moves to its default state (State 3 / Full
  // is shared, so it stays open).
  const setType = t => {
    screen.dataset.lpType = t;
    typeRadios.forEach(r => { r.checked = r.value === t; });
    radios.forEach(r => { r.closest('label').hidden = r.closest('label').dataset.type !== t; });
    const st = screen.dataset.lpState;
    setState(STATES[t].includes(st) ? st : HOME[t]);
  };
  typeRadios.forEach(r => r.addEventListener('change', () => setType(r.value)));
  // Floating: chevron toggles Small ↔ Hidden (no timers between states). Small cycles through one
  // summary per promo card every 4s while shown, looping; tapping it opens Full on that summary's card
  // (lp:show-card → tabCards). Each summary's number is copied from its card's stats cell.
  const slides = [...(flOpen?.querySelectorAll('.fl-slide') || [])];
  const statCell = s => [...(document.getElementById(s.dataset.card)?.querySelectorAll('.promo-stats__cell') || [])]
    .find(c => c.querySelector('span')?.textContent.trim() === s.dataset.stat)?.querySelector('strong');
  slides.forEach(s => { s.querySelector('strong').textContent = statCell(s)?.textContent.trim() ?? ''; });
  let slideIndex = 0, slideTimer = null, winning = false;
  const showSlide = i => {
    slides.forEach((s, k) => s.classList.toggle('is-shown', k === i));   // cross-fade (css .fl-slide)
    slideIndex = i;
    const s = slides[i];
    floatLayer.dataset.promo = s.dataset.promo;
    flOpen.setAttribute('aria-label', `Open ${s.dataset.name}: ${s.querySelector('strong').textContent} ${s.querySelector('.fl-open__info span').textContent.toLowerCase()}`);
  };
  const runSlides = () => {
    clearInterval(slideTimer); slideTimer = null;
    if (screen.dataset.lpState === 'small' && slides.length > 1 && !winning) {
      slideTimer = setInterval(() => showSlide((slideIndex + 1) % slides.length), 4000);
    }
  };

  // Trigger "Grant Ticket" (prototype control):
  //   Floating: Small shows the Super Raffles summary (Hidden opens to Small for the sequence)
  //   Dropdown: State 2 pops in from Hidden / State 1 (or plays in place if already shown)
  //   then winBG fades in while gold particles fly into the ticket count (Floating: from the left;
  //   Dropdown: from both sides to the centred count), the count bounces up in scale and goes +1
  //   (everywhere: Small summary, State 2, the card's MY TICKETS), and after a 4s hold the launchpad
  //   goes back to the state it was opened from. In State 3 / Full the count just goes +1.
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const flFx = floatLayer?.querySelector('.fl-fx');
  const s2 = stateLayers[2], s2Fx = s2?.querySelector('.s2-fx'), s2Count = s2?.querySelector('.s2-count');
  function particles(fx, toX, toY, duration, spawn, N = 18) {
    for (let k = 0; k < N; k++) {
      const p = document.createElement('i');
      p.className = 'fl-particle';
      const size = 6 + Math.random() * 6;   // 6–12px
      const { x0, y0 } = spawn(k);
      p.style.cssText = `width:${size}px;height:${size}px;left:${x0}px;top:${y0}px`;
      fx.append(p);
      const dx = toX - x0 + (Math.random() - 0.5) * 12, dy = toY - y0 + (Math.random() - 0.5) * 10;
      const lift = (Math.random() - 0.5) * 18;   // slight arc
      const anim = p.animate([
        { transform: 'translate(0, 0) scale(0.4)', opacity: 0 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 + lift}px) scale(1)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0.9, offset: 0.9 },
        { transform: `translate(${dx}px, ${dy}px) scale(0)`, opacity: 0 },
      ], { duration: duration * (0.7 + Math.random() * 0.3), delay: Math.random() * duration * 0.5, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'backwards' });
      anim.onfinish = anim.oncancel = () => p.remove();
    }
  }
  const fromLeft = () => ({ x0: -10 + Math.random() * 90, y0: Math.random() * 54 });            // Small: left of the count
  const fromSides = k => ({ x0: k % 2 ? 274 + Math.random() * 130 : -10 + Math.random() * 130,   // State 2: both ends
    y0: Math.random() * 56 });
  const raffles = slides.find(s => s.dataset.card === 'promo-raffles');
  const ticketCount = () => statCell(raffles)?.textContent.trim() ?? raffles?.querySelector('strong').textContent ?? '0';
  const syncS2 = () => {
    if (!s2Count) return;
    s2Count.textContent = ticketCount();
    s2.setAttribute('aria-label', `Open Super Raffles: ${s2Count.textContent} tickets`);
  };
  syncS2();
  const bump = () => {
    const next = String((parseInt(ticketCount(), 10) || 0) + 1);
    raffles.querySelector('strong').textContent = next;
    const cell = statCell(raffles);
    if (cell) cell.textContent = next;
    syncS2();
    if (slides[slideIndex] === raffles) showSlide(slideIndex);   // refresh the label
    syncMsgs();
  };
  const grantBtn = document.getElementById('trigger-ticket');
  async function grantTicket() {
    if (!raffles || winning) return;
    const st = screen.dataset.lpState, floating = lpType() === 'floating';
    if (st === '3') { bump(); return; }
    winning = true;
    if (grantBtn) grantBtn.disabled = true;   // greyed out until the sequence (incl. the 4s hold) ends
    let shownState, restore = null, layer, fx, num, spawn, N;
    if (floating) {
      clearInterval(slideTimer); slideTimer = null;
      const target = slides.indexOf(raffles);
      const needsRoll = slideIndex !== target;
      if (needsRoll) showSlide(target);
      if (st === 'hidden') { restore = 'hidden'; setState('small'); }
      await wait(restore ? BOUNCE_MS + 250 : needsRoll ? 350 : 0);   // Small open, summary in place
      shownState = 'small'; layer = floatLayer; fx = flFx; num = raffles.querySelector('strong'); spawn = fromLeft; N = 18;
    } else {
      // From Hidden the reserved space stays removed (no game resize for a short pop-in)
      if (st === '0') screen.classList.add('lp-no-reserve');
      if (st !== '2') { restore = st; setState('2'); await wait(BOUNCE_MS + 250); }   // State 2 open
      shownState = '2'; layer = s2; fx = s2Fx; num = s2Count; spawn = fromSides; N = 24;
    }

    layer.classList.add('is-winning');   // winBG fades in
    const FLY = 900;
    if (!reduceMotion.matches) {
      const r = num.getBoundingClientRect(), box = fx.getBoundingClientRect();
      const scale = box.width / fx.offsetWidth || 1;   // the phone screen may be scaled
      particles(fx, (r.left + r.width / 2 - box.left) / scale, (r.top + r.height / 2 - box.top) / scale, FLY, spawn, N);
      await wait(FLY * 1.25);
      num.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(1.35)', offset: 0.4 },
        { transform: 'scale(0.95)', offset: 0.75 },
        { transform: 'scale(1)' },
      ], { duration: 450, easing: 'ease-out' });
      await wait(180);   // count changes at the top of the bounce
    }
    bump();
    await wait(800);
    layer.classList.remove('is-winning');

    await wait(4000);
    winning = false;
    if (grantBtn) grantBtn.disabled = false;
    if (restore && screen.dataset.lpState === shownState) setState(restore);
    else if (floating) runSlides();
  }
  grantBtn?.addEventListener('click', grantTicket);
  if (slides.length) {
    showSlide(0);
    new MutationObserver(runSlides).observe(screen, { attributes: true, attributeFilter: ['data-lp-state'] });
  }
  flToggle?.addEventListener('click', () => setState(screen.dataset.lpState === 'small' ? 'hidden' : 'small'));
  flOpen?.addEventListener('click', () => {
    const card = slides[slideIndex]?.dataset.card;
    if (card) document.dispatchEvent(new CustomEvent('lp:show-card', { detail: card }));
    setState('3');
  });
  // In-screen navigation: tapping the State 1 strip opens State 3 on the shown message's card; the State 2 banner
  // opens it on the Raffles card (it shows the raffle tickets); the ✕ in State 3 collapses to State 1.
  stateLayers[1]?.addEventListener('click', () => {
    const card = msgs[msgIndex]?.dataset.card;
    if (card) document.dispatchEvent(new CustomEvent('lp:show-card', { detail: card }));
    setState('3');
  });
  // Dropdown Hidden: the chevron on the State 1 strip hides it; the Hidden tab brings State 1 back
  s1Hide?.addEventListener('click', () => setState('0'));
  stateLayers[0]?.addEventListener('click', () => setState('1'));
  stateLayers[2]?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('lp:show-card', { detail: 'promo-raffles' }));
    setState('3');
  });

  // Vertical swipe gestures (touch, pen or mouse drag):
  //   swipe down on the State 1 strip / State 2 banner → State 3
  //   swipe up from the bottom of State 3 (tab bar) → State 1
  // Fires once the gesture passes the threshold and is clearly vertical; the click that ends a
  // swipe is swallowed so it doesn't also press a tab.
  function onSwipe(el, direction, action, threshold = 30) {
    if (!el) return;
    let start = null, fired = false;
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY }; fired = false;
    });
    window.addEventListener('pointermove', e => {
      if (!start || fired) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      const along = direction === 'down' ? dy : -dy;
      if (along > threshold && Math.abs(dy) > Math.abs(dx) * 1.2) { fired = true; action(); }
    });
    window.addEventListener('pointerup', () => { start = null; });
    window.addEventListener('pointercancel', () => { start = null; });
    el.addEventListener('click', e => { if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; } }, true);
  }
  // State 1 strip: one message per promo card (campaign name + key stat + icon), cycling every 4s while
  // State 1 is shown and resuming where it left off, like the Floating Small summaries. The promo
  // background follows the shown message; tapping opens State 3 on that message's card.
  const s1 = stateLayers[1];
  const msgs = [...(s1?.querySelectorAll('.s1-msg') || [])];
  let msgIndex = 0, msgTimer = null;
  // Cross-fade: the incoming message fades in while the outgoing one fades out (css .s1-msg)
  const showMsg = i => {
    msgs.forEach((m, k) => m.classList.toggle('is-shown', k === i));
    msgIndex = i;
    const m = msgs[i], stat = m.querySelector('.s1-msg__stat');
    s1.dataset.promo = m.dataset.promo || 'none';   // the hint has no campaign: its background fades out
    s1.setAttribute('aria-label', `Open ${m.dataset.name}${stat ? `: ${stat.textContent.trim().toLowerCase()}` : ''}`);
  };
  function syncMsgs() {
    msgs.forEach(m => { if (m.dataset.card) m.querySelector('strong').textContent = statCell(m)?.textContent.trim() ?? ''; });
    if (msgs.length) showMsg(msgIndex);   // refresh the label
  }
  const runMsgs = () => {
    clearInterval(msgTimer); msgTimer = null;
    if (screen.dataset.lpState === '1' && msgs.length > 1) {
      msgTimer = setInterval(() => showMsg((msgIndex + 1) % msgs.length), 4000);
    }
  };
  syncMsgs();
  new MutationObserver(runMsgs).observe(screen, { attributes: true, attributeFilter: ['data-lp-state'] });
  runMsgs();   // page may load straight into State 1 (?state=1)


  const toFull = () => { if (screen.dataset.lpState !== '3') setState('3'); };
  onSwipe(stateLayers[1], 'down', toFull);
  onSwipe(stateLayers[2], 'down', toFull);
  const toStrip = () => { if (screen.dataset.lpState === '3') setState(HOME[lpType()]); };
  onSwipe(document.querySelector('.tabbar'), 'up', toStrip);
  document.querySelectorAll('.card-title__close').forEach(btn => btn.addEventListener('click', () => setState(HOME[lpType()])));
  // Floating + Small by default (user choice); ?type=dropdown for States 1/2/3,
  // ?state=hidden|small|full|3 for Floating
  const startType = params.get('type') === 'dropdown' ? 'dropdown' : 'floating';
  const qs = params.get('state');
  const startState = qs === 'full' ? '3' : qs === 'hidden' && startType === 'dropdown' ? '0' : qs;
  screen.dataset.lpState = STATES[startType].includes(startState) ? startState : HOME[startType];
  setType(startType);

  // Enable height transitions only after first paint so ?x=off loads don't animate
  requestAnimationFrame(() => requestAnimationFrame(() => screen.classList.add('is-ready')));
})();

// Swap Tickets section: ticket offers + swap history (static mock data from Figma 5908:196028),
// plus a custom scrollbar that tracks the list's native scroll. Not interactive beyond scrolling.
(function swapTickets() {
  const lists = document.querySelectorAll('.swap__list');
  if (!lists.length) return;

  const ICONS = {
    raffles: { cls: 'ico--raffles', src: 'assets/icons/raffles.svg' },
    coins: { cls: 'ico--coins', src: 'assets/icons/coins.svg' },
    free: { cls: 'ico--free', src: 'assets/icons/free-games.svg' },
    freeAlt: { cls: 'ico--free', src: 'assets/icons/free-games-alt.svg' },   // variant used on the disabled cards
  };
  const OFFERS = [
    { tickets: 1, prize: '€1 Cash', icon: 'coins' },
    { tickets: 1, prize: '5 Free Games', icon: 'free' },
    { tickets: 2, prize: '€5 Cash', icon: 'coins', disabled: true },
    { tickets: 2, prize: '15 Free Games', icon: 'freeAlt', disabled: true },
    { tickets: 5, prize: '€15 Cash', icon: 'coins', disabled: true },
    { tickets: 5, prize: '50 Free Games', icon: 'freeAlt', disabled: true },
  ];
  const HISTORY = [
    { text: '1 ticket to 5 Free Games', icon: 'free', date: '15.02.26' },
    { text: '2 tickets to €5 Cash', icon: 'coins', date: '15.02.26' },
    { text: '1 ticket to 5 Free Games', icon: 'free', date: '15.02.26' },
    { text: '1 ticket to 5 Free Games', icon: 'free', date: '15.02.26' },
  ];
  const icon = (key, extra = '') => `<span class="ico ${ICONS[key].cls} ${extra}"><img src="${ICONS[key].src}" alt=""></span>`;

  const html = OFFERS.map(o => `
    <div class="ticket-swap${o.disabled ? ' is-disabled' : ''}">
      <div class="ticket-swap__info">
        <div class="ticket-swap__slot">
          ${icon('raffles', 'ticket-swap__icon')}
          <div class="ticket-swap__text"><strong>${o.tickets} Tickets</strong></div>
        </div>
        <img class="ticket-swap__swap" src="assets/icons/swap.svg" width="26" height="26" alt="for">
        <div class="ticket-swap__slot">
          ${icon(o.icon, 'ticket-swap__icon')}
          <div class="ticket-swap__text"><strong>${o.prize}</strong><small>0.10 Eur per spin</small></div>
        </div>
      </div>
      <span class="btn ${o.disabled ? 'btn--disabled' : 'btn--attention'}">Choose</span>
      <p class="ticket-swap__remaining">10 Prizes Remaining</p>
    </div>`).join('') + `
    <div class="swap-divider">HISTORY</div>` + HISTORY.map(h => `
    <div class="swap-history">
      <div class="swap-history__name">${icon(h.icon)}<span>${h.text}</span></div>
      <span>${h.date}</span>
    </div>`).join('');
  lists.forEach(list => { list.innerHTML = html; });
})();

// Custom scrollbars (Swap Tickets, Rules): each [data-scroll] list has a sibling .scrollbar whose
// fixed 67px handle (as in Figma) moves in proportion to the list's native scroll position.
(function customScrollbars() {
  document.querySelectorAll('[data-scroll]').forEach(list => {
    // Nearest ancestor that contains a .scrollbar (it can sit beside the list or, as in Winners,
    // beside a column that wraps the list)
    let scope = list.parentElement;
    while (scope && !scope.querySelector(':scope > .scrollbar')) scope = scope.parentElement;
    const bar = scope?.querySelector(':scope > .scrollbar');
    const handle = bar?.querySelector('.scrollbar__handle');
    if (!handle) return;
    const sync = () => {
      const max = list.scrollHeight - list.clientHeight;
      const travel = bar.clientHeight - handle.offsetHeight;
      handle.style.transform = `translateY(${max > 0 ? (list.scrollTop / max) * travel : 0}px)`;
    };
    list.addEventListener('scroll', sync, { passive: true });
    new ResizeObserver(sync).observe(list);   // section open/close and jackpot/safari toggles resize it
  });
})();

// Jackpots card: four jackpot sections (Figma 5388:75156), each with tickers and a horizontal
// "Curated Games for you" row (tiles filled in by gamesGrid below). Static mock data.
(function jackpots() {
  const list = document.getElementById('jackpots-list');
  if (!list) return;
  // ticker: label, value, fill px, optional: big (24px value), w (bar px, else full width),
  // narrow (83px right padding), wash (JM card colour), img (JM bar texture), icon (KM)
  const SECTIONS = [
    { key: 'jm', name: 'Jackpot Madness', logo: 'jackpots/jm-logo.png', tickers: [
      { label: 'MADNESS', value: '8,280.94', big: true, fill: 115, wash: 'rgba(139, 83, 251, 0.5)', img: 'jm-bar-1.png' },
      { label: 'MAYHEM', value: '364.05', fill: 135, w: 291, wash: 'rgba(244, 48, 77, 0.5)', img: 'jm-bar-2.png' },
      { label: 'MANIA', value: '18.58', fill: 63, w: 218, wash: 'rgba(0, 169, 166, 0.5)', img: 'jm-bar-3.png' },
    ] },
    { key: 'km', name: 'King Millions', logo: 'jackpots/km-logo.png', tickers: [
      { label: 'GRAND', value: '22,227,280.94', big: true, fill: 115, icon: 'km-icon-grand.png' },
      { label: 'MAJOR', value: '1,007,150.05', fill: 135, narrow: true, icon: 'km-icon-major.png' },
    ] },
    { key: 'mm', name: 'Mega Moolah', logo: 'jackpots/mm-logo.png', tickers: [
      { label: 'MEGA', value: '40,335,846.69', fill: 135, w: 386, narrow: true },
      { label: 'MAJOR', value: '9,576,354.83', fill: 135, w: 322, narrow: true },
      { label: 'MINOR', value: '2,332,082.63', fill: 63, w: 237, narrow: true },
      { label: 'MINI', value: '3,443.85', fill: 63, w: 163, narrow: true },
    ] },
    { key: 'lol', name: 'Lotsa Loot', logo: 'jackpots/lol-logo.png', tickers: [
      { label: 'LEGENDARY', value: '8,280.94', big: true, fill: 115 },
      { label: 'LUXURY', value: '364.05', fill: 135, narrow: true },
      { label: 'LUCKY', value: '18.58', fill: 63, w: 218, narrow: true },
    ] },
  ];

  const ticker = (t, card) => {
    const cls = ['jp-ticker', card && 'jp-ticker--card', t.big && 'jp-ticker--big', t.narrow && 'jp-ticker--narrow'].filter(Boolean).join(' ');
    const width = t.w ? `width:${t.w}px` : 'width:100%';
    const label = `<span class="jp-ticker__label">${t.label}</span>`, value = `<span class="jp-ticker__value">${t.value}</span>`;
    // JM: label and amount share a row the width of the bar; others stack label over amount
    const text = card ? `<div class="jp-ticker__row" style="${width}">${label}${value}</div>` : label + value;
    const bar = `<div class="jp-bar${t.img ? ' jp-bar--img' : ''}" style="${width}${t.img ? `;--bar-img:url('assets/jackpots/${t.img}')` : ''}">
        ${t.icon ? `<img class="jp-bar__icon" src="assets/jackpots/${t.icon}" alt="">` : ''}
        <span class="jp-bar__fill" style="width:${t.fill}px"></span></div>`;
    return `<div class="${cls}"${t.wash ? ` style="--wash:${t.wash}"` : ''}>${text}${bar}</div>`;
  };

  list.innerHTML = SECTIONS.map(s => `
    <section class="jp jp--${s.key}" aria-label="${s.name}">
      <div class="jp__bg" aria-hidden="true"></div>
      <div class="jp__head">
        <img class="jp__logo" src="assets/${s.logo}" alt="${s.name}">
        ${s.tickers.map(t => ticker(t, s.key === 'jm')).join('')}
      </div>
      <div class="jp-games">
        <h3 class="jp-games__title">Curated Games for you</h3>
        <div class="jp-games__list"></div>
      </div>
    </section>`).join('');

  // Top fade only while something is scrolled out of view at the top
  const syncFade = () => list.classList.toggle('is-scrolled', list.scrollTop > 0);
  list.addEventListener('scroll', syncFade, { passive: true });
  syncFade();

  // Mouse drag scrolls a games row sideways (touch/trackpad scroll natively)
  list.querySelectorAll('.jp-games__list').forEach(row => {
    let x0 = 0, s0 = 0, down = false;
    row.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) { down = true; x0 = e.clientX; s0 = row.scrollLeft; } });
    window.addEventListener('pointermove', e => { if (down) row.scrollLeft = s0 - (e.clientX - x0); });
    window.addEventListener('pointerup', () => { down = false; });
  });
})();

// Game tiles (Figma GameIcon). Fills every .games-grid (Raffles, Tournament, Prize Drops sections:
// 8 games repeated over 6 rows of 3) and every jackpot .jp-games__list (Wacky Panda, Thunderstruck,
// 4 Spicy ×2). Static mock data; not interactive beyond scrolling.
(function gamesGrid() {
  const grids = document.querySelectorAll('.games-grid');
  const rows = document.querySelectorAll('.jp-games__list');

  const TILES = {
    wacky: ['wacky-panda', 'Wacky Panda'],
    thunder: ['thunderstruck', 'Thunderstruck Storm Blitz'],
    spicy: ['4-spicy-frienzy', '4 Spicy Frienzy'],
    boom: ['333-boom-banks', '333 Boom Banks King Millions'],
    headless: ['totally-headless', 'Totally Headless'],
    cash: ['cash-court', 'Cash Court'],
    queens: ['queens-of-ra', 'Queens of Ra Rising'],
    mermaids: ['mermaids-millions', 'Mermaids Millions'],
  };
  const ORDER = [
    'wacky', 'thunder', 'spicy',
    'boom', 'headless', 'cash',
    'queens', 'mermaids', 'wacky',
    'wacky', 'thunder', 'spicy',
    'boom', 'headless', 'cash',
    'queens', 'mermaids', 'wacky',
  ];

  const ROW = ['wacky', 'thunder', 'spicy', 'wacky', 'thunder', 'spicy'];

  const tile = key => {
    const [file, name] = TILES[key];
    return `
    <div class="game-tile" role="img" aria-label="${name}">
      <img class="game-tile__bg" src="assets/tiles/${file}-bg.png" alt="">
      <img class="game-tile__logo" src="assets/tiles/${file}-logo.png" alt="">
      <div class="game-tile__info">
        <div class="game-tile__bar">
          <span><img class="icon-user" src="assets/icons/user.svg" alt="Players">999</span>
          <i class="game-tile__divider"><img src="assets/tiles/info-divider.svg" width="14" height="1" alt=""></i>
          <span>94.7%</span>
        </div>
      </div>
    </div>`;
  };
  const gridHTML = ORDER.map(tile).join(''), rowHTML = ROW.map(tile).join('');
  grids.forEach(g => { g.innerHTML = gridHTML; });
  rows.forEach(r => { r.innerHTML = rowHTML; });
})();

// Prize Drops Winners + Tournament Leaderboard: 20 mock rows (Figma 5928:307390 / 5928:306162).
// Lists marked data-ranked get a leading rank column.
(function winnersList() {
  const PRIZES = ['99 000', '88 000', '77 000', '66 000', '55 000', '44 000', '33 000', '22 000', '11 000',
    '9 000', '8 000', '7 000', '6 000', '5 000', '4 000', '3 000', '2 000', '1 000', '500', '400'];
  document.querySelectorAll('.winners__list').forEach(list => {
    const ranked = list.hasAttribute('data-ranked');
    list.innerHTML = PRIZES.map((p, i) =>
      `<div class="winner-row">${ranked ? `<span>${i + 1}</span>` : ''}<span>Player Id #123456</span><span>${p}</span></div>`).join('');
  });
})();

// Game texture picker (right-hand prototype panel). Textures come one by one from the Figma
// "Game" node's fills; add a row here for each new one. Deep link with ?game=<id>.
(function gamePicker() {
  const GAMES = [
    { id: 'bounty-wanted', name: 'Amazing Link Bounty Wanted', src: 'assets/games/amazing-link-bounty-wanted.png' },
    { id: 'gold-blitz-express', name: 'Gold Blitz Express', src: 'assets/games/gold-blitz-express.png' },
    { id: 'blazing-bison', name: 'Blazing Bison Gold Blitz King Millions', src: 'assets/games/blazing-bison-king-millions.png' },
    { id: 'fishing-max', name: 'Fishing Max', src: 'assets/games/fishing-max.png' },
  ];
  const img = document.getElementById('game-texture');
  const group = document.getElementById('game-radios');
  if (!img || !group) return;

  const select = id => {
    const game = GAMES.find(g => g.id === id) || GAMES[0];
    img.src = game.src;
    group.querySelectorAll('input').forEach(r => { r.checked = r.value === game.id; });
  };

  GAMES.forEach(g => {
    const label = document.createElement('label');
    label.className = 'proto-radio';
    label.innerHTML = `<input type="radio" name="game" value="${g.id}"> ${g.name}`;
    label.querySelector('input').addEventListener('change', () => select(g.id));
    group.append(label);
  });

  select(new URLSearchParams(location.search).get('game'));
})();

// Operator theme picker (right-hand panel) → data-theme on the screen; colours live in
// css/tokens.css (--lp-tint-rgb, --lp-section). Deep link with ?theme=1|2|3.
(function themePicker() {
  const screen = document.querySelector('.screen');
  const radios = [...document.querySelectorAll('input[name="theme"]')];
  if (!screen || !radios.length) return;
  const set = n => {
    screen.dataset.theme = n;
    radios.forEach(r => { r.checked = r.value === n; });
  };
  radios.forEach(r => r.addEventListener('change', () => set(r.value)));
  const requested = new URLSearchParams(location.search).get('theme');
  set(['1', '2', '3'].includes(requested) ? requested : '1');
})();

// Tab bar ↔ promo card list: tab i selects card i (one-to-one, same order). Both are carousels:
// selecting a tab moves the highlight and smoothly centres the tab and its card. Either can be
// swiped (touch/trackpad, CSS scroll-snap) or dragged with the mouse; when one settles, its centred
// item is selected and the other follows. The tab bar also steps one tab per mouse-wheel notch.
// The tab marked .tab--active in the markup (Raffles) is selected by default.
(function tabCards() {
  const tabs = [...document.querySelectorAll('.tabbar .tab')];
  const list = document.getElementById('promo-list');
  const strip = document.querySelector('.tabbar__scroll');
  if (!list || !tabs.length) return;
  const cards = [...list.children];
  let title = null, titleText = null, marquee;
  // Full view "Card stack" (Figma "launchpad state3 - alt01" 7197:5672): data-s3="deck" on the screen.
  // The same cards form an endless deck instead of a side-by-side list; no tab bar.
  const scr = document.querySelector('.screen');
  const isDeck = () => scr?.dataset.s3 === 'deck';
  const dots = document.querySelector('.deck-dots');
  cards.forEach(() => dots?.append(document.createElement('i')));
  // Deck position of each card relative to the top one: 0 = top, 1–2 peek out behind it, the rest wait
  // hidden at the back. Swiping always advances, so the old top card becomes the last one.
  const layoutDeck = () => {
    cards.forEach((c, k) => {
      const pos = (k - current + cards.length) % cards.length;
      c.dataset.stack = pos < 3 ? pos : 'hidden';
    });
    dots?.querySelectorAll('i').forEach((d, k) => d.classList.toggle('is-active', k === current));
  };

  // The selected card's title bar: titles too long for it scroll slowly to the end, pause, then
  // quickly fade out, jump back to the start and fade in, pause, and repeat. Only the selected card's
  // title runs; the others rest at the start.
  function setTitle(card) {
    const next = card.querySelector('.card-title__text');
    if (next === title) return;
    marquee?.cancel();
    title?.classList.remove('is-overflowing');
    title = next;
    titleText = title?.querySelector('.card-title__inner');
    fitTitle();
  }
  const SPEED = 30, PAUSE = 1500, FADE = 200;   // px/s, ms, ms
  function fitTitle() {
    if (!title) return;
    marquee?.cancel();
    title.classList.remove('is-overflowing');
    if (titleText.offsetWidth <= title.clientWidth) return;
    title.classList.add('is-overflowing');
    const over = titleText.offsetWidth - title.clientWidth;
    const move = (over / SPEED) * 1000, total = 2 * PAUSE + move + 2 * FADE;
    const at = x => `translateX(${x}px)`;
    let t = 0;
    const k = (x, opacity, dt, easing) => ({ transform: at(x), opacity, offset: (t += dt) / total, ...(easing && { easing }) });
    marquee = titleText.animate([
      k(0, 1, 0),
      k(0, 1, PAUSE, 'ease-in-out'),   // pause at the start, then scroll
      k(-over, 1, move),
      k(-over, 1, PAUSE),              // pause at the end
      k(-over, 0, FADE),               // fade out…
      k(0, 0, 0),                      // …jump back…
      k(0, 1, FADE),                   // …fade in
    ], { duration: total, iterations: Infinity });
  }
  let lastW = 0;   // refit only when the available width changes (not on our own class toggles)
  new ResizeObserver(() => {
    if (list.clientWidth !== lastW) { lastW = list.clientWidth; fitTitle(); }
  }).observe(list);
  document.fonts?.ready.then(fitTitle);

  const cardLeft = i => cards[i].offsetLeft - cards[0].offsetLeft;
  const nearest = () => {
    let best = 0;
    cards.forEach((_, k) => { if (Math.abs(cardLeft(k) - list.scrollLeft) < Math.abs(cardLeft(best) - list.scrollLeft)) best = k; });
    return best;
  };
  let current = -1;

  function select(i, smooth = true, scrollList = true) {
    current = i;
    realigned = false;
    const behavior = smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto';
    tabs.forEach((t, k) => {
      t.classList.toggle('tab--active', k === i);
      if (k === i) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    cards.forEach((c, k) => { c.inert = k !== i; });
    setTitle(cards[i]);
    layoutDeck();
    // Card's left edge lines up with the list's 8px side padding (the deck doesn't scroll)
    if (isDeck()) list.scrollLeft = 0;
    else if (scrollList) list.scrollTo({ left: cardLeft(i), behavior });
    const left = tabCentre(i) - strip.clientWidth / 2;
    if (behavior === 'smooth' && Math.abs(left - strip.scrollLeft) > 1) autoScroll = true;
    strip.scrollTo({ left, behavior });
    markCentre(i);
  }

  // Tab strip carousel. Same pattern as the card list below: settle → select the centred tab
  // (which moves the card list); mouse drag pauses snapping and selects the nearest tab on release.
  const tabCentre = k => tabs[k].offsetLeft + tabs[k].offsetWidth / 2;
  const nearestTab = () => {
    const mid = strip.scrollLeft + strip.clientWidth / 2;
    let best = 0;
    tabs.forEach((_, k) => { if (Math.abs(tabCentre(k) - mid) < Math.abs(tabCentre(best) - mid)) best = k; });
    return best;
  };
  // The enlarged tab (.tab--centre) tracks whichever tab is nearest the centre while the user scrolls
  // the strip, previewing where it will land; it's the selected tab otherwise. Our own glide to a
  // selected tab (autoScroll) doesn't move it, so it doesn't ripple across the tabs passed on the way.
  const markCentre = k => tabs.forEach((t, j) => t.classList.toggle('tab--centre', j === k));
  // Docked: the selected tab joins its card (css .is-docked on the tab bar + that card) while nothing
  // moves. Every scroll of the strip or the card list re-checks: it docks on the very frame both sit
  // on the selected pair (not waiting for scrollend) and undocks otherwise. Never while a finger or
  // the mouse is still dragging, so passing over the start position mid-swipe doesn't flash it.
  const bar = strip.parentElement;
  let touching = false;
  [list, strip].forEach(el => el.addEventListener('pointerdown', () => { touching = true; }));
  ['pointerup', 'pointercancel'].forEach(type => window.addEventListener(type, () => { touching = false; dock(); }));
  const setDocked = on => {
    bar.classList.toggle('is-docked', on);
    cards.forEach((c, k) => c.classList.toggle('is-docked', on && k === current));
  };
  const dock = () => {
    const near = (a, b) => Math.abs(a - b) < 2;
    setDocked(!isDeck() && !touching && !dragging && !stripDrag
      && near(list.scrollLeft, cardLeft(current)) && near(strip.scrollLeft, tabCentre(current) - strip.clientWidth / 2));
  };
  let autoScroll = false;
  // A glide can settle on the selected pair a few px short (the browser re-snaps while tabs resize
  // mid-glide), which also keeps it from docking. Once per selection, glide the rest of the way.
  let realigned = false;
  const realign = () => {
    if (realigned) return;
    const stripLeft = tabCentre(current) - strip.clientWidth / 2;
    const stripOff = Math.abs(strip.scrollLeft - stripLeft) >= 2, listOff = Math.abs(list.scrollLeft - cardLeft(current)) >= 2;
    if (!stripOff && !listOff) return;
    realigned = true;
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (stripOff) { autoScroll = behavior === 'smooth'; strip.scrollTo({ left: stripLeft, behavior }); }
    if (listOff) list.scrollTo({ left: cardLeft(current), behavior });
  };
  let stripDrag = false, stripMoved = false, stripX = 0, stripScroll = 0, stripTimer;
  const settleStrip = () => {
    if (stripDrag || isDeck()) return;   // the strip is hidden in the card stack view
    autoScroll = false;
    const k = nearestTab();
    if (k !== current) select(k); else { markCentre(k); realign(); }
    dock();
  };
  if ('onscrollend' in window) strip.addEventListener('scrollend', settleStrip);
  strip.addEventListener('scroll', () => {
    dock();
    if (!autoScroll) markCentre(nearestTab());
    clearTimeout(stripTimer); stripTimer = setTimeout(settleStrip, 150);
  }, { passive: true });

  strip.addEventListener('pointerdown', e => {
    autoScroll = false;   // the user takes over mid-glide
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    stripDrag = true; stripMoved = false;
    stripX = e.clientX; stripScroll = strip.scrollLeft;
  });
  window.addEventListener('pointermove', e => {
    if (!stripDrag) return;
    const dx = e.clientX - stripX;
    if (!stripMoved && Math.abs(dx) < 4) return;
    if (!stripMoved) { stripMoved = true; strip.classList.add('is-dragging'); }
    strip.scrollLeft = stripScroll - dx;
  });
  const releaseStrip = () => {
    if (!stripDrag) return;
    stripDrag = false;
    if (!stripMoved) return;
    strip.classList.remove('is-dragging');
    select(nearestTab());
  };
  window.addEventListener('pointerup', releaseStrip);
  window.addEventListener('pointercancel', releaseStrip);
  strip.addEventListener('dragstart', e => e.preventDefault());
  // Swallow the click that ends a drag so it doesn't press the tab under the pointer
  strip.addEventListener('click', e => { if (stripMoved) { e.stopPropagation(); e.preventDefault(); stripMoved = false; } }, true);

  // Vertical mouse wheel: one tab per notch (a free scroll would just snap back). Horizontal
  // trackpad scrolls are left to the browser and snap natively.
  let wheelUntil = 0;
  strip.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    if (e.timeStamp < wheelUntil) return;
    wheelUntil = e.timeStamp + 250;
    select(Math.min(tabs.length - 1, Math.max(0, current + Math.sign(e.deltaY))));
  }, { passive: false });

  tabs.forEach((t, i) => t.addEventListener('click', () => { select(i); dock(); }));   // undocks at once if a glide starts
  select(Math.max(0, tabs.findIndex(t => t.classList.contains('tab--active'))), false);
  // Floating Small summary tapped: jump (no glide) to that card before Full opens
  document.addEventListener('lp:show-card', e => {
    const i = cards.findIndex(c => c.id === e.detail);
    if (i >= 0) { select(i, false); dock(); }
  });

  // Cards return to their default state (Main open, every list scrolled back to the start) once out
  // of view: the other cards whenever the list settles on a card, and all cards a moment after the
  // launchpad leaves State 3 (once the collapse has hidden them).
  function resetCard(c) {
    c.dispatchEvent(new Event('promo:reset'));   // accordion → Main (promoAccordion)
    c.querySelectorAll('*').forEach(el => {
      if (el.scrollTop || el.scrollLeft) el.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
  }
  const screen = document.querySelector('.screen');
  let leaveTimer;
  if (screen) new MutationObserver(() => {
    clearTimeout(leaveTimer);
    if (screen.dataset.lpState !== '3') leaveTimer = setTimeout(() => cards.forEach(resetCard), 400);
  }).observe(screen, { attributes: true, attributeFilter: ['data-lp-state'] });

  // Swipe settle → select the centred card's tab/title (list is already snapped there)
  let dragging = false, releasing = false, settleTimer;
  const settle = () => {
    if (dragging || isDeck()) return;
    if (releasing) { releasing = false; list.classList.remove('is-dragging'); }   // re-enable snap after the drag's glide
    const i = nearest();
    if (i !== current) select(i, true, false); else realign();
    dock();
    cards.forEach((c, k) => { if (k !== i) resetCard(c); });
  };
  // scrollend where supported, plus a debounced scroll as a backstop (scrollend isn't in Safari
  // and can be missed); settle() is idempotent, so running twice is harmless.
  if ('onscrollend' in window) list.addEventListener('scrollend', settle);
  list.addEventListener('scroll', () => { dock(); clearTimeout(settleTimer); settleTimer = setTimeout(settle, 150); }, { passive: true });
  dock();   // initial selection: docked from the start

  // Mouse drag (touch/trackpad swipe natively). Snap is paused while dragging; on release we
  // go to the nearest card, or the next one in the drag direction after a > 50px flick.
  let startX = 0, lastX = 0, startScroll = 0, startIndex = 0, moved = false;
  list.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || isDeck()) return;
    if (e.target.closest('.jp-games__list')) return;   // jackpot game rows drag-scroll themselves
    dragging = true; moved = false;
    startX = lastX = e.clientX; startScroll = list.scrollLeft;
    startIndex = nearest();   // the card actually on screen, even if a settle was missed
  });
  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    lastX = e.clientX;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) < 5) return;
    if (!moved) { moved = true; list.classList.add('is-dragging'); }
    list.scrollLeft = startScroll - dx;
  });
  // Release (also on pointercancel, e.g. the browser taking over the gesture): settle on a card.
  // Uses the last pointermove position, since a cancel event carries no useful coordinates.
  const release = () => {
    if (!dragging) return;
    dragging = false;
    if (!moved) return;
    const dx = lastX - startX;
    let i = nearest();
    if (i === startIndex && Math.abs(dx) > 50) i = Math.min(cards.length - 1, Math.max(0, startIndex + (dx < 0 ? 1 : -1)));
    releasing = true;               // snap stays off until this glide ends (settle)
    select(i);
    if (list.scrollLeft === cardLeft(i)) settle();   // already there: no scroll → no scrollend
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  // Stop the browser's native image drag-and-drop (logos, tiles, icons): it would cancel the
  // pointer mid-drag, leaving the carousel with snapping switched off.
  list.addEventListener('dragstart', e => e.preventDefault());
  // Swallow the click that ends a drag so it doesn't open a section or press a button
  list.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);

  // Card stack swipe (touch, pen or mouse); vertical drags are left alone so the card's own lists still
  // scroll. Everything is tied to the drag distance: p = 0 → 1 over half the card width, by transform
  // only (no relayout while dragging). Past the threshold the move completes; shorter drags spring back.
  //   Left:  the top card follows the finger out to the left; the cards underneath move up one place
  //          and the next card's content fades in. The old top card goes to the back of the deck.
  //   Right: the exact reverse. The previous top card (at the back) comes back in from the left;
  //          the top card and the one behind it move down one place, the top card's content is covered
  //          again, and the third card fades out to the back.
  const FLY_MS = 250, THRESHOLD = 80, OFF = 460;   // keep FLY_MS in sync with .is-flying (css)
  let deckDrag = null, flying = false, swallow = false;
  // Deck scales: the cards behind are the full height scaled down to Figma's 12px / 36px insets
  let sy1 = 1, sy2 = 1;
  const measureDeck = () => {
    const h = list.clientHeight;
    if (!h) return;
    sy1 = (h - 24) / h; sy2 = (h - 72) / h;
    list.style.setProperty('--sy1', sy1);
    list.style.setProperty('--sy2', sy2);
  };
  new ResizeObserver(measureDeck).observe(list);
  measureDeck();
  const lerp = (a, b, p) => a + (b - a) * p;
  // Deck positions 0–2 as transforms: horizontal = cards behind to the right (scaled shorter),
  // vertical (data-deck-dir="v") = cards behind below (scaled narrower). Match the css.
  const TX = [0, 10, 20], SY = () => [1, sy1, sy2];
  const TY = [0, 10.667, 21.333], SX = [1, 362 / 386, 314 / 386];
  const between = (from, to, p) => scr.dataset.deckDir === 'v'
    ? `translateY(${lerp(TY[from], TY[to], p)}px) scaleX(${lerp(SX[from], SX[to], p)})`
    : `translateX(${lerp(TX[from], TX[to], p)}px) scaleY(${lerp(SY()[from], SY()[to], p)})`;
  const offLeft = x => `translateX(${x}px) rotate(${x / 33}deg)`;   // the swiped-away card, left of the deck
  const follow = (d, p) => {
    if (d.mode === 'next') {
      if (d.next) { d.next.style.transform = between(1, 0, p); d.next.style.setProperty('--cover', String(1 - p)); }
      if (d.third) d.third.style.transform = between(2, 1, p);
    } else {
      d.prev.style.transform = offLeft(lerp(-OFF, 0, p));
      d.top.style.transform = between(0, 1, p);
      d.top.style.setProperty('--cover', String(p));
      if (d.next) d.next.style.transform = between(1, 2, p);
      if (d.third) d.third.style.opacity = String(1 - p);
    }
  };
  const involved = d => [d.top, d.prev, d.next, d.third].filter(Boolean);
  list.addEventListener('pointerdown', e => {
    if (!isDeck() || flying || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const top = cards[current];
    if (!top.contains(e.target) || e.target.closest('.jp-games__list')) return;
    deckDrag = { top, x: e.clientX, y: e.clientY, dx: 0, active: false };
  });
  window.addEventListener('pointermove', e => {
    if (!deckDrag) return;
    const d = deckDrag, dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx) || cards.length < 4) { deckDrag = null; return; }   // vertical: not a swipe
      d.active = true;
      d.mode = dx < 0 ? 'next' : 'prev';   // direction is fixed for the rest of the drag
      const at = k => cards[(current + k + cards.length) % cards.length];
      d.next = at(1); d.third = at(2);
      if (d.mode === 'next') {
        d.top.classList.add('is-swiping');
        d.next.classList.add('is-revealing');
      } else {
        d.prev = at(-1);
        d.prev.classList.add('is-incoming');
        d.top.classList.add('is-revealing');
      }
      involved(d).forEach(c => c.classList.add('is-following'));
    }
    d.dx = d.mode === 'next' ? Math.min(0, dx) : Math.max(0, dx);
    if (d.mode === 'next') d.top.style.transform = `translateX(${d.dx}px) rotate(${d.dx / 40}deg)`;
    follow(d, Math.min(1, Math.abs(d.dx) / (d.top.offsetWidth / 2)));
  });
  const deckRelease = () => {
    if (!deckDrag) return;
    const d = deckDrag;
    deckDrag = null;
    if (!d.active) return;
    swallow = true;
    const cs = involved(d);
    cs.forEach(c => c.classList.remove('is-following', 'is-swiping'));   // transitions back on for the rest
    const clear = c => { c.style.transform = ''; c.style.opacity = ''; c.style.removeProperty('--cover'); };
    const finish = (after) => setTimeout(() => {
      // Swap the transforms for the real deck positions in one frame (same geometry, no jump)
      cs.forEach(c => { c.classList.add('no-anim'); clear(c); c.classList.remove('is-flying', 'is-revealing', 'is-incoming'); });
      after();
      void d.top.offsetWidth;
      cs.forEach(c => c.classList.remove('no-anim'));
      flying = false;
    }, FLY_MS);
    flying = true;
    if (Math.abs(d.dx) < THRESHOLD) {   // spring back: everything returns to its place
      if (d.mode === 'prev') {   // the incoming card slides back out to the left, then hides again
        d.prev.classList.add('is-flying');
        d.prev.style.transform = offLeft(-OFF);
        [d.top, d.next, d.third].forEach(c => c && clear(c));
        finish(() => {});
      } else {
        cs.forEach(clear);
        d.next.classList.remove('is-revealing');
        flying = false;
      }
      return;
    }
    if (d.mode === 'next') {   // top card flies off left; the old top card goes to the back, hidden
      d.top.classList.add('is-flying');
      d.top.style.transform = offLeft(-OFF);
      follow(d, 1);
      finish(() => { select((current + 1) % cards.length, false); resetCard(d.top); });
    } else {                   // previous card lands on top; the others settle one place down
      d.prev.classList.add('is-flying');
      follow(d, 1);
      d.prev.style.transform = offLeft(0);
      finish(() => { select((current - 1 + cards.length) % cards.length, false); resetCard(d.top); });
    }
  };
  window.addEventListener('pointerup', deckRelease);
  window.addEventListener('pointercancel', deckRelease);
  list.addEventListener('click', e => { if (swallow) { e.stopPropagation(); e.preventDefault(); swallow = false; } }, true);
  list.addEventListener('pointerdown', () => { swallow = false; }, true);

  // Full view option (prototype control, ?s3=deck | deck-v): Tabs (default), Card stack, or Card stack
  // laid out vertically (same deck and swipe, cards behind peek out below)
  const viewRadios = [...document.querySelectorAll('input[name="s3-view"]')];
  const setView = v => {
    if (!scr) return;
    scr.dataset.s3 = v === 'tabs' ? 'tabs' : 'deck';
    scr.dataset.deckDir = v === 'deck-v' ? 'v' : 'h';
    viewRadios.forEach(r => { r.checked = r.value === v; });
    cards.forEach(c => { c.style.transform = ''; c.classList.remove('is-swiping', 'is-flying'); });
    select(current, false);
    dock();
  };
  viewRadios.forEach(r => r.addEventListener('change', () => setView(r.value)));
  const s3Param = new URLSearchParams(location.search).get('s3');
  setView(['deck', 'deck-v'].includes(s3Param) ? s3Param : 'tabs');
})();

// Mobile (≤ 700px): scale the 402px-wide screen to the viewport width and give it an unscaled
// height that fills the viewport once scaled. Prototype controls live in a drawer behind the
// floating ☰ button (closes on outside tap / Escape).
(function mobileLayout() {
  const screen = document.querySelector('.screen');
  const btn = document.getElementById('proto-menu-btn');
  const menu = document.getElementById('proto-menu');
  if (!screen) return;
  const mq = matchMedia('(max-width: 700px)');
  const DESIGN_W = 402;

  function fit() {
    if (mq.matches) {
      const vw = window.innerWidth, vh = window.visualViewport?.height || window.innerHeight;
      const s = vw / DESIGN_W;
      screen.style.setProperty('--fit', s);
      screen.style.height = `${vh / s}px`;
    } else {
      screen.style.removeProperty('--fit');
      screen.style.removeProperty('height');
      setMenu(false);
    }
  }
  window.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);
  mq.addEventListener('change', fit);

  function setMenu(open, instant = false) {
    if (!btn || !menu) return;
    if (instant) {   // skip the slide-out (css .proto-menu.is-instant)
      menu.classList.add('is-instant');
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.remove('is-instant')));
    }
    menu.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
  }
  // Triggers close the drawer at once so their animation on the phone screen can be watched
  menu?.querySelectorAll('[data-closes-menu]').forEach(el => el.addEventListener('click', () => {
    if (menu.classList.contains('is-open')) setMenu(false, true);
  }));
  btn?.addEventListener('click', e => { e.stopPropagation(); setMenu(!menu.classList.contains('is-open')); });
  document.addEventListener('click', e => {
    if (menu?.classList.contains('is-open') && !menu.contains(e.target)) setMenu(false);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  fit();
})();

// Mobile fullscreen: browsers only grant it from a user gesture, so a "tap to go fullscreen"
// overlay covers the page on touch devices in mobile view, and comes back if fullscreen is exited
// (back gesture etc.). Skipped where the API is missing (iPhone Safari) or when already launched
// from the Home Screen without browser bars.
(function mobileFullscreen() {
  const prompt = document.getElementById('fs-prompt');
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!prompt || !request) return;
  const mq = matchMedia('(max-width: 700px) and (pointer: coarse)');
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)');
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

  function sync() { prompt.hidden = !mq.matches || standalone.matches || isFull(); }

  prompt.addEventListener('click', () => {
    prompt.hidden = true;
    try {
      const p = request.call(root, { navigationUI: 'hide' });
      p?.catch?.(sync);
    } catch { sync(); }
  });
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  mq.addEventListener('change', sync);
  sync();
})();
