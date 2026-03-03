/* =========================================================
   ✅ APP PRE-SELL (CATÁLOGO LOCAL + IMAGENS POR MLB)
   - ?item=MLB5022231220 carrega dados do /data/catalog.json
   - Imagens: /assets/products/MLBxxxxx_1.png ... _5.png
   - Preço vem do catálogo (você atualiza 1x/dia se quiser)
   - Link de compra vem de ?url= (afiliado) + UTMs
   - Pixel (produção, limpo e eficiente):
     PageView (padrão)
     ViewContent (padrão)
     InitiateCheckout (padrão) -> clique “Ver no Mercado Livre”
     Engaged (custom, 10s/30s/60s)
     ScrollDepth (custom, 60%)
     DescToggle (custom, “VER MAIS”)
     ZoomProduct / ZoomOpinions (custom)
     URL Context (whitelist, leve)
   ========================================================= */

(() => {
  "use strict";

  /* -----------------------------
     ✅ CONFIG
  ----------------------------- */
  const PIXEL_ID = "SEU_PIXEL_ID_AQUI";
  const FALLBACK_ML_URL = "https://www.mercadolivre.com.br/";

  const CATALOG_URL = "/data/catalog.json";
  const IMAGE_BASE = "/assets/products";
  const MAX_IMAGES = 10;

  // ✅ IMAGEM DO CARD ABAIXO DO BOTÃO
  // (vamos testar múltiplos caminhos automaticamente)
  const LOJA_IMAGE_BASE = "/assets/img/products";

  /* =========================================================
     ✅ CONFIG (OFERTA RELÂMPAGO - TIMER SIMBÓLICO COM PERSISTÊNCIA)
     ========================================================= */
  const PROMO_DURATION_MINUTES = 56;
  const PROMO_TICK_MS = 1000;

  /* =========================================================
     ✅ CONFIG (OPINIÕES - IMAGENS)
     - Mesma pasta das imagens do anúncio
     - Padrão: MLBXXXX_OP_1.png, MLBXXXX_OP_2.png...
     - Limite alto pra não travar caso você tenha muitas
     ========================================================= */
  const MAX_OPINION_IMAGES = 30;

  /* =========================================================
     ✅ CONFIG (AVALIAÇÕES - IMAGEM ESTÁTICA)
     - Mesma pasta e fallback do card da LOJA
     - Padrão: MLBXXXX_AVA.png
     - Imagem fixa (sem ação)
     ========================================================= */
  const AVA_SUFFIX = "_AVA";
  const AVA_EXT = ".png";

  /* =========================================================
     ✅ PIXEL CONTEXTO (URL) — WHITELIST (SEM LIXO)
     - Só envia chaves relevantes e curtas
     - Evita mandar utm gigante ou params aleatórios
     ========================================================= */
  const URL_CTX_WHITELIST = [
    "item",
    "cat",
    "categoria",
    "subcat",
    "subcategoria",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term"
  ];

  /* -----------------------------
     ✅ HELPERS
  ----------------------------- */
  function el(id) { return document.getElementById(id); }

  function safeText(v, fallback = "—") {
    if (v === null || v === undefined) return fallback;
    const s = String(v).trim();
    return s.length ? s : fallback;
  }

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function extractMlItemIdFromText(text) {
    const s = String(text || "");
    const m = s.match(/MLB-?\d+/i);
    if (!m) return null;
    return m[0].toUpperCase().replace("-", "");
  }

  function getUtmObject(params) {
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    const utm = {};
    keys.forEach((k) => {
      const v = params.get(k);
      if (v && String(v).trim()) utm[k] = String(v).trim();
    });
    return utm;
  }

  function appendUtmToUrl(url, utmObj) {
    try {
      const u = new URL(url);
      Object.entries(utmObj).forEach(([k, v]) => u.searchParams.set(k, v));
      return u.toString();
    } catch {
      return url;
    }
  }

  function buildUrlContext(params) {
    // ✅ Só pega whitelist, corta valores grandes e remove lixo
    const ctx = {};
    URL_CTX_WHITELIST.forEach((k) => {
      const v = params.get(k);
      if (!v) return;
      const s = String(v).trim();
      if (!s) return;
      // corta strings enormes pra não mandar “romance”
      ctx[k] = s.length > 80 ? (s.slice(0, 80) + "…") : s;
    });
    return ctx;
  }

  /* =========================================================
     ✅ PIXEL (PRODUÇÃO) — LIMPO, PADRONIZADO E SEM SPAM
     ========================================================= */
  const _px = {
    inited: false,
    loaded: false,
    sentKeys: new Set(), // dedupe local
  };

  function ensureFbqLoaded() {
    if (!PIXEL_ID || PIXEL_ID === "SEU_PIXEL_ID_AQUI") return false;
    if (typeof window.fbq === "function") return true;

    try {
      window.fbq = function () {
        window.fbq.callMethod
          ? window.fbq.callMethod.apply(window.fbq, arguments)
          : window.fbq.queue.push(arguments);
      };
      window.fbq.push = window.fbq;
      window.fbq.loaded = false;
      window.fbq.version = "2.0";
      window.fbq.queue = [];

      const s = document.createElement("script");
      s.async = true;
      s.defer = true;
      s.src = "https://connect.facebook.net/en_US/fbevents.js";
      s.onload = () => { _px.loaded = true; };
      document.head.appendChild(s);

      return true;
    } catch {
      return false;
    }
  }

  function pixelInit() {
    if (_px.inited) return true;
    if (!ensureFbqLoaded()) return false;

    try {
      window.fbq("init", PIXEL_ID);
      _px.inited = true;
      return true;
    } catch {
      return false;
    }
  }

  function pixelTrack(eventName, payload = {}, opts = {}) {
    const key = opts && opts.key ? String(opts.key) : "";
    const dedupe = opts && opts.dedupe === true;

    if (!PIXEL_ID || PIXEL_ID === "SEU_PIXEL_ID_AQUI") return;

    if (dedupe && key) {
      if (_px.sentKeys.has(key)) return;
      _px.sentKeys.add(key);
    }

    if (!pixelInit()) return;

    try {
      if (typeof window.fbq === "function") window.fbq("track", eventName, payload);
    } catch {}
  }

  function pixelTrackCustom(eventName, payload = {}, opts = {}) {
    const key = opts && opts.key ? String(opts.key) : "";
    const dedupe = opts && opts.dedupe === true;

    if (!PIXEL_ID || PIXEL_ID === "SEU_PIXEL_ID_AQUI") return;

    if (dedupe && key) {
      if (_px.sentKeys.has(key)) return;
      _px.sentKeys.add(key);
    }

    if (!pixelInit()) return;

    try {
      if (typeof window.fbq === "function") window.fbq("trackCustom", eventName, payload);
    } catch {}
  }

  function showError(msg) {
    const box = el("errorBox");
    if (!box) return;
    box.textContent = msg;
    box.style.display = "block";
  }

  function showOpinionsError(msg) {
    const box = el("opErrorBox");
    if (!box) return;
    box.textContent = msg;
    box.style.display = "block";
  }

  function hideSkeleton() {
    const sk = el("mediaSkeleton");
    if (sk) sk.style.display = "none";
  }

  function hideOpinionsSkeleton() {
    const sk = el("opMediaSkeleton");
    if (sk) sk.style.display = "none";
  }

  function formatBRL(value) {
    if (!Number.isFinite(value)) return "—";
    try {
      return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    } catch {
      return "R$ " + String(value);
    }
  }

  // ✅ Dispara saída para ML: padrão InitiateCheckout + custom Outbound leve
  function goOutbound(url, ctx) {
    const dest = String(url || "");
    const mlb = ctx && ctx.mlb ? String(ctx.mlb) : null;
    const title = ctx && ctx.title ? String(ctx.title) : (mlb || "Produto");
    const price = ctx && Number.isFinite(ctx.price) ? ctx.price : 0;

    // ✅ Evento mais importante (padrão)
    pixelTrack("InitiateCheckout", {
      content_ids: mlb ? [mlb] : [],
      content_type: "product",
      content_name: title,
      value: price,
      currency: "BRL"
    }, { dedupe: true, key: `initiate_checkout_${mlb || "x"}` });

    // ✅ Custom leve (debug/insights)
    try {
      const host = (() => { try { return new URL(dest).hostname; } catch { return ""; } })();
      pixelTrackCustom("Outbound", { destination_domain: host || "unknown" }, { dedupe: true, key: `outbound_${mlb || "x"}` });
    } catch {}

    window.location.href = dest;
  }

  async function fetchJson(url) {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  }

  function probeImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.decoding = "async";
      img.loading = "eager";
      img.src = url + (url.includes("?") ? "&" : "?") + "_ts=" + Date.now();
    });
  }

  async function resolveProductImages(mlb) {
    const urls = [];
    for (let i = 1; i <= MAX_IMAGES; i++) {
      const imgUrl = `${IMAGE_BASE}/${mlb}_${i}.png`;
      const ok = await probeImage(imgUrl);
      if (ok) urls.push(imgUrl);
    }
    return urls;
  }

  async function resolveOpinionImages(mlb) {
    const urls = [];
    let foundAny = false;

    for (let i = 1; i <= MAX_OPINION_IMAGES; i++) {
      const imgUrl = `${IMAGE_BASE}/${mlb}_OP_${i}.png`;
      const ok = await probeImage(imgUrl);

      if (ok) {
        urls.push(imgUrl);
        foundAny = true;
        continue;
      }
      if (foundAny) break;
    }

    return urls;
  }

  /* =========================================================
     ✅ LOJA IMAGE (SEM DEBUG)
     ========================================================= */
  async function resolveLojaImage(mlb) {
    const file = `${String(mlb).toUpperCase()}.png`;

    const candidates = [
      `${LOJA_IMAGE_BASE}/${file}`,
      `/assets/products/${file}`,
      `assets/img/products/${file}`,
      `assets/products/${file}`,
    ];

    for (const c of candidates) {
      const ok = await probeImage(c);
      if (ok) return c;
    }
    return null;
  }

  async function setupLojaCard(mlb) {
    const card = el("lojaCard");
    const img = el("lojaImage");
    if (!card || !img) return;

    card.hidden = true;
    img.src = "";
    img.removeAttribute("srcset");

    const src = await resolveLojaImage(mlb);

    if (!src) {
      card.hidden = true;
      img.src = "";
      return;
    }

    img.src = src;
    card.hidden = false;
  }

  /* =========================================================
     ✅ AVALIAÇÕES (AVA) - IMAGEM ESTÁTICA
     ========================================================= */
  async function resolveAvaImage(mlb) {
    const base = String(mlb).toUpperCase();
    const file = `${base}${AVA_SUFFIX}${AVA_EXT}`;

    const candidates = [
      `${LOJA_IMAGE_BASE}/${file}`,
      `/assets/products/${file}`,
      `assets/img/products/${file}`,
      `assets/products/${file}`,
    ];

    for (const c of candidates) {
      const ok = await probeImage(c);
      if (ok) return c;
    }
    return null;
  }

  function ensureAvaCardInsideOpinions() {
    const host = el("opinionsCard");
    if (!host) return null;

    let card = el("avaCard");
    let img = el("avaImage");

    if (card && img) return { card, img };

    card = document.createElement("div");
    card.id = "avaCard";
    card.hidden = true;

    card.style.marginTop = "10px";
    card.style.border = "1px solid rgba(17, 24, 39, 0.08)";
    card.style.borderRadius = "12px";
    card.style.background = "#fff";
    card.style.overflow = "hidden";
    card.style.boxShadow = "0 6px 18px rgba(17,24,39,0.06)";

    img = document.createElement("img");
    img.id = "avaImage";
    img.alt = "Foto de avaliações";
    img.decoding = "async";
    img.loading = "lazy";
    img.style.display = "block";
    img.style.width = "100%";
    img.style.height = "auto";

    card.appendChild(img);

    const countLine = el("opCountLine");
    if (countLine && countLine.parentNode) {
      countLine.parentNode.insertBefore(card, countLine.nextSibling);
    } else {
      host.appendChild(card);
    }

    return { card, img };
  }

  async function setupAvaCard(mlb) {
    const dom = ensureAvaCardInsideOpinions();
    if (!dom) return;

    const { card, img } = dom;

    card.hidden = true;
    img.src = "";
    img.removeAttribute("srcset");

    const src = await resolveAvaImage(mlb);

    if (!src) {
      card.hidden = true;
      img.src = "";
      return;
    }

    img.src = src;
    card.hidden = false;
  }

  /* =========================================================
     ✅ THUMBS (GENÉRICO)
     ========================================================= */
  function renderThumbsTo(containerId, imageUrls, onPick) {
    const thumbs = el(containerId);
    if (!thumbs) return;

    thumbs.innerHTML = "";

    imageUrls.forEach((src, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "thumb" + (idx === 0 ? " is-active" : "");
      btn.setAttribute("aria-label", "Selecionar imagem " + (idx + 1));
      btn.dataset.idx = String(idx);

      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = src;

      btn.appendChild(img);

      btn.addEventListener("click", () => {
        Array.from(thumbs.querySelectorAll(".thumb")).forEach((t) => t.classList.remove("is-active"));
        btn.classList.add("is-active");
        onPick(src, idx);
      });

      thumbs.appendChild(btn);
    });
  }

  function setActiveThumbByIndexIn(containerId, idx) {
    const thumbs = el(containerId);
    if (!thumbs) return;

    const all = Array.from(thumbs.querySelectorAll(".thumb"));
    all.forEach((t) => t.classList.remove("is-active"));

    const target = all.find((t) => Number(t.dataset.idx) === Number(idx));
    if (target) target.classList.add("is-active");
  }

  function renderThumbs(imageUrls, onPick) {
    renderThumbsTo("thumbs", imageUrls, onPick);
  }

  function setActiveThumbByIndex(idx) {
    setActiveThumbByIndexIn("thumbs", idx);
  }

  /* =========================================================
     ✅ OPINIÕES: "THUMBS SCROLLER" ESTILO ML (SETAS ⬆️⬇️)
     ========================================================= */
  function setupThumbScroller(containerId, opts = {}) {
    const box = el(containerId);
    if (!box) return;

    if (box._mlThumbScrollerBound) return;
    box._mlThumbScrollerBound = true;

    const maxHeight = Number.isFinite(opts.maxHeight) ? opts.maxHeight : 360;
    const stepRatio = Number.isFinite(opts.stepRatio) ? opts.stepRatio : 0.85;

    box.style.maxHeight = `${maxHeight}px`;
    box.style.overflowY = "auto";
    box.style.overscrollBehavior = "contain";
    box.style.scrollBehavior = "smooth";
    box.style.scrollbarGutter = "stable";
    box.style.webkitOverflowScrolling = "touch";

    function makeArrowBtn(direction) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.dir = direction;
      btn.setAttribute("aria-label", direction === "up" ? "Subir miniaturas" : "Descer miniaturas");
      btn.style.width = "100%";
      btn.style.display = "none";
      btn.style.border = "1px solid rgba(17,24,39,0.10)";
      btn.style.background = "#fff";
      btn.style.borderRadius = "12px";
      btn.style.padding = "8px 10px";
      btn.style.cursor = "pointer";
      btn.style.boxShadow = "0 6px 18px rgba(17,24,39,0.06)";
      btn.style.margin = direction === "up" ? "0 0 8px 0" : "8px 0 0 0";
      btn.style.userSelect = "none";

      const icon = document.createElement("span");
      icon.textContent = direction === "up" ? "▲" : "▼";
      icon.style.display = "inline-block";
      icon.style.fontSize = "14px";
      icon.style.fontWeight = "900";
      icon.style.lineHeight = "1";
      icon.style.color = "#2563eb";
      btn.appendChild(icon);

      return btn;
    }

    const btnUp = makeArrowBtn("up");
    const btnDown = makeArrowBtn("down");

    if (box.parentNode) {
      box.parentNode.insertBefore(btnUp, box);
      if (box.nextSibling) box.parentNode.insertBefore(btnDown, box.nextSibling);
      else box.parentNode.appendChild(btnDown);
    }

    function atTop() { return box.scrollTop <= 2; }

    function atBottom() {
      const maxScrollTop = box.scrollHeight - box.clientHeight;
      return box.scrollTop >= (maxScrollTop - 2);
    }

    function isScrollable() { return box.scrollHeight > (box.clientHeight + 4); }

    function refreshArrows() {
      if (!isScrollable()) {
        btnUp.style.display = "none";
        btnDown.style.display = "none";
        return;
      }
      btnUp.style.display = atTop() ? "none" : "block";
      btnDown.style.display = atBottom() ? "none" : "block";
    }

    function scrollStep(dir) {
      const step = Math.max(80, Math.floor(box.clientHeight * stepRatio));
      const delta = dir === "up" ? -step : step;
      box.scrollBy({ top: delta, left: 0, behavior: "smooth" });
    }

    btnUp.addEventListener("click", (e) => { e.preventDefault(); scrollStep("up"); });
    btnDown.addEventListener("click", (e) => { e.preventDefault(); scrollStep("down"); });

    box.addEventListener("scroll", refreshArrows, { passive: true });
    window.addEventListener("resize", refreshArrows, { passive: true });

    requestAnimationFrame(refreshArrows);
    setTimeout(refreshArrows, 60);
  }

  /* =========================================================
     ✅ "META" ESTILO MERCADO LIVRE
     ========================================================= */
  function clamp(n, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    return Math.min(max, Math.max(min, x));
  }

  function formatSoldCountBR(n) {
    const raw = String(n || "").replace(/\D+/g, "");
    const v = Number(raw);

    if (!Number.isFinite(v) || v <= 0) return "— vendidos";

    if (v >= 10000) {
      const milhar = Math.floor(v / 10000) * 10;
      return `+${milhar} mil vendidos`;
    }

    return `${v.toLocaleString("pt-BR")} vendidos`;
  }

  function buildStars(rating) {
    const r = clamp(rating, 0, 5);
    const rounded = Math.round(r * 2) / 2;
    const full = Math.floor(rounded);
    const half = (rounded - full) === 0.5 ? 1 : 0;
    const empty = 5 - full - half;

    const wrap = document.createElement("span");
    wrap.className = "ml-stars";
    wrap.setAttribute("aria-label", `Avaliação ${rounded} de 5`);

    for (let i = 0; i < full; i++) {
      const s = document.createElement("span");
      s.className = "ml-star is-full";
      wrap.appendChild(s);
    }

    if (half) {
      const s = document.createElement("span");
      s.className = "ml-star is-half";
      wrap.appendChild(s);
    }

    for (let i = 0; i < empty; i++) {
      const s = document.createElement("span");
      s.className = "ml-star is-empty";
      wrap.appendChild(s);
    }

    return wrap;
  }

  function setMarketplaceMetaFromCatalog(product) {
    const conditionLabel = safeText(
      product?.conditionLabel,
      (String(product?.condition || "").toLowerCase().includes("used") || String(product?.condition || "").toLowerCase().includes("usad"))
        ? "Usado"
        : "Novo"
    );

    const soldText = formatSoldCountBR(product?.soldCount);

    const ratingNum = Number(product?.rating);
    const ratingText = Number.isFinite(ratingNum) ? ratingNum.toFixed(1).replace(".", ",") : "—";

    const reviewsNum = Number(product?.reviewsCount);
    const reviewsText = Number.isFinite(reviewsNum) ? `(${reviewsNum})` : "";

    const topLine = el("mlMetaTopLine");
    const ratingLine = el("mlMetaRatingLine");

    const legacyBox =
      el("categoryOriginBox") ||
      document.querySelector(".category-origin") ||
      document.querySelector(".ml-category-origin");

    if (topLine) {
      topLine.textContent = `${conditionLabel} | ${soldText}`;
    } else if (legacyBox) {
      let legacyTop = legacyBox.querySelector("#mlMetaTopLine");
      if (!legacyTop) {
        legacyTop = document.createElement("div");
        legacyTop.id = "mlMetaTopLine";
        legacyBox.innerHTML = "";
        legacyBox.appendChild(legacyTop);
      }
      legacyTop.textContent = `${conditionLabel} | ${soldText}`;
    }

    if (ratingLine) {
      ratingLine.innerHTML = "";
      const num = document.createElement("span");
      num.className = "ml-rating-number";
      num.textContent = ratingText;

      const stars = buildStars(Number.isFinite(ratingNum) ? ratingNum : 0);

      const count = document.createElement("span");
      count.className = "ml-rating-count";
      count.textContent = reviewsText;

      ratingLine.appendChild(num);
      ratingLine.appendChild(stars);
      ratingLine.appendChild(count);
    } else if (legacyBox) {
      let legacyRating = legacyBox.querySelector("#mlMetaRatingLine");
      if (!legacyRating) {
        legacyRating = document.createElement("div");
        legacyRating.id = "mlMetaRatingLine";
        legacyBox.appendChild(legacyRating);
      }

      legacyRating.innerHTML = "";
      const num = document.createElement("span");
      num.className = "ml-rating-number";
      num.textContent = ratingText;

      const stars = buildStars(Number.isFinite(ratingNum) ? ratingNum : 0);

      const count = document.createElement("span");
      count.className = "ml-rating-count";
      count.textContent = reviewsText;

      legacyRating.appendChild(num);
      legacyRating.appendChild(stars);
      legacyRating.appendChild(count);
    }
  }

  function setTextsFromCatalog(product) {
    const titleEl = el("productTitle");
    if (titleEl) titleEl.textContent = safeText(product?.title, "Oferta verificada");

    const subtitleEl = el("productSubtitle");
    if (subtitleEl) subtitleEl.textContent = safeText(product?.subtitle, "Você concluirá a compra no Mercado Livre com segurança.");

    const priceEl = el("priceValue");
    if (priceEl) priceEl.textContent = Number.isFinite(product?.price) ? formatBRL(product.price) : "—";

    const oldPriceEl = el("oldPriceValue");
    if (oldPriceEl) oldPriceEl.textContent = Number.isFinite(product?.oldPrice) ? formatBRL(product.oldPrice) : "";

    const descEl = el("descText");
    if (descEl) descEl.textContent = safeText(product?.description, "Os detalhes completos estarão disponíveis no Mercado Livre.");

    const ratingEl = el("ratingValue");
    if (ratingEl && Number.isFinite(product?.rating)) ratingEl.textContent = String(product.rating);

    const reviewsEl = el("reviewsCount");
    if (reviewsEl && Number.isFinite(product?.reviewsCount)) reviewsEl.textContent = `(${product.reviewsCount})`;

    const chipsWrap = el("chips");
    if (chipsWrap) {
      chipsWrap.innerHTML = "";
      const highlights = Array.isArray(product?.highlights) ? product.highlights : [];
      highlights.slice(0, 6).forEach((h) => {
        const c = document.createElement("span");
        c.className = "chip";
        c.textContent = String(h);
        chipsWrap.appendChild(c);
      });
    }

    setMarketplaceMetaFromCatalog(product);
  }

  function updatePromoDiscount(product) {
    const discountEl = el("promoDiscountValue");
    const promoBox = el("promoBox");

    if (!discountEl) return;

    const price = Number(product?.price);
    const oldPrice = Number(product?.oldPrice);

    if (!Number.isFinite(price) || !Number.isFinite(oldPrice) || oldPrice <= price) {
      discountEl.textContent = "";
      if (promoBox) promoBox.classList.remove("has-discount");
      return;
    }

    const discountPercent = Math.round(((oldPrice - price) / oldPrice) * 100);
    discountEl.textContent = `-${discountPercent}%`;
    if (promoBox) promoBox.classList.add("has-discount");
  }

  function setupPromoCountdown(mlb, opts = {}) {
    const durationMinutes = Number.isFinite(opts.durationMinutes) ? opts.durationMinutes : PROMO_DURATION_MINUTES;
    const tickMs = Number.isFinite(opts.tickMs) ? opts.tickMs : PROMO_TICK_MS;

    const endsEl = el("promoEndsIn");
    if (!endsEl) return;

    const promoBox = el("promoBox") || endsEl.closest(".ml-promo");
    const finalMsg = el("promoFinalMsg");

    const key = `promoEndsAt_${String(mlb || "GLOBAL").toUpperCase()}`;

    let endsAt = 0;
    try {
      endsAt = Number(localStorage.getItem(key) || "0");
    } catch {
      endsAt = 0;
    }

    const now = Date.now();

    if (!Number.isFinite(endsAt) || endsAt <= 0) {
      endsAt = now + (durationMinutes * 60 * 1000);
      try { localStorage.setItem(key, String(endsAt)); } catch {}
    }

    function pad2(n) {
      const x = Math.max(0, Math.floor(n));
      return x < 10 ? "0" + x : String(x);
    }

    function buildTimerUI() {
      if (endsEl._mlTimerBuilt) return;
      endsEl._mlTimerBuilt = true;

      endsEl.innerHTML = "";
      endsEl.classList.add("ml-timer");

      const root = document.createElement("span");
      root.className = "ml-timer-root";
      endsEl.appendChild(root);

      function makeDigitBox(initialDigit) {
        const box = document.createElement("span");
        box.className = "ml-tbox";
        box.dataset.d = String(initialDigit);

        const cur = document.createElement("span");
        cur.className = "ml-tcur";
        cur.textContent = String(initialDigit);

        const nxt = document.createElement("span");
        nxt.className = "ml-tnext";
        nxt.textContent = String(initialDigit);

        box.appendChild(cur);
        box.appendChild(nxt);
        return box;
      }

      function makeSep() {
        const s = document.createElement("span");
        s.className = "ml-tsep";
        s.textContent = ":";
        return s;
      }

      const d0 = makeDigitBox("0");
      const d1 = makeDigitBox("0");
      const d2 = makeDigitBox("0");
      const d3 = makeDigitBox("0");
      const d4 = makeDigitBox("0");
      const d5 = makeDigitBox("0");

      root.appendChild(d0);
      root.appendChild(d1);
      root.appendChild(makeSep());
      root.appendChild(d2);
      root.appendChild(d3);
      root.appendChild(makeSep());
      root.appendChild(d4);
      root.appendChild(d5);

      endsEl._mlDigits = [d0, d1, d2, d3, d4, d5];
    }

    function flipTo(box, nextDigit) {
      if (!box) return;
      const current = box.dataset.d || "";
      const next = String(nextDigit);

      if (current === next) return;

      box.dataset.d = next;

      const cur = box.querySelector(".ml-tcur");
      const nxt = box.querySelector(".ml-tnext");
      if (cur) cur.textContent = current;
      if (nxt) nxt.textContent = next;

      box.classList.remove("is-flipping");
      void box.offsetWidth;
      box.classList.add("is-flipping");

      window.setTimeout(() => {
        if (cur) cur.textContent = next;
        box.classList.remove("is-flipping");
      }, 320);
    }

    function setFinalState() {
      buildTimerUI();
      const boxes = endsEl._mlDigits || [];
      const finalDigits = ["0","0","0","0","0","0"];
      for (let i = 0; i < boxes.length; i++) {
        flipTo(boxes[i], finalDigits[i]);
      }

      if (finalMsg) finalMsg.hidden = false;
      if (promoBox) promoBox.classList.add("is-ended");
    }

    function render() {
      const remainingMs = endsAt - Date.now();

      if (remainingMs <= 0) {
        setFinalState();
        clearInterval(render._t);
        render._t = null;
        return;
      }

      if (finalMsg) finalMsg.hidden = true;
      if (promoBox) promoBox.classList.remove("is-ended");

      const totalSeconds = Math.floor(remainingMs / 1000);

      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const hh = pad2(hours);
      const mm = pad2(minutes);
      const ss = pad2(seconds);

      const digits = [hh[0], hh[1], mm[0], mm[1], ss[0], ss[1]];

      buildTimerUI();
      const boxes = endsEl._mlDigits || [];

      for (let i = 0; i < boxes.length; i++) {
        flipTo(boxes[i], digits[i]);
      }
    }

    if (setupPromoCountdown._activeTimers) {
      const prev = setupPromoCountdown._activeTimers.get(key);
      if (prev) clearInterval(prev);
    } else {
      setupPromoCountdown._activeTimers = new Map();
    }

    render();
    const t = setInterval(render, tickMs);
    setupPromoCountdown._activeTimers.set(key, t);
    render._t = t;
  }

  /* -----------------------------
     ✅ DESCRIÇÃO: "VEM MAIS" / "VEM MENOS" + Pixel DescToggle
  ----------------------------- */
  function setupDescToggle(pixelCtx = {}) {
    const box = el("descBox");
    const body = el("descBody");
    const btn = el("descToggle");
    const text = el("descText");

    if (!box || !body || !btn || !text) return;
    if (btn._bound) return;
    btn._bound = true;

    btn.setAttribute("aria-expanded", "false");
    btn.textContent = "VEM MAIS";

    requestAnimationFrame(() => {
      box.classList.add("is-collapsed");
      const previewH = body.clientHeight;

      box.classList.remove("is-collapsed");
      const totalH = body.scrollHeight;

      box.classList.add("is-collapsed");

      const needsToggle = totalH > (previewH + 12);

      if (!needsToggle) {
        box.classList.remove("is-collapsed");
        btn.style.display = "none";
        btn.setAttribute("aria-expanded", "true");
        return;
      }

      btn.style.display = "inline-flex";

      btn.addEventListener("click", () => {
        const isCollapsed = box.classList.contains("is-collapsed");

        if (isCollapsed) {
          box.classList.remove("is-collapsed");
          btn.textContent = "VEM MENOS";
          btn.setAttribute("aria-expanded", "true");

          // ✅ Pixel: clicou para expandir (“ver mais”)
          pixelTrackCustom("DescToggle", {
            action: "expand",
            content_id: pixelCtx.mlb || ""
          }, { dedupe: true, key: `desc_expand_${pixelCtx.mlb || "x"}` });

        } else {
          box.classList.add("is-collapsed");
          btn.textContent = "VEM MAIS";
          btn.setAttribute("aria-expanded", "false");

          try { box.scrollIntoView({ behavior: "smooth", block: "start" }); } catch {}
        }
      });
    });
  }

  /* =========================================================
     ✅ MODAL (COMPARTILHADO) + Pixel ZoomProduct/ZoomOpinions
  ========================================================= */
  function ensureZoomController() {
    const modal = el("zoomModal");
    const closeBtn = el("zoomClose");
    const zoomImg = el("zoomImage");
    const btnPrev = el("zoomPrev");
    const btnNext = el("zoomNext");

    if (!modal || !closeBtn || !zoomImg) return null;
    if (ensureZoomController._ctrl) return ensureZoomController._ctrl;

    const ctrl = {
      modal,
      closeBtn,
      zoomImg,
      btnPrev,
      btnNext,
      currentIndex: 0,
      imageUrls: [],
      onIndexChange: null,
      // ✅ contexto do zoom (para pixel)
      zoomContext: {
        kind: "unknown", // "product" | "opinions"
        mlb: "",
      }
    };

    function setImageByIndex(idx) {
      if (!Array.isArray(ctrl.imageUrls) || !ctrl.imageUrls.length) return;

      const safeIdx = (idx + ctrl.imageUrls.length) % ctrl.imageUrls.length;
      ctrl.currentIndex = safeIdx;

      const src = ctrl.imageUrls[ctrl.currentIndex];
      ctrl.zoomImg.src = src;

      if (typeof ctrl.onIndexChange === "function") {
        try { ctrl.onIndexChange(ctrl.currentIndex, src); } catch {}
      }

      const showArrows = ctrl.imageUrls.length > 1;
      if (ctrl.btnPrev) ctrl.btnPrev.style.display = showArrows ? "inline-flex" : "none";
      if (ctrl.btnNext) ctrl.btnNext.style.display = showArrows ? "inline-flex" : "none";
    }

    function open(imageUrls, startIndex, onIndexChange, zoomCtx) {
      ctrl.imageUrls = Array.isArray(imageUrls) ? imageUrls : [];
      ctrl.onIndexChange = typeof onIndexChange === "function" ? onIndexChange : null;

      // ✅ salva contexto de onde veio
      if (zoomCtx && typeof zoomCtx === "object") {
        ctrl.zoomContext.kind = zoomCtx.kind || "unknown";
        ctrl.zoomContext.mlb = zoomCtx.mlb || "";
      } else {
        ctrl.zoomContext.kind = "unknown";
        ctrl.zoomContext.mlb = "";
      }

      setImageByIndex(Number.isFinite(startIndex) ? startIndex : 0);

      ctrl.modal.classList.add("is-open");
      ctrl.modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("is-zoom-open");
    }

    function close() {
      ctrl.modal.classList.remove("is-open");
      ctrl.modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-zoom-open");
      ctrl.zoomImg.src = "";
      ctrl.imageUrls = [];
      ctrl.onIndexChange = null;
      ctrl.currentIndex = 0;
      ctrl.zoomContext.kind = "unknown";
      ctrl.zoomContext.mlb = "";
    }

    function goPrev() { setImageByIndex(ctrl.currentIndex - 1); }
    function goNext() { setImageByIndex(ctrl.currentIndex + 1); }

    ctrl.open = open;
    ctrl.close = close;
    ctrl.setImageByIndex = setImageByIndex;

    closeBtn.addEventListener("click", close);

    if (btnPrev) btnPrev.addEventListener("click", (e) => { e.preventDefault(); goPrev(); });
    if (btnNext) btnNext.addEventListener("click", (e) => { e.preventDefault(); goNext(); });

    ensureZoomController._ctrl = ctrl;
    return ctrl;
  }

  function bindZoomToGallery(mainImageEl, imageUrls, opts = {}) {
    const ctrl = ensureZoomController();
    if (!ctrl || !mainImageEl) return;
    if (!Array.isArray(imageUrls) || !imageUrls.length) return;

    const key = opts.key || "gallery";
    if (!mainImageEl._zoomBoundKeys) mainImageEl._zoomBoundKeys = new Set();
    if (mainImageEl._zoomBoundKeys.has(key)) return;
    mainImageEl._zoomBoundKeys.add(key);

    function findIndexBySrc(src) {
      const idx = imageUrls.indexOf(src);
      return idx >= 0 ? idx : 0;
    }

    function onIndexChange(idx, src) {
      mainImageEl.src = src;

      if (typeof opts.setActiveThumb === "function") {
        try { opts.setActiveThumb(idx); } catch {}
      }
    }

    mainImageEl.addEventListener("click", () => {
      if (!mainImageEl.src) return;

      const idx = findIndexBySrc(mainImageEl.src);

      // ✅ Pixel: abriu zoom (separado por origem)
      const kind = opts.kind || "unknown";
      const mlb = opts.mlb || "";

      pixelTrackCustom(kind === "product" ? "ZoomProduct" : "ZoomOpinions", {
        content_id: mlb,
        start_index: idx
      }, { dedupe: false, key: "" });

      ctrl.open(imageUrls, idx, onIndexChange, { kind, mlb });
    });
  }

  /* =========================================================
     ✅ OPINIÕES: SETUP COMPLETO
     ========================================================= */
  async function setupOpinionsGallery(mlb) {
    const card = el("opinionsCard");
    const main = el("opMainImage");
    const thumbsId = "opThumbs";
    const hint = el("opHint");
    const countLine = el("opCountLine");

    if (!card || !main) return;

    if (hint) hint.textContent = "(carregando…)";
    if (countLine) countLine.textContent = "—";
    hideOpinionsSkeleton();
    el("opErrorBox") && (el("opErrorBox").style.display = "none");

    const opImages = await resolveOpinionImages(mlb);

    if (!opImages.length) {
      if (hint) hint.textContent = "(nenhuma imagem encontrada)";
      if (countLine) countLine.textContent = "Sem fotos de avaliações para este item.";
      main.removeAttribute("src");
      return;
    }

    if (hint) hint.textContent = `(${opImages.length} foto${opImages.length > 1 ? "s" : ""})`;
    if (countLine) countLine.textContent = "Toque para ampliar e use as setas para navegar.";

    main.src = opImages[0];

    renderThumbsTo(thumbsId, opImages, (src, idx) => {
      main.src = src;
      setActiveThumbByIndexIn(thumbsId, idx);
    });

    setupThumbScroller(thumbsId, { maxHeight: 360, stepRatio: 0.85 });

    bindZoomToGallery(main, opImages, {
      key: "opinions",
      kind: "opinions",
      mlb,
      setActiveThumb: (idx) => setActiveThumbByIndexIn(thumbsId, idx)
    });
  }

  /* -----------------------------
     ✅ MAIN
  ----------------------------- */
  document.addEventListener("DOMContentLoaded", async () => {
    const params = getParams();
    const utmObj = getUtmObject(params);
    const urlCtx = buildUrlContext(params);

    pixelInit();

    // ✅ PageView 1x (com contexto mínimo da URL)
    pixelTrack("PageView", {
      // mandar contexto mínimo como custom_data dentro do PageView não é padrão,
      // então usamos apenas custom event leve para URL (se você quiser)
    }, { dedupe: true, key: "pageview" });

    // ✅ Custom leve: URL Context (1x)
    // (isso ajuda você a auditar, sem poluir o padrão)
    pixelTrackCustom("UrlContext", urlCtx, { dedupe: true, key: "url_ctx" });

    const rawUrl = params.get("url") || FALLBACK_ML_URL;
    const finalUrl = appendUtmToUrl(rawUrl, utmObj);

    const itemParam = params.get("item");
    const urlParam = params.get("url");
    const candidate = itemParam || urlParam || "";
    const mlb = extractMlItemIdFromText(candidate);

    if (!mlb) {
      hideSkeleton();
      hideOpinionsSkeleton();
      showError("Parâmetro 'item' ausente. Ex: ?item=MLB5022231220");
      return;
    }

    // ✅ Card abaixo do botão (imagem única por MLB)
    await setupLojaCard(mlb);

    // ✅ Opiniões (galeria com zoom)
    await setupOpinionsGallery(mlb);

    // ✅ Card estático AVA
    await setupAvaCard(mlb);

    // Timer
    setupPromoCountdown(mlb, { durationMinutes: 56, tickMs: 1000 });

    // ✅ Contexto “vivo” do produto (atualizado após catálogo)
    const productCtx = {
      mlb,
      title: mlb,
      price: 0
    };

    // ✅ Botão principal (evento mais importante)
    const goBtn = el("goMlBtn");
    if (goBtn && !goBtn._boundOutbound) {
      goBtn._boundOutbound = true;
      goBtn.addEventListener("click", () => goOutbound(finalUrl, productCtx));
    }

    try {
      const catalog = await fetchJson(CATALOG_URL);
      const product = catalog?.[mlb];

      if (!product) {
        hideSkeleton();
        showError(`Produto ${mlb} não encontrado no catálogo. (Cadastre no /data/catalog.json)`);
        return;
      }

      // ✅ Preenche textos e valores
      setTextsFromCatalog(product);

      // ✅ Atualiza ctx do produto (para cliques e eventos)
      productCtx.title = safeText(product?.title, mlb);
      productCtx.price = Number.isFinite(product?.price) ? product.price : 0;

      // ✅ Desconto dinâmico
      updatePromoDiscount(product);

      // ✅ Toggle descrição com evento “VER MAIS”
      setupDescToggle({ mlb });

      const images = await resolveProductImages(mlb);
      const mainImageEl = el("mainImage");

      if (mainImageEl && images.length) {
        mainImageEl.src = images[0];
        mainImageEl.addEventListener("load", hideSkeleton, { once: true });

        renderThumbs(images, (src, idx) => {
          mainImageEl.src = src;
          setActiveThumbByIndex(idx);
        });

        // ✅ Zoom do anúncio + evento ZoomProduct
        bindZoomToGallery(mainImageEl, images, {
          key: "product",
          kind: "product",
          mlb,
          setActiveThumb: (idx) => setActiveThumbByIndex(idx)
        });
      } else {
        hideSkeleton();
      }

      // ✅ ViewContent (PADRÃO) 1x — essencial
      pixelTrack("ViewContent", {
        content_ids: [mlb],
        content_type: "product",
        content_name: productCtx.title,
        value: productCtx.price,
        currency: "BRL"
      }, { dedupe: true, key: `viewcontent_${mlb}` });

      // ✅ (Opcional e leve) custom “ProductContext” para auditoria sem poluir padrão
      pixelTrackCustom("ProductContext", {
        content_id: mlb,
        title: productCtx.title.length > 60 ? (productCtx.title.slice(0, 60) + "…") : productCtx.title,
        price: productCtx.price
      }, { dedupe: true, key: `product_ctx_${mlb}` });

    } catch (err) {
      hideSkeleton();
      showError("Falha ao carregar catálogo local. Verifique /data/catalog.json.");
    }

    /* =========================================================
       ✅ TEMPO EM TELA (ENGAGED) — 10s / 30s / 60s
       - Sem spam, só 1x cada
       ========================================================= */
    setTimeout(() => {
      pixelTrackCustom("Engaged", { seconds: 10, content_id: mlb }, { dedupe: true, key: `engaged_10_${mlb}` });
    }, 10000);

    setTimeout(() => {
      pixelTrackCustom("Engaged", { seconds: 30, content_id: mlb }, { dedupe: true, key: `engaged_30_${mlb}` });
    }, 30000);

    setTimeout(() => {
      pixelTrackCustom("Engaged", { seconds: 60, content_id: mlb }, { dedupe: true, key: `engaged_60_${mlb}` });
    }, 60000);

    /* =========================================================
       ✅ SCROLL (60%) — 1x
       ========================================================= */
    let scrollFired = false;
    window.addEventListener("scroll", () => {
      if (scrollFired) return;

      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const scrollHeight = doc.scrollHeight || document.body.scrollHeight;
      const clientHeight = doc.clientHeight || window.innerHeight;
      const maxScroll = Math.max(1, scrollHeight - clientHeight);
      const pct = (scrollTop / maxScroll) * 100;

      if (pct >= 60) {
        scrollFired = true;
        pixelTrackCustom("ScrollDepth", { percent: 60, content_id: mlb }, { dedupe: true, key: `scroll_60_${mlb}` });
      }
    }, { passive: true });
  });
})();