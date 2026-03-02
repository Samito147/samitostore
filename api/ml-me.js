// /api/ml-me.js
// ✅ Teste de controle: confirma se o access_token está válido e se o ML libera algum endpoint autenticado

module.exports = async (req, res) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "OPTIONS") return res.status(204).end();

    const clientId = process.env.ML_CLIENT_ID;
    const clientSecret = process.env.ML_CLIENT_SECRET;
    const refreshToken = process.env.ML_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(500).json({
        ok: false,
        error: "Env vars ausentes: ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REFRESH_TOKEN"
      });
    }

    // 1) refresh -> access token
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
        error: "Falha ao renovar token",
        upstream_status: tokenRes.status,
        upstream_body_snippet: String(tokenText || "").slice(0, 300)
      });
    }

    const accessToken = tokenJson?.access_token;
    if (!accessToken) {
      return res.status(502).json({
        ok: false,
        error: "access_token não veio",
        upstream_body_snippet: String(tokenText || "").slice(0, 300)
      });
    }

    // 2) chama users/me
    const meRes = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const meText = await meRes.text();
    return res.status(200).json({
      ok: true,
      users_me_ok: meRes.ok,
      users_me_status: meRes.status,
      users_me_snippet: meText.slice(0, 300)
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
};