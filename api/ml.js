// /api/ml.js
// ✅ Proxy do Mercado Livre usando OAuth (refresh token -> access token)
// ✅ Retorna dados do item para o front sem CORS
// ✅ Se der erro, devolve upstream_status + snippet para diagnóstico (sem mistério)

module.exports = async (req, res) => {
  try {
    // ✅ CORS básico
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "OPTIONS") return res.status(204).end();

    const clientId = process.env.ML_CLIENT_ID;
    const clientSecret = process.env.ML_CLIENT_SECRET;
    const refreshToken = process.env.ML_REFRESH_TOKEN;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ ok: false, error: "ML_CLIENT_ID/ML_CLIENT_SECRET ausentes no Vercel." });
    }

    if (!refreshToken) {
      return res.status(500).json({
        ok: false,
        error: "ML_REFRESH_TOKEN ausente. Rode /api/oauth/start, autorize e salve o refresh token no Vercel."
      });
    }

    const itemRaw = String(req.query.item || "").trim().toUpperCase();
    const item = itemRaw.replace("-", "");

    if (!item || !/^MLB\\d+$/.test(item)) {
      return res.status(400).json({ ok: false, error: "Parâmetro 'item' inválido. Ex: MLB5022231220" });
    }

    // ✅ 1) Refresh: pega access_token novo
    const tokenUrl = "https://api.mercadolibre.com/oauth/token";
    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
    body.set("refresh_token", refreshToken);

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });

    const tokenText = await tokenRes.text();
    let tokenJson = null;
    try { tokenJson = JSON.parse(tokenText); } catch {}

    if (!tokenRes.ok) {
      return res.status(502).json({
        ok: false,
        error: "Falha ao renovar access_token via refresh_token",
        upstream_status: tokenRes.status,
        upstream_body_snippet: String(tokenText || "").slice(0, 300)
      });
    }

    const accessToken = tokenJson?.access_token;
    if (!accessToken) {
      return res.status(502).json({
        ok: false,
        error: "Refresh OK mas access_token não veio na resposta",
        upstream_body_snippet: String(tokenText || "").slice(0, 300)
      });
    }

    // ✅ 2) Busca item + descrição com Bearer token
    const itemUrl = `https://api.mercadolibre.com/items/${encodeURIComponent(item)}`;
    const descUrl = `https://api.mercadolibre.com/items/${encodeURIComponent(item)}/description`;

    const headers = {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0"
    };

    const safeReadText = async (resp) => {
      try { return await resp.text(); } catch { return ""; }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const [itemRes, descRes] = await Promise.all([
      fetch(itemUrl, { headers, signal: controller.signal }),
      fetch(descUrl, { headers, signal: controller.signal }).catch(() => null)
    ]).finally(() => clearTimeout(timeout));

    if (!itemRes || !itemRes.ok) {
      const status = itemRes ? itemRes.status : 0;
      const bodySnippet = itemRes ? (await safeReadText(itemRes)).slice(0, 300) : "";
      return res.status(502).json({
        ok: false,
        error: "Falha ao buscar item no Mercado Livre (autenticado)",
        upstream_status: status,
        upstream_body_snippet: bodySnippet
      });
    }

    const itemJson = await itemRes.json();

    let descJson = { plain_text: "" };
    if (descRes && descRes.ok) {
      try { descJson = await descRes.json(); } catch { descJson = { plain_text: "" }; }
    }

    // ✅ Imagens
    const pictures = Array.isArray(itemJson?.pictures)
      ? itemJson.pictures.map(p => p?.secure_url || p?.url).filter(Boolean)
      : [];

    // ✅ Tamanhos (quando houver)
    const sizesSet = new Set();
    if (Array.isArray(itemJson?.variations)) {
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

    return res.status(200).json({
      ok: true,
      item_id: itemJson?.id || item,
      title: itemJson?.title || "",
      price: Number(itemJson?.price) || 0,
      currency: itemJson?.currency_id || "BRL",
      condition: itemJson?.condition || "",
      sold_quantity: Number(itemJson?.sold_quantity) || 0,
      free_shipping: !!itemJson?.shipping?.free_shipping,
      pictures,
      sizes: Array.from(sizesSet),
      description: descJson?.plain_text || "",
      permalink: itemJson?.permalink || ""
    });
  } catch (err) {
    const msg = String(err?.message || err);
    const isAbort = msg.toLowerCase().includes("aborted") || msg.toLowerCase().includes("abort");

    return res.status(500).json({
      ok: false,
      error: isAbort ? "Timeout ao consultar Mercado Livre" : "Erro interno no proxy",
      detail: msg
    });
  }
};