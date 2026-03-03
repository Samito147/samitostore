// /api/oauth/callback.js
// ✅ Recebe o "code" do ML e troca por access_token + refresh_token
// ✅ Mostra o refresh_token para você salvar no Vercel (ML_REFRESH_TOKEN)

module.exports = async (req, res) => {
  try {
    const clientId = process.env.ML_CLIENT_ID;
    const clientSecret = process.env.ML_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).send("ERRO: ML_CLIENT_ID e/ou ML_CLIENT_SECRET não configurados no Vercel.");
    }

    const code = String(req.query.code || "").trim();
    const state = String(req.query.state || "").trim();

    if (!code) {
      return res.status(400).send("ERRO: callback sem 'code'. Verifique o redirect no Developers.");
    }

    const redirectUri =
      process.env.ML_REDIRECT_URI ||
      `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/oauth/callback`;

    // ✅ Troca code -> tokens
    const tokenUrl = "https://api.mercadolibre.com/oauth/token";
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
    body.set("code", code);
    body.set("redirect_uri", redirectUri);

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });

    const tokenText = await tokenRes.text();
    let tokenJson = null;
    try { tokenJson = JSON.parse(tokenText); } catch {}

    if (!tokenRes.ok) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(500).send(
        "ERRO ao obter tokens do Mercado Livre.\n\n" +
        "HTTP: " + tokenRes.status + "\n" +
        "Resposta: " + tokenText + "\n"
      );
    }

    const accessToken = tokenJson?.access_token || "";
    const refreshToken = tokenJson?.refresh_token || "";
    const expiresIn = Number(tokenJson?.expires_in) || 0;

    // ✅ Página HTML simples (sem depender de front)
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    const safe = (v) => String(v || "").replace(/[<>&]/g, (m) => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;" }[m]));

    return res.status(200).send(`
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>OAuth Mercado Livre - OK</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#0b0f17;color:#e7eefc;margin:0;padding:24px}
    .card{max-width:900px;margin:0 auto;background:#121a2a;border:1px solid #223055;border-radius:14px;padding:18px}
    h1{margin:0 0 10px;font-size:20px}
    p{margin:8px 0;line-height:1.4}
    pre{white-space:pre-wrap;word-break:break-all;background:#0a1020;border:1px solid #223055;border-radius:10px;padding:12px}
    .ok{color:#67e8a5}
    .warn{color:#ffd166}
    .small{opacity:.85;font-size:13px}
  </style>
</head>
<body>
  <div class="card">
    <h1 class="ok">✅ OAuth concluído com sucesso</h1>
    <p class="small">state recebido: <b>${safe(state)}</b></p>

    <p><b>Próximo passo obrigatório:</b> copie o <span class="warn">REFRESH TOKEN</span> abaixo e salve no Vercel em <b>Environment Variables</b> como:</p>
    <p><b>ML_REFRESH_TOKEN</b> = (valor abaixo)</p>

    <pre>${safe(refreshToken)}</pre>

    <p class="small">Access token (curto, só pra debug):</p>
    <pre>${safe(accessToken)}</pre>

    <p class="small">expires_in: <b>${safe(expiresIn)}</b> segundos</p>

    <p><b>Depois de salvar o ML_REFRESH_TOKEN no Vercel:</b> faça redeploy e teste:</p>
    <pre>/api/ml?item=MLB5022231220</pre>

    <p class="small">Se você chegou até aqui, metade do chefão já caiu. Agora é só o loot. 😄</p>
  </div>
</body>
</html>
    `);
  } catch (err) {
    res.status(500).send("ERRO no /api/oauth/callback: " + String(err?.message || err));
  }
};