/* HONEY Motion — site-wide motion behaviour (no library). Speeds, curves and glass come from assets/css/motion.css.
   Everything here is optional polish: if this file fails or the visitor prefers reduced motion, the site works and
   looks complete without it. Content-specific motion (product grid filters, gallery) lives in app.js and uses
   window.HM from this file.

   What it does
   - logo intro on the first page of a visit
   - glass pill that follows the pointer in the desktop menu
   - soft light that follows the pointer on cards and glass ([data-glow]); hero photos tilt toward the pointer
   - catalog covers tilt like a booklet
   - numbers count up once when they come into view
   - sliding indicator for the section chips on the products page
   - swipe gestures: phone menu (swipe up) and share sheet (drag down) close naturally
   - page transitions: the product photo travels from its card to the product page and back (View Transitions) */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const mq = (q) => window.matchMedia(q);
  const reducedMQ = mq("(prefers-reduced-motion: reduce)");
  const fineMQ = mq("(hover: hover) and (pointer: fine)");
  const reduced = () => reducedMQ.matches;
  const fine = () => fineMQ.matches;
  const page = document.body.dataset.page;
  const store = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} }, del: (k) => { try { sessionStorage.removeItem(k); } catch (e) {} } };
  /* read a duration token from motion.css, e.g. dur("--d-gentle") -> 480 */
  const dur = (name, fallback = 300) => { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); const n = parseFloat(v); return isNaN(n) ? fallback : (v.endsWith("s") && !v.endsWith("ms") ? n * 1000 : n); };
  const ease = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "ease";
  /* one rAF-throttled pointer handler per element type keeps pointer effects cheap */
  const rafThrottle = (fn) => { let q = null, a; return (...args) => { a = args; if (q) return; q = requestAnimationFrame(() => { q = null; fn(...a); }); }; };
  window.HM = { reduced, fine, dur, ease };

  /* ---------- logo intro: first page of the visit only, never blocks anything ---------- */
  const header = $(".site-header");
  if (header && !reduced() && !store.get("honey:intro")) {
    store.set("honey:intro", "1");
    header.classList.add("intro");
    setTimeout(() => header.classList.remove("intro"), 2500);
  }

  /* ---------- desktop menu: a glass pill glides under the pointer and rests on the current page ---------- */
  const nav = $(".nav"), menu = $("#menu");
  if (nav && menu) {
    const ind = document.createElement("span");
    ind.className = "menu-ind"; ind.setAttribute("aria-hidden", "true");
    nav.appendChild(ind);
    const current = () => $('a[aria-current="page"]', menu);
    const place = (a, instant) => {
      if (!a || window.innerWidth <= 900) { ind.classList.remove("on"); return; }
      const n = nav.getBoundingClientRect(), r = a.getBoundingClientRect();
      if (instant) { ind.style.transition = "none"; requestAnimationFrame(() => (ind.style.transition = "")); }
      ind.style.setProperty("--x", (r.left - n.left) + "px");
      ind.style.setProperty("--w", r.width + "px");
      ind.classList.add("on");
    };
    const rest = () => place(current());
    menu.classList.add("has-ind");
    menu.addEventListener("pointerover", (e) => { const a = e.target.closest("a"); if (a) place(a); });
    menu.addEventListener("focusin", (e) => { const a = e.target.closest("a"); if (a) place(a); });
    menu.addEventListener("pointerleave", rest);
    menu.addEventListener("focusout", (e) => { if (!menu.contains(e.relatedTarget)) rest(); });
    const init = () => place(current(), true);
    window.addEventListener("resize", rafThrottle(init));
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(init);
    init();
  }

  /* ---------- pointer light on cards and glass, depth on photos (desktop with a mouse only) ---------- */
  const light = rafThrottle((el, e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
    el.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
    if (el.classList.contains("card")) { // the photo leans very slightly toward the pointer
      el.style.setProperty("--px", ((x - .5) * -8).toFixed(1) + "px");
      el.style.setProperty("--py", ((y - .5) * -6).toFixed(1) + "px");
    }
  });
  document.addEventListener("pointermove", (e) => {
    if (!fine() || reduced() || e.pointerType !== "mouse") return;
    const el = e.target.closest && e.target.closest(".card, [data-glow]");
    if (el) light(el, e);
  }, { passive: true });

  /* hero: the photo composition tilts toward the pointer (max 3°); the warm glow pauses when the hero is off screen */
  const hero = $(".hero"), art = $(".hero-art");
  if (hero && art) {
    const tilt = rafThrottle((e) => {
      const r = hero.getBoundingClientRect();
      art.style.setProperty("--tx", (((e.clientX - r.left) / r.width - .5) * -6).toFixed(2) + "deg");
      art.style.setProperty("--ty", (((e.clientY - r.top) / r.height - .5) * 4).toFixed(2) + "deg");
    });
    hero.addEventListener("pointermove", (e) => { if (fine() && !reduced() && e.pointerType === "mouse") tilt(e); }, { passive: true });
    hero.addEventListener("pointerleave", () => { art.style.setProperty("--tx", "0deg"); art.style.setProperty("--ty", "0deg"); });
    if ("IntersectionObserver" in window) new IntersectionObserver(([en]) => hero.classList.toggle("paused", !en.isIntersecting)).observe(hero);
  }

  /* catalog covers: tilt like a booklet held in the hand */
  $$(".cat-main .cv, .cat-item .cv").forEach((cv) => {
    const book = $(".book", cv); if (!book) return;
    const host = cv.closest(".cat-main, .cat-item");
    const move = rafThrottle((e) => {
      const r = book.getBoundingClientRect();
      book.style.setProperty("--tx", (((e.clientX - r.left) / r.width - .5) * 14).toFixed(2) + "deg");
      book.style.setProperty("--ty", (((e.clientY - r.top) / r.height - .5) * -10).toFixed(2) + "deg");
    });
    host.addEventListener("pointermove", (e) => { if (fine() && !reduced() && e.pointerType === "mouse") move(e); }, { passive: true });
    host.addEventListener("pointerleave", () => { book.style.setProperty("--tx", "0deg"); book.style.setProperty("--ty", "0deg"); });
  });

  /* ---------- numbers count up once when they come into view (the real number is already in the page) ---------- */
  const counters = $$("[data-count]");
  if (counters.length && !reduced() && "IntersectionObserver" in window) {
    const run = (el) => {
      const end = parseInt(el.dataset.count, 10); if (!(end > 1)) return;
      const t0 = performance.now(), d = 1200;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / d), v = 1 - Math.pow(1 - k, 4);
        el.textContent = String(Math.round(end * v));
        if (k < 1) requestAnimationFrame(step); else el.textContent = String(end);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); run(en.target); } }), { threshold: .6 });
    counters.forEach((el) => io.observe(el));
  }

  /* ---------- section chips (products page): the dark pill glides to the chosen section ---------- */
  const chips = $("#chips");
  if (chips) {
    const ind = document.createElement("span");
    ind.className = "chip-ind"; ind.setAttribute("aria-hidden", "true");
    let first = true;
    const update = () => {
      const on = $('.chip[aria-pressed="true"]', chips); if (!on) return;
      if (!ind.isConnected) chips.prepend(ind);
      chips.classList.add("has-ind");
      if (first || reduced()) { ind.style.transition = "none"; requestAnimationFrame(() => requestAnimationFrame(() => (ind.style.transition = ""))); first = false; }
      ind.style.setProperty("--x", on.offsetLeft + "px");
      ind.style.setProperty("--w", on.offsetWidth + "px");
      ind.style.top = on.offsetTop + "px"; ind.style.height = on.offsetHeight + "px";
    };
    new MutationObserver(update).observe(chips, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-pressed"] });
    window.addEventListener("resize", rafThrottle(() => { first = true; update(); }));
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { first = true; update(); });
    update();
  }

  /* ---------- gestures ---------- */
  // phone menu: swipe up on the open menu closes it
  if (menu) {
    let y0 = null;
    menu.addEventListener("touchstart", (e) => { y0 = menu.classList.contains("open") ? e.touches[0].clientY : null; }, { passive: true });
    menu.addEventListener("touchmove", (e) => {
      if (y0 === null) return;
      if (y0 - e.touches[0].clientY > 50) { y0 = null; const b = $(".menu-btn"); if (b && b.getAttribute("aria-expanded") === "true") b.click(); }
    }, { passive: true });
  }
  // share sheet: drag down from the top of the panel to close (phones)
  const sheetPanel = $("#share-sheet .panel");
  if (sheetPanel) {
    let y0 = null, dy = 0;
    sheetPanel.addEventListener("touchstart", (e) => {
      const t = e.touches[0], r = sheetPanel.getBoundingClientRect();
      y0 = (t.clientY - r.top < 56 || e.target.closest(".grab, h2")) ? t.clientY : null; dy = 0;
    }, { passive: true });
    sheetPanel.addEventListener("touchmove", (e) => {
      if (y0 === null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      sheetPanel.classList.add("dragging"); sheetPanel.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    sheetPanel.addEventListener("touchend", () => {
      if (y0 === null) return; y0 = null;
      sheetPanel.classList.remove("dragging");
      if (dy > 90) { // closes from where the finger left it
        const b = $("#share-sheet .backdrop"); if (b) b.click();
        setTimeout(() => (sheetPanel.style.transform = ""), dur("--d-base") + 60); return;
      }
      sheetPanel.classList.add("settle"); sheetPanel.style.transform = "";
      setTimeout(() => sheetPanel.classList.remove("settle"), dur("--d-base"));
    });
  }

  /* ---------- page transitions: the product photo travels between card and product page ----------
     Chrome/Edge (and Safari 18.2+) run cross-document View Transitions; elsewhere pages simply load. */
  const VT = "prod-media";
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight; };
  const named = [];
  const nameIt = (el) => { el.style.viewTransitionName = VT; named.push(el); };
  const clear = () => { while (named.length) named.pop().style.viewTransitionName = ""; };
  const cardFor = (id) => { const a = $$("a.card").find((x) => x.dataset.id === id && inView(x)); return a && $(".ph", a); };
  window.addEventListener("pageswap", (e) => {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    let url; try { url = new URL(e.activation.entry.url); } catch (_) { return; }
    const toProduct = /product\.html$/.test(url.pathname);
    const here = new URLSearchParams(location.search).get("id");
    let el = toProduct ? cardFor(url.searchParams.get("id")) : null;
    if (!el && page === "product") { const z = $(".zoom"); if (z && inView(z)) el = z; }
    if (!el) return;
    nameIt(el);
    store.set("honey:vt", JSON.stringify({ id: toProduct ? url.searchParams.get("id") : here, t: Date.now() }));
    e.viewTransition.finished.finally(clear);
  });
  window.addEventListener("pagereveal", (e) => {
    if (!e.viewTransition) return;
    document.documentElement.classList.add("vt-in");   // the old page fades into this one: skip the page-rise
    let s = null; try { s = JSON.parse(store.get("honey:vt") || "null"); } catch (_) {}
    store.del("honey:vt");
    if (!s || Date.now() - s.t > 5000) return;
    const el = page === "product" ? (new URLSearchParams(location.search).get("id") === s.id ? $(".zoom") : null) : cardFor(s.id);
    if (!el) return;
    nameIt(el);
    e.viewTransition.finished.finally(clear);
  });
})();
