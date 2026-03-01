/* =========================================================
   ✅ APP PRE-SELL (ML API via PROXY)
   - Se tiver ?url=LINK_DO_ML ou ?item=MLB5022231220
     ele busca (via /api/ml):
     ✅ título, preço, imagens, descrição, condição
     ✅ variações (tamanhos quando disponíveis)
     ✅ frete grátis (quando disponível)
   - Captura UTMs e anexa ao outbound
   - Contador + redirecionamento
   - Meta Pixel events: PageView, ViewContent, Engaged, Scroll, Outbound
   - ✅ NOVO: Bloco "OFERTA RELÂMPAGO" estilo Mercado Livre
     ✅ Preço atual = 47% do preço anterior
     ✅ Preço anterior = preçoAtual / 0.47
     ✅ Desconto = 53% OFF
     ✅ Timer "Encerra em" (parametrizável por query)
   ========================================================= */

(() => {
  "use strict";

  /* -----------------------------
     ✅ CONFIG
     ----------------------------- */
  const PIXEL_ID = "SEU_PIXEL_ID_AQUI";
  const DEFAULT_REDIRECT_SECONDS = 999;
  const FALLBACK_ML_URL = "https://www.mercadolivre.com.br/";

  // ✅ Proxy na mesma origem (server.js serve em 5500)
  const ML_PROXY_ENDPOINT = "/api/ml";

  // ✅ Fallback (se você quiser manter uma “segunda chance”)
  const ML_DIRECT_ITEM_API_BASE = "https://api.mercadolibre.com/items";

  // ✅ Promo (Oferta Relâmpago)
  const PROMO_PRICE_RATIO = 0.47;             // preço atual representa 47% do anterior
  const PROMO_DISCOUNT_PERCENT = 53;          // 53% OFF (fixo por regra)
  const PROMO_DEFAULT_SECONDS = 1 * 3600 + 46 * 60 + 16; // 01:46:16 (igual o print)

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
    } catch (e) {
      return url;
    }
  }

  function pixelTrack(eventName, payload = {}) {
    try {
      if (typeof window.fbq === "function") window.fbq("track", eventName, payload);
    } catch (err) {}
  }

  function initPixelIfReady() {
    if (!PIXEL_ID || PIXEL_ID === "SEU_PIXEL_ID_AQUI") return;
    try {
      if (typeof window.fbq === "function") window.fbq("init", PIXEL_ID);
    } catch (err) {}
  }

  async function copyToClipboard(text) {
    const t = String(text || "").trim();
    if (!t) return false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(t);
        return true;
      }
    } catch (e) {}

    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch (e2) {
      return false;
    }
  }

  function showError(msg) {
    const box = el("errorBox");
    if (!box) return;
    box.textContent = msg;
    box.style.display = "block";
  }

  function hideSkeleton() {
    const sk = el("mediaSkeleton");
    if (sk) sk.style.display = "none";
  }

  function renderThumbs(imageUrls, onPick) {
    const thumbs = el("thumbs");
    if (!thumbs) return;
    thumbs.innerHTML = "";

    imageUrls.forEach((src, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "thumb" + (idx === 0 ? " is-active" : "");
      btn.setAttribute("aria-label", "Selecionar imagem " + (idx + 1));

      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = src;

      btn.appendChild(img);

      btn.addEventListener("click", () => {
        Array.from(thumbs.querySelectorAll(".thumb")).forEach((t) => t.classList.remove("is-active"));
        btn.classList.add("is-active");
        onPick(src);
      });

      thumbs.appendChild(btn);
    });
  }

  function goOutbound(url) {
    pixelTrack("Outbound", { destination: url });
    window.location.href = url;
  }

  function formatBRL(value) {
    if (!Number.isFinite(value)) return "—";
    try {
      return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    } catch {
      return "R$ " + String(value);
    }
  }

  function pad2(n) {
    const x = Math.max(0, Math.floor(Number(n) || 0));
    return String(x).padStart(2, "0");
  }

  function formatHHMMSS(totalSeconds) {
    const t = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hh = Math.floor(t / 3600);
    const mm = Math.floor((t % 3600) / 60);
    const ss = t % 60;
    return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
  }

  /* -----------------------------
     ✅ PROMO (OFERTA RELÂMPAGO)
     ----------------------------- */
  function computeOldPriceFromCurrent(currentPrice) {
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;

    // ✅ preço anterior = preço atual / 0.47
    const old = currentPrice / PROMO_PRICE_RATIO;

    // ✅ arredondamento para ficar com cara de preço real (2 casas)
    return Math.round(old * 100) / 100;
  }

  function setPromoTexts(currentPrice) {
    const promoBox = el("promoBox");
    const oldPriceEl = el("oldPriceValue");
    const discountEl = el("discountValue");

    // Se não existir o bloco no HTML, só segue o baile.
    if (!promoBox) return;

    // Se não tiver preço, não dá pra inventar preço antigo.
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      promoBox.style.display = "none";
      return;
    }

    const oldPrice = computeOldPriceFromCurrent(currentPrice);

    // Caso algo dê errado, esconde o bloco pra não ficar feio (promo fantasma).
    if (!Number.isFinite(oldPrice) || oldPrice <= 0) {
      promoBox.style.display = "none";
      return;
    }

    promoBox.style.display = ""; // garante visível
    if (oldPriceEl) oldPriceEl.textContent = formatBRL(oldPrice);
    if (discountEl) discountEl.textContent = `${PROMO_DISCOUNT_PERCENT}% OFF`;
  }

  function getPromoSecondsFromQuery(params) {
    // ✅ Opção 1: ?promo=SEGUNDOS
    const promoSeconds = Number(params.get("promo"));
    if (Number.isFinite(promoSeconds) && promoSeconds > 0) return Math.floor(promoSeconds);

    // ✅ Opção 2: ?promo_end=TIMESTAMP/ISO
    // - Se for número grande, pode ser timestamp em ms
    // - Se for string ISO, Date.parse resolve
    const promoEndRaw = params.get("promo_end");
    if (promoEndRaw && String(promoEndRaw).trim()) {
      const s = String(promoEndRaw).trim();

      // timestamp numérico?
      const asNum = Number(s);
      if (Number.isFinite(asNum) && asNum > 0) {
        const endMs = asNum > 1e12 ? asNum : asNum * 1000; // tenta inferir ms vs s
        const nowMs = Date.now();
        const diffSec = Math.floor((endMs - nowMs) / 1000);
        if (diffSec > 0) return diffSec;
      }

      // ISO / texto parseável
      const parsed = Date.parse(s);
      if (Number.isFinite(parsed)) {
        const diffSec = Math.floor((parsed - Date.now()) / 1000);
        if (diffSec > 0) return diffSec;
      }
    }

    // ✅ Padrão: 01:46:16 (igual ao print)
    return PROMO_DEFAULT_SECONDS;
  }

  function startPromoCountdown(params) {
    const promoEndsInEl = el("promoEndsIn");
    const promoBox = el("promoBox");

    if (!promoEndsInEl || !promoBox) return;

    let promoSeconds = getPromoSecondsFromQuery(params);

    // inicial
    promoEndsInEl.textContent = formatHHMMSS(promoSeconds);

    const tick = setInterval(() => {
      promoSeconds -= 1;

      if (promoSeconds <= 0) {
        promoEndsInEl.textContent = "00:00:00";
        clearInterval(tick);

        // opcional: esconder o banner quando acabar
        // promoBox.style.display = "none";
        return;
      }

      promoEndsInEl.textContent = formatHHMMSS(promoSeconds);
    }, 1000);
  }

  /* -----------------------------
     ✅ ML HELPERS
     ----------------------------- */

  function extractMlItemIdFromText(text) {
    const s = String(text || "");
    const m = s.match(/MLB-?\d+/i);
    if (!m) return null;
    return m[0].toUpperCase().replace("-", "");
  }

  async function fetchJson(url) {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  }

  async function fetchFromProxy(itemId) {
    const url = `${ML_PROXY_ENDPOINT}?item=${encodeURIComponent(itemId)}`;
    const data = await fetchJson(url);

    if (!data || data.ok !== true) {
      const msg = data?.error ? String(data.error) : "Proxy retornou erro";
      throw new Error(msg);
    }

    return data;
  }

  // ✅ “Plano B” se você ainda quiser tentar direto do ML quando não tiver proxy rodando
  async function fetchDirectFromMl(itemId) {
    const itemUrl = `${ML_DIRECT_ITEM_API_BASE}/${encodeURIComponent(itemId)}`;
    const descUrl = `${ML_DIRECT_ITEM_API_BASE}/${encodeURIComponent(itemId)}/description`;

    const [item, desc] = await Promise.all([
      fetchJson(itemUrl),
      fetchJson(descUrl).catch(() => ({ plain_text: "" }))
    ]);

    const pictures = Array.isArray(item?.pictures)
      ? item.pictures.map(p => p?.secure_url || p?.url).filter(Boolean)
      : [];

    const sizesSet = new Set();
    if (Array.isArray(item?.variations)) {
      for (const v of item.variations) {
        const comb = Array.isArray(v.attribute_combinations) ? v.attribute_combinations : [];
        for (const a of comb) {
          const name = String(a?.name || "").toLowerCase();
          const val = String(a?.value_name || "").trim();
          if (!val) continue;
          if (name.includes("tamanho") || name.includes("size") || name.includes("tam")) sizesSet.add(val);
        }
      }
    }

    return {
      ok: true,
      item_id: item.id,
      title: item.title,
      price: item.price,
      currency: item.currency_id,
      condition: item.condition,
      sold_quantity: item.sold_quantity,
      free_shipping: !!item?.shipping?.free_shipping,
      pictures,
      sizes: Array.from(sizesSet),
      description: desc?.plain_text || "",
      permalink: item.permalink
    };
  }

  function setChips(data) {
    const chipsWrap = el("chips");
    if (!chipsWrap) return;

    chipsWrap.innerHTML = "";

    if (data?.free_shipping === true) {
      const c = document.createElement("span");
      c.className = "chip is-good";
      c.textContent = "Frete grátis";
      chipsWrap.appendChild(c);
    } else {
      const c = document.createElement("span");
      c.className = "chip";
      c.textContent = "Frete no Mercado Livre";
      chipsWrap.appendChild(c);
    }

    const cond = data?.condition === "new" ? "Novo" : (data?.condition === "used" ? "Usado" : "Condição");
    const c2 = document.createElement("span");
    c2.className = "chip";
    c2.textContent = cond;
    chipsWrap.appendChild(c2);

    if (Number.isFinite(data?.sold_quantity)) {
      const c3 = document.createElement("span");
      c3.className = "chip";
      c3.textContent = `+${data.sold_quantity} vendidos`;
      chipsWrap.appendChild(c3);
    }

    const sizes = Array.isArray(data?.sizes) ? data.sizes : [];
    if (sizes.length) {
      const c4 = document.createElement("span");
      c4.className = "chip";
      c4.textContent = `Tamanhos: ${sizes.join(", ")}`;
      chipsWrap.appendChild(c4);
    }
  }

  function setMainImageAndThumbs(data) {
    const mainImageEl = el("mainImage");
    const images = Array.isArray(data?.pictures)
      ? data.pictures.map(s => String(s || "").trim()).filter(Boolean)
      : [];

    if (!mainImageEl) return;

    if (images.length) {
      mainImageEl.src = images[0];
      mainImageEl.addEventListener("load", hideSkeleton, { once: true });
      mainImageEl.addEventListener("error", () => {
        showError("Não foi possível carregar a imagem do produto. Você ainda pode abrir no Mercado Livre.");
        hideSkeleton();
      }, { once: true });

      renderThumbs(images, (src) => { mainImageEl.src = src; });
    } else {
      setTimeout(hideSkeleton, 600);
    }
  }

  function setTexts(data) {
    const titleEl = el("productTitle");
    if (titleEl) titleEl.textContent = safeText(data?.title, "Oferta verificada");

    const subtitleEl = el("productSubtitle");
    if (subtitleEl) subtitleEl.textContent = "Você concluirá a compra no Mercado Livre com segurança.";

    const priceEl = el("priceValue");
    if (priceEl) priceEl.textContent = Number.isFinite(data?.price) ? formatBRL(data.price) : "—";

    // ✅ NOVO: popular bloco de oferta relâmpago (preço antigo + % off)
    setPromoTexts(Number.isFinite(data?.price) ? data.price : NaN);

    const descEl = el("descText");
    if (descEl) descEl.textContent = safeText(data?.description, "Os detalhes completos estarão disponíveis no Mercado Livre.");

    const catEl = el("categoryPill");
    if (catEl) catEl.textContent = "Mercado Livre";

    const footCat = el("footCategory");
    if (footCat) footCat.textContent = "—";

    const sourceEl = el("sourcePill");
    if (sourceEl) sourceEl.textContent = "Origem: Mercado Livre";
  }

  /* -----------------------------
     ✅ MAIN
     ----------------------------- */
  document.addEventListener("DOMContentLoaded", async () => {
    const year = el("year");
    if (year) year.textContent = String(new Date().getFullYear());

    const params = getParams();
    const utmObj = getUtmObject(params);

    initPixelIfReady();
    pixelTrack("PageView");

    // ✅ NOVO: inicia contador da OFERTA (independente do redirecionamento)
    startPromoCountdown(params);

    const utmEl = el("footUtm");
    if (utmEl) {
      const utmKeys = Object.keys(utmObj);
      if (!utmKeys.length) utmEl.textContent = "UTM: —";
      else utmEl.textContent = "UTM: " + utmKeys.map(k => `${k}=${utmObj[k]}`).join(" | ");
    }

    const rawUrl = params.get("url") || FALLBACK_ML_URL;
    const finalUrl = appendUtmToUrl(rawUrl, utmObj);

    const goBtn = el("goMlBtn");
    if (goBtn) goBtn.addEventListener("click", () => goOutbound(finalUrl));

    const copyBtn = el("copyLinkBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const ok = await copyToClipboard(finalUrl);
        if (ok) {
          copyBtn.textContent = "Link copiado ✅";
          setTimeout(() => (copyBtn.textContent = "Copiar link"), 1400);
        } else {
          showError("Não foi possível copiar o link automaticamente. Você ainda pode clicar em “Ver no Mercado Livre”.");
        }
      });
    }

    const itemParam = params.get("item");
    const urlParam = params.get("url");
    const candidate = itemParam || urlParam || "";
    const mlItemId = extractMlItemIdFromText(candidate);

    if (mlItemId) {
      try {
        // ✅ Tenta PROXY primeiro
        let data;
        try {
          data = await fetchFromProxy(mlItemId);
        } catch (e) {
          // ✅ Se proxy não estiver rodando, tenta direto
          data = await fetchDirectFromMl(mlItemId);
        }

        setTexts(data);
        setMainImageAndThumbs(data);
        setChips(data);

        pixelTrack("ViewContent", {
          content_name: safeText(data?.title, "Oferta verificada"),
          content_category: "Mercado Livre",
          value: Number.isFinite(data?.price) ? data.price : 0,
          currency: safeText(data?.currency, "BRL"),
          destination: finalUrl
        });
      } catch (err) {
        showError(
          "Não consegui puxar os dados automaticamente agora. " +
          "A oferta ainda pode ser aberta normalmente no botão."
        );
        hideSkeleton();

        // Se não puxou preço, esconde promo (pra não ficar “—” com cara triste)
        const promoBox = el("promoBox");
        if (promoBox) promoBox.style.display = "none";
      }
    } else {
      hideSkeleton();
      pixelTrack("ViewContent", {
        content_name: "Oferta verificada",
        destination: finalUrl
      });

      // Sem item, sem preço: esconde promo
      const promoBox = el("promoBox");
      if (promoBox) promoBox.style.display = "none";
    }

    setTimeout(() => {
      pixelTrack("Engaged", { destination: finalUrl });
    }, 10000);

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
        pixelTrack("Scroll", { percent: 60 });
      }
    }, { passive: true });

    const countdownEl = el("countdown");
    const timerBox = el("timerBox");

    let seconds = Number(params.get("redirect"));
    if (!Number.isFinite(seconds) || seconds <= 0) seconds = DEFAULT_REDIRECT_SECONDS;

    if (countdownEl) countdownEl.textContent = String(seconds);

    if (!finalUrl || !String(finalUrl).trim()) {
      if (timerBox) timerBox.style.display = "none";
      showError("Link do produto inválido. Verifique o parâmetro 'url' na sua pre-sell.");
      return;
    }

    const it = setInterval(() => {
      seconds -= 1;
      if (countdownEl) countdownEl.textContent = String(Math.max(0, seconds));

      if (seconds <= 0) {
        clearInterval(it);
        goOutbound(finalUrl);
      }
    }, 1000);
  });
})();