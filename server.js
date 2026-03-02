import express from "express";

/* =========================================================
   ✅ DEV SERVER (LOCAL) - PROXY ML
   - Serve arquivos estáticos do projeto
   - Proxy: GET /api/ml?item=MLB...
   - Resolve bloqueios comuns do ML com:
     ✅ headers + referer/origin
     ✅ retry/backoff (403/429)
     ✅ endpoint alternativo: /items?ids=...
     ✅ cache em memória
   - ✅ Correções aplicadas:
     ✅ removeu "AC" acidental no cacheSet
     ✅ removeu "Q" acidental no final do arquivo
     ✅ adicionou timeout pra fetch não travar
   ========================================================= */

const app = express();
const PORT = 5500;

app.use(express.static(process.cwd()));

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ✅ Cache simples (evita chamar ML em todo refresh)
const CACHE_TTL_MS = 60 * 1000; // 60s
const cache = new Map(); // key -> { exp, payload }

function cacheGet(key) {
  const it = cache.get(key);
  if (!it) return null;
  if (Date.now() > it.exp) {
    cache.delete(key);
    return null;
  }
  return it.payload;
}

function cacheSet(key, payload) {
  cache.set(key, { exp: Date.now() + CACHE_TTL_MS, payload });
}

function pickHeaders() {
  // ✅ “Parecer navegador” (e incluir referer/origin) ajuda MUITO em WAF
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Referer": "https://www.mercadolivre.com.br/",
    "Origin": "https://www.mercadolivre.com.br/",
    "Connection": "keep-alive"
  };
}

/* -----------------------------
   ✅ Fetch com timeout
   - Evita travar o dev quando a API demora
   ----------------------------- */
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchTextWithStatus(url) {
  const res = await fetchWithTimeout(
    url,
    { method: "GET", headers: pickHeaders() },
    8000
  );

  const text = await res.text();

  let json = null;
  try { json = JSON.parse(text); } catch (_) {}

  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    url,
    json,
    text
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * ✅ Tenta buscar com retries e backoff
 * - Útil pra 403/429 intermitentes
 */
async function fetchWithRetry(url, tries = 3) {
  let last = null;

  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetchTextWithStatus(url);
      last = r;

      // ✅ sucesso
      if (r.ok) return r;

      // ✅ se 404, nem insiste
      if (r.status === 404) return r;

      // ✅ 403/429: tenta novamente com backoff
      if (r.status === 403 || r.status === 429) {
        const wait = 500 * Math.pow(2, i); // 500ms, 1s, 2s...
        console.log(`⚠️ Retry ${i + 1}/${tries} (${r.status}) aguardando ${wait}ms...`);
        await sleep(wait);
        continue;
      }

      // ✅ outros erros: tenta 1 retry leve e segue
      await sleep(250);
    } catch (err) {
      last = {
        ok: false,
        status: 0,
        statusText: "FetchError/Timeout",
        url,
        json: null,
        text: String(err?.message || err)
      };

      const wait = 400 * Math.pow(2, i);
      console.log(`⚠️ Fetch falhou (tentativa ${i + 1}/${tries}) aguardando ${wait}ms...`, last.text);
      await sleep(wait);
    }
  }

  return last;
}

/**
 * ✅ Endpoint alternativo: /items?ids=MLB...
 * Às vezes passa quando /items/:id é bloqueado.
 */
async function fetchItemViaIds(item) {
  const url = `https://api.mercadolibre.com/items?ids=${encodeURIComponent(item)}`;
  const r = await fetchWithRetry(url, 3);

  // Formato típico: [{ code: 200, body: {...} }]
  if (!r.ok) return r;

  const arr = Array.isArray(r.json) ? r.json : null;
  if (!arr || !arr.length) {
    return { ...r, ok: false, status: 502, statusText: "Bad Gateway", text: "Resposta inesperada items?ids" };
  }

  const first = arr[0];
  const code = Number(first?.code);
  const body = first?.body;

  if (code === 200 && body) {
    return { ok: true, status: 200, statusText: "OK", url, json: body, text: "" };
  }

  return {
    ok: false,
    status: code || 502,
    statusText: "ML ids code != 200",
    url,
    json: first,
    text: ""
  };
}

