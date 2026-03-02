// /api/oauth/start.js
// ✅ Inicia o OAuth do Mercado Livre (redireciona para a tela de autorização)

module.exports = async (req, res) => {
  try {
    const clientId = process.env.ML_CLIENT_ID;

    if (!clientId) {
      return res.status(500).send("ERRO: ML_CLIENT_ID não configurado nas Environment Variables.");
    }

    // ✅ Usamos o redirect configurado no Developers (recomendado setar também no env)
    // Ex: https://samitostore.vercel.app/api/oauth/callback
    const redirectUri =
      process.env.ML_REDIRECT_URI ||
      `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/oauth/callback`;

    // ✅ state simples para evitar callback aleatório
    const state = `st_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const authUrl = new URL("https://auth.mercadolivre.com.br/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    // ✅ Redireciona para a autorização do ML
    res.statusCode = 302;
    res.setHeader("Location", authUrl.toString());
    res.end();
  } catch (err) {
    res.status(500).send("ERRO no /api/oauth/start: " + String(err?.message || err));
  }
};