/* HONEY website v2 — vanilla JS, no dependencies. Data: window.HONEY (assets/data/site-data.js, generated).
   Motion: CSS transitions + Web Animations API only; all of it is skipped when the visitor prefers reduced motion. */
(function () {
  "use strict";
  const D = window.HONEY || { products: [], categories: [], catalogs: [], settings: {} };
  const S = D.settings || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cat = (id) => D.categories.find((c) => c.id === id) || {};
  const catName = (id) => cat(id).name_ar || "";
  const catalogById = (id) => D.catalogs.find((k) => k.id === id);
  // ?v=<file fingerprint>: view/share always get the latest PDF, never an old copy kept by the browser or WhatsApp
  const catHref = (k) => k.href + (k.v ? "?v=" + k.v : "");
  const byOrder = (a, b) => a.order - b.order || a.id.localeCompare(b.id);
  const page = document.body.dataset.page;
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isLocal = location.protocol === "file:" || /^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(location.hostname);
  const absUrl = (path) => { try { return new URL(path, S.website && S.website.base_url ? S.website.base_url : location.href).href; } catch (e) { return path; } };
  const ICON = (d) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    phone: ICON('<path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 006.5 6.5l1.3-2 4 1.5v2.6a2 2 0 01-2.2 2A16.5 16.5 0 014.6 5.7a2 2 0 012-2.2z"/>'),
    share: ICON('<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="M8.7 10.8l6.6-4M8.7 13.2l6.6 4"/>'),
    book: ICON('<path d="M4.5 5.5A2 2 0 016.5 3.5h12v15h-12a2 2 0 00-2 2zM4.5 20.5v-15M8.5 7.5h6"/>'),
    back: ICON('<path d="M9 6l6 6-6 6"/>'),
    zoom: ICON('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5"/>'),
  };

  /* ---------- Arabic-aware search normalisation ---------- */
  const norm = (s) => String(s || "").toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/\s+/g, " ").trim();
  const matches = (p, q) => !q || q.split(" ").every((w) => norm(p.name).includes(w) || norm(p.id).includes(w) || norm(p.name_en).includes(w) || norm(catName(p.category)).includes(w));

  /* ---------- small helpers ---------- */
  const toastEl = $("#toast"); let toastT;
  const toast = (msg) => { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("show"), 2200); };
  const copyText = async (txt) => {
    try { await navigator.clipboard.writeText(txt); return true; } catch (e) {
      const ta = document.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok;
    }
  };

  /* ---------- header, menu, scroll state ---------- */
  const menuBtn = $(".menu-btn"), menu = $("#menu"), header = $(".site-header"), bar = $(".actionbar");
  const setMenu = (open) => { if (!menuBtn) return; menuBtn.setAttribute("aria-expanded", String(open)); menu.classList.toggle("open", open); };
  if (menuBtn) menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    header && header.classList.toggle("scrolled", y > 8);
    if (bar) bar.classList.toggle("hide", y > lastY + 4 && y > 240);
    if (bar && y < lastY - 4) bar.classList.remove("hide");
    lastY = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---------- images ---------- */
  const pictureSet = (set, alt, sizes, eager = false, big = false) => {
    const t = set.thumb, w = set.web;
    return `<picture>${t.avif && w.avif ? `<source type="image/avif" srcset="${t.avif} 640w, ${w.avif} 1600w" sizes="${sizes}">` : ""}` +
      `${t.webp && w.webp ? `<source type="image/webp" srcset="${t.webp} 640w, ${w.webp} 1600w" sizes="${sizes}">` : ""}` +
      `<img src="${big ? w.jpg : t.jpg}" alt="${esc(alt)}" width="1600" height="1200" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture>`;
  };
  const picture = (p, sizes, eager = false, big = false) => pictureSet(p.img, p.name, sizes, eager, big);

  /* ---------- self-healing + error reporting ----------
     A photo that fails (e.g. weak mobile connection) is retried once; if it still fails, or a script error
     happens, a short anonymous report is sent to the HONEY server (if the site is served by it) so the
     problem appears in the admin panel. Nothing personal is sent. */
  let reports = 0;
  const report = (type, msg, src) => {
    if (!/^https?:$/.test(location.protocol) || reports++ > 5 || (S.website && S.website.telemetry === false)) return;
    const body = JSON.stringify({ type, msg: String(msg || "").slice(0, 300), src: String(src || "").slice(0, 300), page: location.pathname + location.search });
    try { navigator.sendBeacon ? navigator.sendBeacon("/api/telemetry", new Blob([body], { type: "application/json" })) : fetch("/api/telemetry", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }); } catch (e) {}
  };
  window.addEventListener("error", (e) => {
    const t = e.target;
    if (t && t.tagName === "IMG") {
      if (!t.dataset.retried) {
        t.dataset.retried = "1";
        setTimeout(() => { const pic = t.closest("picture"); if (pic) $$("source", pic).forEach((s) => s.remove()); t.src = t.getAttribute("src") + (t.getAttribute("src").includes("?") ? "&" : "?") + "retry=1"; }, 900);
        return;
      }
      report("image", "image failed after retry", t.getAttribute("src"));
    } else if (e.message) {
      report("js", e.message, (e.filename || "") + ":" + (e.lineno || ""));
    }
  }, true);
  window.addEventListener("unhandledrejection", (e) => report("js", (e.reason && e.reason.message) || e.reason, "promise"));
  const watchImages = (root = document) => $$(".ph:not(.loaded)", root).forEach((ph) => {
    const img = $("img", ph); if (!img) return;
    const done = () => ph.classList.add("loaded");
    if (img.complete && img.naturalWidth) done(); else { img.addEventListener("load", done, { once: true }); img.addEventListener("error", done, { once: true }); }
  });
  const GRID_SIZES = "(max-width: 640px) 50vw, (max-width: 1200px) 33vw, 300px";
  const card = (p) => `<a class="card" href="product.html?id=${encodeURIComponent(p.id)}" data-id="${esc(p.id)}">
      <div class="ph">${picture(p, GRID_SIZES)}</div>
      <div class="body"><div><h3>${esc(p.name)}</h3><div class="meta">${esc(catName(p.category))}</div></div>
      <span class="ref" aria-label="الرقم المرجعي">${esc(p.id)}</span></div></a>`;

  /* ---------- reveal: only things that start below the fold are hidden, so nothing is ever stuck invisible ---------- */
  const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    let i = 0;
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target; io.unobserve(el);
      el.style.transitionDelay = Math.min(i++ * 70, 350) + "ms";
      el.classList.add("revealed"); el.classList.remove("will-reveal");
      setTimeout(() => (el.style.transitionDelay = ""), 1200);
    });
  }, { rootMargin: "0px 0px -6% 0px" }) : null;
  const reveal = (root = document) => {
    if (!io || reduced()) return;
    const vh = window.innerHeight;
    $$("[data-reveal]:not(.revealed):not(.will-reveal), .grid > .card:not(.revealed):not(.will-reveal)", root).forEach((el) => {
      if (el.getBoundingClientRect().top > vh * 0.92) { el.classList.add("will-reveal"); io.observe(el); }
    });
  };

  /* ---------- search layer ---------- */
  const layer = $("#search-layer"), sq = $("#sq"), sres = $("#search-results"), shint = $("#search-hint");
  let lastFocus = null;
  const openSearch = () => {
    if (!layer || !layer.hidden) return;
    lastFocus = document.activeElement; setMenu(false);
    layer.hidden = false; layer.classList.remove("closing"); layer.classList.add("open");
    $$("[data-search-open]").forEach((b) => b.setAttribute("aria-expanded", "true"));
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(() => { sq.focus(); sq.select(); });
  };
  const closeSearch = () => {
    if (!layer || layer.hidden) return;
    $$("[data-search-open]").forEach((b) => b.setAttribute("aria-expanded", "false"));
    const finish = () => { layer.hidden = true; layer.classList.remove("open", "closing"); document.documentElement.style.overflow = ""; lastFocus && lastFocus.focus(); };
    if (reduced()) return finish();
    layer.classList.add("closing"); setTimeout(finish, 180);
  };
  const runSearch = () => {
    const q = norm(sq.value);
    if (!q) { sres.innerHTML = ""; shint.textContent = "اكتب اسم صنف أو رقمه المرجعي. اضغط Enter لعرض كل النتائج."; return; }
    const list = D.products.filter((p) => matches(p, q));
    sres.innerHTML = list.slice(0, 8).map((p) => `<li><a href="product.html?id=${encodeURIComponent(p.id)}"><img src="${p.img.thumb.jpg}" alt="" width="64" height="48" loading="lazy">
      <span><b>${esc(p.name)}</b><small>${esc(catName(p.category))} · <span class="ltr">${esc(p.id)}</span></small></span></a></li>`).join("");
    shint.textContent = list.length ? (list.length > 8 ? `${list.length} نتيجة — اضغط Enter لعرضها كلها.` : `${list.length} نتيجة`) : "لا توجد نتائج مطابقة. جرّب كلمة أخرى.";
  };
  if (layer) {
    $$("[data-search-open]").forEach((b) => b.addEventListener("click", openSearch));
    $$("[data-search-close]", layer).forEach((b) => b.addEventListener("click", closeSearch));
    let t; sq.addEventListener("input", () => { clearTimeout(t); t = setTimeout(runSearch, 90); });
    layer.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
      if (e.key === "Tab") { // keep focus inside the dialog
        const f = $$("input, button, a[href]", $(".search-panel", layer)).filter((x) => x.offsetParent);
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }
  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "");
    if (e.key === "/" && !typing && layer && layer.hidden) { e.preventDefault(); openSearch(); }
    if (e.key === "Escape" && menu && menu.classList.contains("open")) { setMenu(false); menuBtn.focus(); }
  });

  /* ---------- share sheet ---------- */
  const sheet = $("#share-sheet"), smsg = $("#share-msg"), swa = $("#share-wa"), snote = $("#share-note"), snative = $("[data-share-native]");
  let shareCtx = null;
  const openSheet = (ctx) => {
    shareCtx = ctx;
    $("#share-title").textContent = ctx.title;
    smsg.value = ctx.text + "\n" + ctx.url;
    const updWa = () => (swa.href = "https://wa.me/?text=" + encodeURIComponent(smsg.value));
    updWa(); smsg.oninput = updWa;
    snative.hidden = !navigator.share;
    snote.hidden = !isLocal;
    if (isLocal) snote.textContent = ctx.file
      ? "أنت تتصفح نسخة محلية: الرابط لن يفتح لدى العملاء قبل نشر الموقع. لإرسال الكتالوج الآن استخدم «مشاركة» على الهاتف (يرسل ملف PDF نفسه إن أمكن) أو أرسل الملف من مجلد 07_Digital_Catalogs."
      : "أنت تتصفح نسخة محلية: الرابط لن يفتح لدى العملاء قبل نشر الموقع على الإنترنت.";
    sheet.classList.add("open"); sheet.setAttribute("aria-hidden", "false");
    lastFocus = document.activeElement; setTimeout(() => (snative.hidden ? swa : snative).focus(), 30);
  };
  const closeSheet = () => { sheet.classList.remove("open"); sheet.setAttribute("aria-hidden", "true"); lastFocus && lastFocus.focus(); };
  const nativeShare = async (ctx, msgText) => {
    // a catalog is shared as the PDF file itself when the device allows it (WhatsApp then receives the file)
    if (ctx.file && navigator.canShare) {
      try {
        const blob = await (await fetch(ctx.file)).blob();
        const f = new File([blob], ctx.fileName || "HONEY.pdf", { type: "application/pdf" });
        if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: ctx.title, text: msgText }); return true; }
      } catch (e) { if (e && e.name === "AbortError") return true; }
    }
    try { await navigator.share({ title: ctx.title, text: ctx.text, url: ctx.url }); return true; } catch (e) { return e && e.name === "AbortError"; }
  };
  if (sheet) {
    $$("[data-sheet-close]", sheet).forEach((b) => b.addEventListener("click", closeSheet));
    sheet.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
    snative.addEventListener("click", async () => {
      snative.setAttribute("aria-busy", "true");
      const ok = await nativeShare(shareCtx, smsg.value); snative.removeAttribute("aria-busy");
      if (!ok) toast("تعذّرت المشاركة من هذا المتصفح، استخدم واتساب أو النسخ.");
    });
    $("[data-share-copy]", sheet).addEventListener("click", async () => toast((await copyText(smsg.value)) ? "تم نسخ الرسالة" : "تعذّر النسخ"));
  }
  const share = (ctx) => openSheet(ctx);
  const shareCatalog = (id) => {
    const k = catalogById(id); if (!k) return;
    const base = (S.share && S.share.message_ar) || "كتالوج حلويات HONEY:";
    const text = k.main ? base : `${k.title} من حلويات HONEY. تصفّحه من هنا:`;
    share({ title: `مشاركة ${k.title}`, text, url: absUrl(catHref(k)), file: catHref(k), fileName: k.file_name });
  };
  document.addEventListener("click", async (e) => {
    const sc = e.target.closest("[data-share-catalog]"); if (sc) { e.preventDefault(); shareCatalog(sc.dataset.shareCatalog); return; }
    const cp = e.target.closest("[data-copy]"); if (cp) { toast((await copyText(cp.dataset.copy)) ? "تم نسخ الرقم" : "تعذّر النسخ"); return; }
    const cf = e.target.closest("[data-copy-from]");
    if (cf) {
      const k = D.catalogs.find((x) => x.main); const txt = $("#" + cf.dataset.copyFrom).value.trim() + (k ? "\n" + absUrl(catHref(k)) : "");
      toast((await copyText(txt)) ? "تم نسخ الرسالة مع الرابط" : "تعذّر النسخ");
    }
  });

  /* ---------- remember the last product listing for «العودة إلى النتائج» ---------- */
  const store = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} } };

  /* ---------- pages ---------- */
  const pages = {
    home() {
      const g = $("#featured"); if (!g) return;
      const picks = D.categories.flatMap((c) => D.products.filter((p) => p.category === c.id && p.id !== c.cover).sort((a, b) => (b.featured - a.featured) || byOrder(a, b)).slice(0, 2));
      g.innerHTML = picks.map(card).join(""); watchImages(g);
    },

    products() {
      const params = new URLSearchParams(location.search);
      const valid = (c) => c === "all" || D.categories.some((x) => x.id === c);
      const state = { q: params.get("q") || "", cat: valid(params.get("cat") || "all") ? (params.get("cat") || "all") : "all", sort: params.get("sort") || "default" };
      const input = $("#q"), sortSel = $("#sort"), chips = $("#chips"), grid = $("#grid"), count = $("#count"), empty = $("#empty"), acts = $("#cat-actions");
      chips.innerHTML = [`<button class="chip" type="button" data-cat="all">الكل<span class="n">${D.products.length}</span></button>`]
        .concat(D.categories.map((c) => `<button class="chip" type="button" data-cat="${esc(c.id)}">${esc(c.name_ar)}<span class="n">${c.count}</span></button>`)).join("");
      input.value = state.q; sortSel.value = state.sort;
      let anims = [];
      const draw = (list) => {
        const grouped = state.cat === "all" && state.sort === "default" && !state.q;
        grid.innerHTML = grouped
          ? D.categories.map((c) => { const items = list.filter((p) => p.category === c.id); return items.length ? `<div class="group-head"><h2>${esc(c.name_ar)}<small>${items.length} صنفاً</small></h2><a class="link-more" href="products.html?cat=${esc(c.id)}">عرض القسم</a></div>` + items.map(card).join("") : ""; }).join("")
          : list.map(card).join("");
        grid.hidden = !list.length; empty.hidden = !!list.length; watchImages(grid);
      };
      const render = (animate) => {
        const q = norm(state.q);
        const list = D.products.filter((p) => (state.cat === "all" || p.category === state.cat) && matches(p, q));
        const coll = new Intl.Collator("ar");
        if (state.sort === "az") list.sort((a, b) => coll.compare(a.name, b.name));
        else if (state.sort === "za") list.sort((a, b) => coll.compare(b.name, a.name));
        else list.sort((a, b) => D.categories.findIndex((c) => c.id === a.category) - D.categories.findIndex((c) => c.id === b.category) || byOrder(a, b));
        // header text follows the chosen section
        const c = cat(state.cat);
        $("#list-title").textContent = state.cat === "all" ? "جميع منتجات HONEY" : c.name_ar;
        $("#list-lead").textContent = state.cat === "all" ? "ابحث باسم الصنف أو برقمه المرجعي، واختر القسم الذي تريده." : c.description;
        document.title = (state.cat === "all" ? "المنتجات" : c.name_ar) + " — حلويات HONEY";
        count.textContent = list.length ? `${list.length} من ${state.cat === "all" ? D.products.length : c.count} صنفاً` : "";
        const k = state.cat !== "all" && c.catalog ? catalogById(c.catalog) : null;
        acts.innerHTML = state.cat === "all" ? "" :
          `${k ? `<a class="link-more" href="${esc(catHref(k))}" target="_blank" rel="noopener">${IC.book} كتالوج القسم</a>&nbsp;&nbsp;` : ""}<button class="link-more" type="button" data-share-section style="border:0;background-color:transparent;cursor:pointer">${IC.share} مشاركة القسم</button>`;
        $$(".chip", chips).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === state.cat)));
        input.parentElement.classList.toggle("has-value", !!state.q);
        const u = new URLSearchParams();
        if (state.q) u.set("q", state.q); if (state.cat !== "all") u.set("cat", state.cat); if (state.sort !== "default") u.set("sort", state.sort);
        const url = "products.html" + (u.toString() ? "?" + u : "");
        history.replaceState(null, "", url); store.set("honey:list", url);
        // cancellable cross-fade: a new filter interrupts the running one instead of queueing behind it
        anims.forEach((a) => a.cancel()); anims = [];
        if (!animate || reduced() || !grid.animate) { draw(list); return; }
        const out = grid.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(6px)" }], { duration: 120, easing: "ease-in", fill: "forwards" });
        anims.push(out);
        out.onfinish = () => {
          draw(list); out.cancel();
          $$(".card", grid).slice(0, 12).forEach((el, i) => anims.push(el.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }],
            { duration: 320, delay: i * 35, easing: "cubic-bezier(.22,.8,.24,1)", fill: "backwards" })));
        };
      };
      let t; input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { state.q = input.value; render(true); }, 140); });
      $(".search .clear").addEventListener("click", () => { input.value = ""; state.q = ""; render(true); input.focus(); });
      sortSel.addEventListener("change", () => { state.sort = sortSel.value; render(true); });
      chips.addEventListener("click", (e) => {
        const b = e.target.closest(".chip"); if (!b || b.dataset.cat === state.cat) return;
        state.cat = b.dataset.cat; render(true);
        b.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced() ? "auto" : "smooth" });
      });
      $("#reset").addEventListener("click", () => { state.q = ""; state.cat = "all"; input.value = ""; render(true); input.focus(); });
      acts.addEventListener("click", (e) => {
        if (!e.target.closest("[data-share-section]")) return;
        const c = cat(state.cat);
        share({ title: `مشاركة قسم ${c.name_ar}`, text: `قسم ${c.name_ar} من حلويات HONEY (${c.count} صنفاً):`, url: absUrl("products.html?cat=" + c.id) });
      });
      render(false); reveal(grid);
      const chipOn = $(".chip[aria-pressed=true]", chips); if (chipOn && chipOn.dataset.cat !== "all") chipOn.scrollIntoView({ block: "nearest", inline: "center" });
    },

    product() {
      const id = new URLSearchParams(location.search).get("id");
      const p = D.products.find((x) => x.id === id);
      const root = $("#product");
      const back = store.get("honey:list");
      if (!p) {
        document.title = "المنتج غير موجود — حلويات HONEY";
        root.innerHTML = `<div class="empty" style="margin:3rem 0"><h3>لم نعثر على هذا المنتج</h3>
          <p class="muted">ربما تغيّر الرابط أو أُزيل المنتج من العرض.</p><a class="btn btn-primary" href="products.html">العودة إلى المنتجات</a></div>`;
        $("#related-wrap").hidden = true; return;
      }
      const c = cat(p.category);
      document.title = `${p.name} — حلويات HONEY`;
      const same = D.products.filter((x) => x.category === p.category).sort(byOrder);
      const i = same.findIndex((x) => x.id === p.id);
      const prev = same[i - 1], next = same[i + 1];
      const labels = { sku: "رمز المنتج", weight: "الوزن", pack_size: "التعبئة", ingredients: "المكونات", allergens: "مسببات الحساسية", price: "السعر" };
      const F = p.fields || {};
      const specs = [["القسم", `<a href="products.html?cat=${esc(p.category)}">${esc(c.name_ar)}</a>`], ["الرقم المرجعي", `<span class="latin">${esc(p.id)}</span>`]]
        .concat(Object.entries(F).filter(([k]) => labels[k]).map(([k, v]) => [labels[k], esc(v)]))
        .concat((p.extra || []).map((x) => [esc(x.label), esc(x.value)]));
      const para = (t) => String(t).split(/\n+/).map((l) => `<p>${esc(l)}</p>`).join("");
      const shots = [p.img].concat((p.gallery || []));
      const k = c.catalog ? catalogById(c.catalog) : null;
      const tel = S.contact && S.contact.phone_tel;
      const backHref = back || `products.html?cat=${encodeURIComponent(p.category)}`;
      root.innerHTML = `
        <nav class="crumbs" aria-label="مسار التنقل"><a href="index.html">الرئيسية</a><span class="sep" aria-hidden="true">/</span>
          <a href="products.html?cat=${esc(p.category)}">${esc(c.name_ar)}</a><span class="sep" aria-hidden="true">/</span><span aria-current="page">${esc(p.name)}</span></nav>
        <div class="detail">
          <div class="media">
          <button class="zoom" type="button" aria-label="عرض صورة ${esc(p.name)} بحجم أكبر">${picture(p, "(max-width: 900px) 100vw, 58vw", true, true)}<span class="hint">${IC.zoom} تكبير</span></button>
          ${shots.length > 1 ? `<div class="thumbs" role="group" aria-label="صور المنتج">${shots.map((g, n) => `<button type="button" data-shot="${n}" aria-label="الصورة ${n + 1}" aria-pressed="${n === 0}"><img src="${g.thumb.jpg}" alt="" width="160" height="120" loading="lazy"></button>`).join("")}</div>` : ""}
          </div>
          <div class="info">
            <span class="overline">${esc(c.name_ar)}</span>
            <h1>${esc(p.name)}</h1>
            <div class="refbox">الرقم المرجعي <b>${esc(p.id)}</b></div>
            ${F.description_ar ? `<div class="desc lead">${para(F.description_ar)}</div>` : ""}
            ${F.details_ar ? `<div class="desc">${para(F.details_ar)}</div>` : ""}
            <dl class="specs">${specs.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join("")}</dl>
            <div class="actions">
              ${tel ? `<a class="btn btn-primary" href="tel:${esc(tel)}">${IC.phone} اتصل للطلب</a>` : ""}
              <button class="btn btn-ghost" type="button" data-share-product>${IC.share} مشاركة</button>
              ${k ? `<a class="btn btn-ghost" href="${esc(catHref(k))}" target="_blank" rel="noopener">${IC.book} كتالوج القسم</a>` : ""}
            </div>
            <a class="back-link" href="${esc(backHref)}">${IC.back} ${back ? "العودة إلى النتائج" : "كل أصناف " + esc(c.name_ar)}</a>
            <div class="pager">
              ${prev ? `<a class="prev" href="product.html?id=${esc(prev.id)}"><small>السابق</small>${esc(prev.name)}</a>` : "<span></span>"}
              ${next ? `<a class="next" href="product.html?id=${esc(next.id)}"><small>التالي</small>${esc(next.name)}</a>` : "<span></span>"}
            </div>
          </div>
        </div>`;
      $("[data-share-product]", root).addEventListener("click", () =>
        share({ title: `مشاركة ${p.name}`, text: `${p.name} (${p.id}) من حلويات HONEY:`, url: absUrl("product.html?id=" + encodeURIComponent(p.id)) }));
      const rel = same.slice(i + 1).concat(same.slice(0, i)).slice(0, 4);
      $("#related").innerHTML = rel.map(card).join(""); watchImages($("#related"));
      $("#related-more").href = "products.html?cat=" + encodeURIComponent(p.category);
      $("#related-more").textContent = "كل أصناف " + c.name_ar;
      const lb = $("#lightbox"), lbImg = $("img", lb), zoom = $(".zoom", root);
      let cur = 0;
      $$("[data-shot]", root).forEach((b) => b.addEventListener("click", () => {
        cur = +b.dataset.shot; const g = shots[cur];
        zoom.innerHTML = pictureSet(g, p.name, "(max-width: 900px) 100vw, 58vw", true, true) + `<span class="hint">${IC.zoom} تكبير</span>`;
        $$("[data-shot]", root).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      }));
      const open = () => {
        lbImg.src = shots[cur].web.jpg; lbImg.alt = p.name; $("figcaption", lb).textContent = `${p.name} · ${p.id}`;
        lb.classList.add("open"); $("button", lb).focus(); document.documentElement.style.overflow = "hidden";
      };
      const close = () => { lb.classList.remove("open"); document.documentElement.style.overflow = ""; zoom.focus(); };
      zoom.addEventListener("click", open);
      lb.addEventListener("click", (e) => { if (e.target === lb || e.target.closest("button")) close(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && lb.classList.contains("open")) close(); });
    },

    catalogs() { const n = $("#local-note"); if (n) n.hidden = !isLocal; },
  };
  if (pages[page]) pages[page]();
  watchImages(); reveal();
})();
