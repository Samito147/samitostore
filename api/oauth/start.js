// /api/oauth/start.js
// ✅ Inicia OAuth do Mercado Livre (redirect_uri fixo via ML_REDIRECT_URI)

module.exports = async (req, res) => {
  try {
    const clientId = process.env.ML_CLIENT_ID;
    const redirectUri = process.env.ML_REDIRECT_URI;

    if (!clientId) {
      return res.status(500).send("ERRO: ML_CLIENT_ID não configurado nas Environment Variables.");
    }

    if (!redirectUri) {
      return res.status(500).send(
        "ERRO: ML_REDIRECT_URI não configurado. Use exatamente: https://samitostore.vercel.app/api/oauth/callback"
      );
    }

    // ✅ state simples
    const state = `st_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const authUrl = new URL("https://auth.mercadolivre.com.br/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    res.statusCode = 302;
    res.setHeader("Location", authUrl.toString());
    res.end();
  } catch (err) {
    res.status(500).send("ERRO no /api/oauth/start: " + String(err?.message || err));
  }
};
