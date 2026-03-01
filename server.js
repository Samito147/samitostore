import express from "express";

const app = express();
const PORT = 5500;

app.use(express.static(process.cwd()));

function pickHeaders() {
  // ✅ Headers "de gente" (ajuda a evitar bloqueios em alguns ambientes)
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
  };
}

async function fetchJsonWithStatus(url) {
  const res = await fetch(url, { method: "GET", headers: pickHeaders() });
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

app.get("/api/ml", async (req, res) => {
  try {
    const item = String(req.query.item || "").trim().toUpperCase().replace("-", "");
    if (!item || !/^MLB\d+$/.test(item)) {
      return res.status(400).json({ ok: false, error: "Parâmetro 'item' inválido. Ex: MLB5022231220" });
    }

    const itemUrl = `https://api.mercadolibre.com/items/${encodeURIComponent(item)}`;
    const descUrl = `https://api.mercadolibre.com/items/${encodeURIComponent(item)}/description`;

    // ✅ 1) tenta items
    const [itemR, descR] = await Promise.all([
      fetchJsonWithStatus(itemUrl),
      fetchJsonWithStatus(descUrl)
    ]);

    // ✅ log detalhado no terminal (pra você ver o motivo real)
    if (!itemR.ok) {
      console.log("❌ ML ITEM FAIL:", {
        status: itemR.status,
        statusText: itemR.statusText,
        url: itemR.url,
        bodyPreview: String(itemR.text || "").slice(0, 180)
      });

      // Retorna erro detalhado pro front (sem expor texto gigante)
      return res.status(itemR.status).json({
        ok: false,
        error: "Falha ao buscar item no ML",
        details: {
          status: itemR.status,
          statusText: itemR.statusText,
          hint: "Se status=429 é rate limit. Se 403 é bloqueio. Se 404 item inexistente.",
          endpoint: "GET /items/:id"
        }
      });
    }

    const itemJson = itemR.json || {};
    const descJson = descR.ok ? (descR.json || {}) : { plain_text: "" };

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
      item_id: itemJson.id,
      title: itemJson.title,
      price: itemJson.price,
      currency: itemJson.currency_id,
      condition: itemJson.condition,
      sold_quantity: itemJson.sold_quantity,
      free_shipping: !!itemJson?.shipping?.free_shipping,
      pictures,
      sizes: Array.from(sizesSet),
      description: descJson?.plain_text || "",
      permalink: itemJson.permalink
    };

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(payload);
  } catch (err) {
    console.log("❌ PROXY ERROR:", err);
    return res.status(500).json({ ok: false, error: "Erro interno no proxy" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server ON: http://localhost:${PORT}`);
  console.log(`✅ Teste proxy: http://localhost:${PORT}/api/ml?item=MLB5022231220`);
});