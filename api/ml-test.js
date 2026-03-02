module.exports = async (req, res) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).end();

    // Testes simples e públicos
    const tests = {
      ping: "https://api.mercadolibre.com/sites",
      search_by_id_as_text: "https://api.mercadolibre.com/sites/MLB/search?q=MLB5022231220",
      search_by_keywords: "https://api.mercadolibre.com/sites/MLB/search?q=kit%202%20shorts%20dryfit%202%20em%201"
    };

    const headers = {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json, text/plain, */*"
    };

    const results = {};
    for (const [name, url] of Object.entries(tests)) {
      try {
        const r = await fetch(url, { headers });
        const txt = await r.text();
        results[name] = {
          ok: r.ok,
          status: r.status,
          snippet: txt.slice(0, 220)
        };
      } catch (e) {
        results[name] = { ok: false, status: 0, error: String(e?.message || e) };
      }
    }

    return res.status(200).json({ ok: true, results });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
};