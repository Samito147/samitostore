export default async function handler(req, res) {
  try {
    // ✅ CORS básico para permitir chamada do seu GitHub Pages
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

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

    const [itemRes, descRes] = await Promise.all([
      fetch(itemUrl, { headers: { "User-Agent": "Mozilla/5.0" } }),
      fetch(descUrl, { headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null)
    ]);

    if (!itemRes.ok) {
      return res.status(502).json({ ok: false, error: `ML item API HTTP ${itemRes.status}` });
    }

    const itemJson = await itemRes.json();
    const descJson = descRes && descRes.ok ? await descRes.json() : { plain_text: "" };

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
    return res.status(500).json({
      ok: false,
      error: "Erro interno no proxy",
      detail: String(err?.message || err)
    });
  }
}