/* Sellbird mobile nav (≤900px): the section nav lives in an off-canvas drawer.
   A hamburger toggle opens it; swiping right from the left screen edge opens it
   too, swiping left closes. Progressive enhancement — the button alone is
   enough. No dependencies; loaded after app.js. */
(function () {
  'use strict';

  var nav = document.getElementById('main-nav');
  var toggle = document.getElementById('menu-toggle');
  var scrim = document.getElementById('nav-scrim');
  var lock = document.getElementById('lock-screen');
  if (!nav || !toggle || !scrim) return;

  var mq = window.matchMedia('(max-width: 900px)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  var EDGE = 28;    // px from the left screen edge where an open-swipe may start
  var COMMIT = 56;  // px of horizontal travel that commits the gesture
  var SLANT = 1.2;  // horizontal must dominate vertical by this factor
  var SLOP = 12;    // px of travel before the gesture is claimed

  function open() { return document.body.classList.contains('nav-open'); }

  function setOpen(shouldOpen) {
    document.body.classList.toggle('nav-open', shouldOpen);
    toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    toggle.setAttribute('aria-label', shouldOpen ? 'Close menu' : 'Open menu');
    if ('inert' in nav) nav.inert = mq.matches && !shouldOpen;
  }

  // Flip the class first, drop the inline transform on the next frame: the CSS
  // transition then picks up from the drag position instead of jumping.
  function settle(shouldOpen) {
    setOpen(shouldOpen);
    requestAnimationFrame(clearDrag);
  }

  function clearDrag() {
    nav.classList.remove('dragging');
    nav.style.transform = '';
  }

  toggle.addEventListener('click', function () { setOpen(!open()); });
  scrim.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open()) setOpen(false);
  });
  // Choosing a section closes the drawer.
  nav.addEventListener('click', function (e) {
    if (e.target.closest('button')) setOpen(false);
  });

  // A swipe that ends as a drag must not become a click on a nav button.
  var swallowClick = false;
  nav.addEventListener('click', function (e) {
    if (!swallowClick) return;
    e.stopPropagation();
    e.preventDefault();
    swallowClick = false;
  }, true);

  // Don't steal the opening swipe from a horizontally scrollable element.
  function inHScroll(el) {
    while (el instanceof Element) {
      var ox = getComputedStyle(el).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1) return true;
      el = el.parentElement;
    }
    return false;
  }

  var gesture = null; // {mode, startX, startY, dx, claimed}

  function begin(mode, t) {
    gesture = { mode: mode, x: t.clientX, y: t.clientY, dx: 0, claimed: false };
  }

  function follow(e) {
    if (!gesture) return;
    var dx = e.touches[0].clientX - gesture.x;
    var dy = e.touches[0].clientY - gesture.y;
    gesture.dx = dx;
    if (!gesture.claimed) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      var wrongWay = gesture.mode === 'open' ? dx <= 0 : dx >= 0;
      if (wrongWay || Math.abs(dy) > Math.abs(dx) * SLANT) { gesture = null; return; }
      gesture.claimed = true;
      nav.classList.add('dragging');
    }
    e.preventDefault(); // the gesture is horizontal now: no page/drawer scroll
    if (reduced.matches) return; // state flip only, no finger-follow
    var w = nav.offsetWidth;
    var x = gesture.mode === 'open' ? Math.min(0, -w + dx) : Math.max(-w, Math.min(0, dx));
    nav.style.transform = 'translateX(' + x + 'px)';
  }

  function end() {
    if (!gesture) return;
    var g = gesture;
    gesture = null;
    if (!g.claimed) return; // a tap: let the click through
    swallowClick = true;
    setTimeout(function () { swallowClick = false; }, 50);
    var stayOpen = g.mode === 'open' ? g.dx >= COMMIT : g.dx > -COMMIT;
    settle(stayOpen);
  }

  document.addEventListener('touchstart', function (e) {
    if (!mq.matches || open()) return; // the closing swipe is nav's own listener
    if (e.touches.length !== 1) return;
    if (lock && lock.style.display !== 'none') return;
    var t = e.touches[0];
    if (t.clientX > EDGE) return;
    if (inHScroll(e.target)) return;
    begin('open', t);
  }, { passive: true });

  nav.addEventListener('touchstart', function (e) {
    if (!mq.matches || !open() || e.touches.length !== 1) return;
    begin('close', e.touches[0]);
  }, { passive: true });

  document.addEventListener('touchmove', follow, { passive: false });
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', function () {
    if (gesture) { gesture = null; clearDrag(); }
  });

  mq.addEventListener('change', function () { setOpen(false); clearDrag(); });

  // Theme: on phones the 3-choice switch collapses into one cycling button
  // (same setTheme() as the desktop buttons, so the choice stays shared in
  // localStorage and both UIs always agree).
  var cycle = document.getElementById('theme-cycle');
  if (cycle) {
    var THEME_ORDER = ['auto', 'light', 'dark'];
    var THEME_ICONS = { auto: '#i-monitor', light: '#i-sun', dark: '#i-moon' };
    function currentTheme() {
      try { return localStorage.getItem('sellbird-theme') || 'auto'; }
      catch (e) { return 'auto'; }
    }
    function paintCycle() {
      var t = currentTheme();
      var use = cycle.querySelector('use');
      if (use) use.setAttribute('href', THEME_ICONS[t] || THEME_ICONS.auto);
      var label = 'Theme: ' + t + ' (tap to switch)';
      cycle.setAttribute('aria-label', label);
      cycle.title = label;
    }
    cycle.addEventListener('click', function () {
      var next = THEME_ORDER[(THEME_ORDER.indexOf(currentTheme()) + 1) % THEME_ORDER.length];
      if (typeof setTheme === 'function') setTheme(next);
      paintCycle();
    });
    // Sync when the theme changes from the desktop switch (e.g. after rotate).
    document.querySelectorAll('[data-theme-opt]').forEach(function (b) {
      b.addEventListener('click', function () { setTimeout(paintCycle, 0); });
    });
    paintCycle();
  }

  setOpen(false); // initial state: closed, inert on mobile only
})();
