module.exports = async (req, res) => {
  try {
    // ✅ CORS básico
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(204).end();

    const itemRaw = String(req.query.item || "").trim().toUpperCase();
    const item = itemRaw.replace("-", "");

    if (!item || !/^MLB\d+$/.test(item)) {
      return res.status(400).json({
        ok: false,
        error: "Parâmetro 'item' inválido. Ex: MLB5022231220"
      });
    }

    const itemUrl = `https://api.mercadolibre.com/items/${encodeURIComponent(item)}`;
    const descUrl = `https://api.mercadolibre.com/items/${encodeURIComponent(item)}/description`;

    // ✅ Headers mais completos (evitam bloqueios/antibot em alguns cenários)
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "Referer": "https://www.mercadolivre.com.br/",
      "Origin": "https://www.mercadolivre.com.br/"
    };

    // ✅ Timeout (pra não ficar pendurado e virar 502 do Vercel)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const safeReadText = async (resp) => {
      try { return await resp.text(); } catch { return ""; }
    };

    const [itemRes, descRes] = await Promise.all([
      fetch(itemUrl, { headers, signal: controller.signal }),
      fetch(descUrl, { headers, signal: controller.signal }).catch(() => null)
    ]).finally(() => clearTimeout(timeout));

    // ❗ Se o ML respondeu erro, devolve o erro DE VERDADE (com status + trecho do body)
    if (!itemRes || !itemRes.ok) {
      const status = itemRes ? itemRes.status : 0;
      const body = itemRes ? await safeReadText(itemRes) : "";
      return res.status(502).json({
        ok: false,
        error: "Falha ao buscar item no Mercado Livre",
        upstream_status: status,
        upstream_body_snippet: body.slice(0, 300) // ✅ só um pedacinho
      });
    }

    const itemJson = await itemRes.json();

    let descJson = { plain_text: "" };
    if (descRes && descRes.ok) {
      try { descJson = await descRes.json(); } catch { descJson = { plain_text: "" }; }
    }

    const pictures = Array.isArray(itemJson?.pictures)
      ? itemJson.pictures.map(p => p?.secure_url || p?.url).filter(Boolean)
      : [];

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