app.options("/api/ml", (req, res) => {
  setCors(res);
  return res.status(204).end();
});

app.get("/api/ml", async (req, res) => {
  try {
    setCors(res);

    const item = String(req.query.item || "").trim().toUpperCase().replace("-", "");
    if (!item || !/^MLB\d+$/.test(item)) {
      return res.status(400).json({ ok: false, error: "Parâmetro 'item' inválido. Ex: MLB5022231220" });
    }

    // ✅ Cache
    const cached = cacheGet(item);
    if (cached) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ...cached, cached: true });
    }

    const itemUrl = `https://api.mercadolibre.com/items/${encodeURIComponent(item)}`;
    const descUrl = `https://api.mercadolibre.com/items/${encodeURIComponent(item)}/description`;

    // ✅ 1) tenta /items/:id
    let itemR = await fetchWithRetry(itemUrl, 3);

    // ✅ 2) se falhar (403/429 principalmente), tenta /items?ids=
    if (!itemR?.ok && (itemR?.status === 403 || itemR?.status === 429)) {
      console.log("🔁 Tentando endpoint alternativo: /items?ids=");
      itemR = await fetchItemViaIds(item);
    }

    // ✅ descrição também pode bloquear — se falhar, só segue com descrição vazia
    const descR = await fetchWithRetry(descUrl, 2);

    if (!itemR?.ok) {
      console.log("❌ ML ITEM FAIL:", {
        status: itemR?.status,
        statusText: itemR?.statusText,
        url: itemR?.url,
        bodyPreview: String(itemR?.text || "").slice(0, 180)
      });

      return res.status(itemR?.status || 500).json({
        ok: false,
        error: "Falha ao buscar item no ML",
        details: {
          status: itemR?.status,
          statusText: itemR?.statusText,
          hint: "Se 429 é rate limit. Se 403 é bloqueio (WAF).",
          endpoint: "GET /items/:id (ou fallback /items?ids=)"
        }
      });
    }

    const itemJson = itemR.json || {};
    const descJson = descR?.ok ? (descR.json || {}) : { plain_text: "" };

    const pictures = Array.isArray(itemJson.pictures)
      ? itemJson.pictures.map(p => p?.secure_url || p?.url).filter(Boolean)
      : [];

    const sizesSet = new Set();
    if (Array.isArray(itemJson.variations)) {
      for (const v of itemJson.variations) {
        const comb = Array.isArray(v.attribute_combinations) ? v.attribute_combinations : [];
        for (const a of comb) {
          const name = String(a?.name || "").toLowerCase();
          const val = String(a?.value_name || "").trim();
          if (!val) continue;
          if (name.includes("tamanho") || name.includes("size") || name.includes("tam")) sizesSet.add(val);
        }
      }
    }

    const payload = {
      ok: true,
      item_id: itemJson.id || item,
      title: itemJson.title || "",
      price: Number(itemJson.price) || 0,
      currency: itemJson.currency_id || "BRL",
      condition: itemJson.condition || "",
      sold_quantity: Number(itemJson.sold_quantity) || 0,
      free_shipping: !!itemJson?.shipping?.free_shipping,
      pictures,
      sizes: Array.from(sizesSet),
      description: descJson?.plain_text || "",
      permalink: itemJson.permalink || ""
    };

    // ✅ CORREÇÃO: removeu "AC" acidental
    cacheSet(item, payload);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(payload);
  } catch (err) {
    console.log("❌ PROXY ERROR:", err);
    return res.status(500).json({ ok: false, error: "Erro interno no proxy" });
  }
});

// ✅ garante que "/" sempre abre index.html
app.get("*", (req, res) => {
  res.sendFile(`${process.cwd()}/index.html`);
});

app.listen(PORT, () => {
  console.log(`✅ Server ON: http://localhost:${PORT}`);
  console.log(`✅ Teste proxy: http://localhost:${PORT}/api/ml?item=MLB5022231220`);
  console.log(`✅ Teste site:  http://localhost:${PORT}/?item=MLB5022231220`);
});