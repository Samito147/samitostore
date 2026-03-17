/*
=========================================================
  SCRIPT PRINCIPAL DA LANDING PAGE
  Arquivo: script.js

  OBJETIVO ATUAL:
  - ativar animações de surgimento no scroll
  - configurar Meta Pixel
  - rastrear eventos relevantes de comportamento
  - preparar hooks para progresso real de vídeo
  - bloquear o restante da página até 60 segundos da VSL principal
  - implementar Micro Conversão Progressiva com segurança
  - exibir toasts sociais elegantes desde o início da página

  EVENTOS RASTREADOS:
  - PageView
  - ViewContent
  - ScrollDepth
  - TimeOnPage
  - SectionView
  - CTA principal
  - WhatsApp
  - Outbound Click
  - VSL visibility
  - Social proof visibility
  - Video progress hooks (prontos para API do player)
  - ContentUnlockedAfter60s

  EVENTOS DE MICRO CONVERSÃO PROGRESSIVA:
  - Engaged
  - Scroll50
  - Scroll90
  - OutboundClick
  - PurchaseIntent

  OBSERVAÇÃO IMPORTANTE:
  Este arquivo mede com precisão tudo que acontece na página.
  Para medir o tempo REAL de reprodução dentro de iframes
  externos, é necessário integrar os eventos/API do player.
=========================================================
*/

"use strict";

/* =========================================================
   CONFIGURAÇÕES GERAIS
   Centraliza constantes do projeto
========================================================= */
const META_PIXEL_ID = "1499447788415728";

/* ---------------------------------------------------------
   Tempo de bloqueio do conteúdo abaixo da VSL principal
   Regra solicitada:
   - exibir inicialmente apenas o texto acima do vídeo + vídeo
   - liberar todo o restante da página após 60 segundos
--------------------------------------------------------- */
const TEMPO_LIBERACAO_CONTEUDO_SEGUNDOS = 60;

/* ---------------------------------------------------------
   Chave usada no localStorage para manter a liberação
   mesmo após atualizar a página
--------------------------------------------------------- */
const CHAVE_LOCALSTORAGE_CONTEUDO_LIBERADO = "mvo_vsl_conteudo_liberado";

/* ---------------------------------------------------------
   Limiares de scroll que serão enviados ao Pixel
--------------------------------------------------------- */
const SCROLL_MARCOS = [25, 50, 75, 90];

/* ---------------------------------------------------------
   Limiares de tempo na página
--------------------------------------------------------- */
const TEMPO_MARCOS_SEGUNDOS = [15, 30, 60, 120, 180];

/* ---------------------------------------------------------
   Limiares para exposição visual da VSL principal
   Isso mede VISIBILIDADE da área do vídeo na tela
--------------------------------------------------------- */
const VSL_MARCOS_SEGUNDOS = [10, 30, 60, 120];

/* ---------------------------------------------------------
   Limiares para vídeos de prova social
   Também mede VISIBILIDADE do bloco na tela
--------------------------------------------------------- */
const PROVA_SOCIAL_MARCOS_SEGUNDOS = [5, 15, 30];

/* ---------------------------------------------------------
   Limiares para progresso real de vídeo
   Estes são usados pelos hooks públicos caso você conecte
   depois a API real do player
--------------------------------------------------------- */
const VIDEO_PROGRESS_MARCOS = [10, 25, 50, 75, 90, 100];

/* ---------------------------------------------------------
   CONFIGURAÇÕES DA MICRO CONVERSÃO PROGRESSIVA
   Define a "escada" de intenção comportamental
--------------------------------------------------------- */
const MICRO_CONVERSAO_CONFIG = {
  engagedSegundos: 30,
  scroll50: 50,
  scroll90: 90,
  purchaseIntentScrollMinimo: 90,
  purchaseIntentTempoMinimo: 30,
  purchaseIntentValor: 289.90,
  contentName: "Máquina de Vendas Online 3.0",
  contentCategory: "landing_page",
  contentType: "product",
  contentId: "maquina-de-vendas-online-3-0",
  currency: "BRL"
};

/* ---------------------------------------------------------
   CONFIGURAÇÕES DOS TOASTS SOCIAIS
   Exibição imediata, sem depender de vídeo
--------------------------------------------------------- */
const TOASTS_SOCIAIS_CONFIG = {
  habilitado: true,
  maxVisiveis: 2,
  tempoVisivelMs: 4600,
  primeiroDelayMinMs: 600,
  primeiroDelayMaxMs: 1800,
  intervaloMinMs: 5200,
  intervaloMaxMs: 9800,
  chancePorCiclo: 0.88
};

/* =========================================================
   ESTADO GLOBAL
   Guarda dados úteis para evitar eventos duplicados
========================================================= */
const estadoTracking = {
  pixelCarregado: false,
  pixelIniciado: false,
  scrollEnviado: new Set(),
  tempoPaginaEnviado: new Set(),
  secoesVistas: new Set(),
  exposicaoBlocos: new Set(),
  progressoVideoEnviado: {
    vsl: new Set(),
    social: new Set()
  },
  contextoPagina: null,
  paginaIniciadaEm: Date.now(),
  conteudoBloqueadoLiberado: false,
  elementosBloqueados: [],

  /* -------------------------------------------------------
     Estado dedicado à Micro Conversão Progressiva
     Controla os degraus comportamentais da página
  ------------------------------------------------------- */
  microConversao: {
    engaged: false,
    scroll50: false,
    scroll90: false,
    outboundClick: false,
    ctaPrincipalClick: false,
    whatsappClick: false,
    purchaseIntentEnviado: false,
    ultimoScrollPercent: 0,
    segundosNaPagina: 0,
    ultimoOutboundDestino: "",
    ultimoCTA: ""
  }
};

/* =========================================================
   MÓDULO: TOASTS SOCIAIS
   Visual elegante, tecnológico e suave
========================================================= */
const ToastsSociais = {
  cssInjetado: false,
  root: null,
  timerId: null,
  ativos: 0,

  nomes: [
    "Camila",
    "Juliana",
    "Fernanda",
    "Patrícia",
    "Renata",
    "Aline",
    "Marina",
    "Bianca",
    "Vanessa",
    "Priscila",
    "Carla",
    "Amanda",
    "Tatiane",
    "Larissa",
    "Beatriz",
    "Gabriela",
    "Natália",
    "Paula",
    "Luciana",
    "Débora"
  ],

  templates: [
    {
      icon: "◉",
      title: "Nova aluna",
      build() {
        return `${sortearItem(ToastsSociais.nomes)} começou agora na Máquina de Vendas Online 3.0`;
      }
    },
    {
      icon: "↗",
      title: "Compra confirmada",
      build() {
        return `${sortearItem(ToastsSociais.nomes)} garantiu o acesso completo hoje`;
      }
    },
    {
      icon: "◎",
      title: "Movimento ao vivo",
      build() {
        return `${numeroAleatorio(18, 63)} pessoas estão vendo esta página agora`;
      }
    },
    {
      icon: "▣",
      title: "Interesse real",
      build() {
        return `${sortearItem(ToastsSociais.nomes)} clicou para conhecer a oferta completa`;
      }
    },
    {
      icon: "✦",
      title: "Ação recente",
      build() {
        return `${sortearItem(ToastsSociais.nomes)} entrou para aprender vendas online`;
      }
    },
    {
      icon: "⌁",
      title: "Engajamento",
      build() {
        return `${sortearItem(ToastsSociais.nomes)} salvou esta página para continuar depois`;
      }
    }
  ],

  injetarCSS() {
    if (ToastsSociais.cssInjetado) {
      return;
    }

    ToastsSociais.cssInjetado = true;

    const css = `
.toast-tech-stack{
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  width: min(370px, calc(100vw - 24px));
  pointer-events: none;
}

.toast-tech-item{
  position: relative;
  width: 100%;
  min-height: 76px;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.16);
  background:
    linear-gradient(135deg, rgba(18, 28, 48, .84) 0%, rgba(9, 17, 31, .78) 100%);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow:
    0 18px 44px rgba(0, 0, 0, .24),
    inset 0 1px 0 rgba(255,255,255,.06);
  color: #eef4ff;
  opacity: 0;
  transform: translateY(18px) scale(.985);
  transition: opacity 260ms ease, transform 260ms ease;
}

.toast-tech-item.is-visible{
  opacity: 1;
  transform: translateY(0) scale(1);
}

.toast-tech-item.is-leaving{
  opacity: 0;
  transform: translateY(10px) scale(.985);
}

.toast-tech-item::before{
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(88, 166, 255, .16), transparent 42%),
    radial-gradient(circle at bottom left, rgba(0, 255, 200, .08), transparent 35%);
  pointer-events: none;
}

.toast-tech-item__glow{
  position: absolute;
  top: -20px;
  right: -10px;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(86, 162, 255, .18) 0%, rgba(86, 162, 255, 0) 72%);
  pointer-events: none;
}

.toast-tech-item__bgicon{
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 54px;
  line-height: 1;
  font-weight: 800;
  color: rgba(130, 184, 255, .08);
  user-select: none;
  pointer-events: none;
}

.toast-tech-item__row{
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
}

.toast-tech-item__badge{
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  border: 1px solid rgba(120, 181, 255, .22);
  background:
    linear-gradient(180deg, rgba(75, 140, 255, .18), rgba(75, 140, 255, .08));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.08),
    0 8px 20px rgba(27, 92, 195, .20);
  color: #9fd0ff;
  font-size: 16px;
  font-weight: 800;
}

.toast-tech-item__content{
  min-width: 0;
  flex: 1;
}

.toast-tech-item__title{
  margin: 0 0 4px 0;
  color: rgba(171, 207, 255, .78);
  font-size: 11.5px;
  line-height: 1.15;
  letter-spacing: .08em;
  text-transform: uppercase;
  font-weight: 800;
}

.toast-tech-item__text{
  margin: 0;
  color: rgba(240, 247, 255, .96);
  font-size: 14px;
  line-height: 1.45;
  font-weight: 600;
}

.toast-tech-item__progress{
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, rgba(90, 184, 255, .92), rgba(0, 255, 198, .34));
  transform-origin: left center;
  animation: toastTechProgress linear forwards;
}

@keyframes toastTechProgress{
  from{ transform: scaleX(1); }
  to{ transform: scaleX(0); }
}

@media (max-width: 640px){
  .toast-tech-stack{
    right: 12px;
    left: 12px;
    bottom: 12px;
    width: auto;
    align-items: stretch;
  }

  .toast-tech-item{
    min-height: 72px;
    border-radius: 16px;
  }

  .toast-tech-item__row{
    padding: 13px 14px;
  }

  .toast-tech-item__badge{
    width: 36px;
    height: 36px;
    flex-basis: 36px;
    border-radius: 12px;
    font-size: 15px;
  }

  .toast-tech-item__bgicon{
    right: 10px;
    font-size: 46px;
  }

  .toast-tech-item__text{
    font-size: 13.2px;
  }
}

@media (prefers-reduced-motion: reduce){
  .toast-tech-item,
  .toast-tech-item__progress{
    transition: none !important;
    animation: none !important;
  }
}
    `.trim();

    const style = document.createElement("style");
    style.setAttribute("data-toast-tech", "ativo");
    style.textContent = css;
    document.head.appendChild(style);
  },

  garantirRoot() {
    if (ToastsSociais.root) {
      return ToastsSociais.root;
    }

    ToastsSociais.injetarCSS();

    const root = document.createElement("div");
    root.className = "toast-tech-stack";
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-atomic", "false");

    document.body.appendChild(root);
    ToastsSociais.root = root;

    return root;
  },

  podeMostrar() {
    if (!TOASTS_SOCIAIS_CONFIG.habilitado) {
      return false;
    }

    if (document.hidden) {
      return false;
    }

    if (ToastsSociais.ativos >= TOASTS_SOCIAIS_CONFIG.maxVisiveis) {
      return false;
    }

    return true;
  },

  construirDadosToast() {
    const template = sortearItem(ToastsSociais.templates);

    if (!template) {
      return null;
    }

    return {
      icon: template.icon || "•",
      title: template.title || "Atualização",
      text: template.build()
    };
  },

  mostrarToast(dados) {
    if (!dados || !ToastsSociais.podeMostrar()) {
      return;
    }

    const root = ToastsSociais.garantirRoot();
    const toast = document.createElement("div");
    toast.className = "toast-tech-item";
    toast.setAttribute("role", "status");

    toast.innerHTML = `
<div class="toast-tech-item__glow" aria-hidden="true"></div>
<div class="toast-tech-item__bgicon" aria-hidden="true">${dados.icon}</div>
<div class="toast-tech-item__row">
  <div class="toast-tech-item__badge" aria-hidden="true">${dados.icon}</div>
  <div class="toast-tech-item__content">
    <p class="toast-tech-item__title">${dados.title}</p>
    <p class="toast-tech-item__text">${dados.text}</p>
  </div>
</div>
<div class="toast-tech-item__progress" style="animation-duration:${TOASTS_SOCIAIS_CONFIG.tempoVisivelMs}ms"></div>
    `.trim();

    root.appendChild(toast);
    ToastsSociais.ativos += 1;

    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    window.setTimeout(() => {
      toast.classList.add("is-leaving");

      window.setTimeout(() => {
        try {
          toast.remove();
        } catch (erro) {
          /* Ignora remoção */
        }

        ToastsSociais.ativos = Math.max(0, ToastsSociais.ativos - 1);
      }, 320);
    }, TOASTS_SOCIAIS_CONFIG.tempoVisivelMs);
  },

  talvezMostrar() {
    if (!ToastsSociais.podeMostrar()) {
      return;
    }

    if (Math.random() > TOASTS_SOCIAIS_CONFIG.chancePorCiclo) {
      return;
    }

    const dados = ToastsSociais.construirDadosToast();

    if (!dados) {
      return;
    }

    ToastsSociais.mostrarToast(dados);
  },

  proximoDelay(primeiro = false) {
    if (primeiro) {
      return numeroAleatorio(
        TOASTS_SOCIAIS_CONFIG.primeiroDelayMinMs,
        TOASTS_SOCIAIS_CONFIG.primeiroDelayMaxMs
      );
    }

    return numeroAleatorio(
      TOASTS_SOCIAIS_CONFIG.intervaloMinMs,
      TOASTS_SOCIAIS_CONFIG.intervaloMaxMs
    );
  },

  agendarProximo(primeiro = false) {
    if (ToastsSociais.timerId) {
      clearTimeout(ToastsSociais.timerId);
      ToastsSociais.timerId = null;
    }

    const delay = ToastsSociais.proximoDelay(primeiro);

    ToastsSociais.timerId = window.setTimeout(() => {
      ToastsSociais.talvezMostrar();
      ToastsSociais.agendarProximo(false);
    }, delay);
  },

  bindVisibility() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (ToastsSociais.timerId) {
          clearTimeout(ToastsSociais.timerId);
          ToastsSociais.timerId = null;
        }
        return;
      }

      if (!ToastsSociais.timerId) {
        ToastsSociais.agendarProximo(false);
      }
    });
  },

  iniciar() {
    if (!TOASTS_SOCIAIS_CONFIG.habilitado) {
      return;
    }

    ToastsSociais.garantirRoot();
    ToastsSociais.bindVisibility();
    ToastsSociais.agendarProximo(true);
  }
};

/* =========================================================
   UTILITÁRIOS DOS TOASTS
   Funções auxiliares isoladas para não poluir a lógica
========================================================= */
function numeroAleatorio(min, max) {
  const minimo = Math.ceil(Number(min) || 0);
  const maximo = Math.floor(Number(max) || 0);

  if (maximo <= minimo) {
    return minimo;
  }

  return Math.floor(Math.random() * (maximo - minimo + 1)) + minimo;
}

function sortearItem(lista) {
  if (!Array.isArray(lista) || !lista.length) {
    return null;
  }

  return lista[numeroAleatorio(0, lista.length - 1)];
}

/* =========================================================
   FUNÇÃO: ocultarCTAsDeCheckoutExcetoUltimo
   Oculta todos os botões de checkout (.cta-link),
   preservando apenas o último
========================================================= */
function ocultarCTAsDeCheckoutExcetoUltimo() {
  const ctas = Array.from(document.querySelectorAll(".cta-link"));

  if (!ctas.length) {
    return;
  }

  ctas.forEach((cta, indice) => {
    const ehUltimo = indice === ctas.length - 1;

    if (!ehUltimo) {
      cta.style.display = "none";
    }
  });
}

/* =========================================================
   FUNÇÃO: capturarElementosBloqueadosInicialmente
   Define tudo o que deve começar oculto:
   - nota abaixo do vídeo
   - CTA inicial abaixo do vídeo
   - todo o conteúdo do <main>
   - footer inteiro
========================================================= */
function capturarElementosBloqueadosInicialmente() {
  const seletores = [
    ".hero__note",
    ".hero .cta-wrap",
    "main",
    "footer.footer"
  ];

  const elementos = [];

  seletores.forEach((seletor) => {
    const encontrados = document.querySelectorAll(seletor);

    encontrados.forEach((elemento) => {
      if (!elementos.includes(elemento)) {
        elementos.push(elemento);
      }
    });
  });

  return elementos;
}

/* =========================================================
   FUNÇÃO: jaLiberouConteudoViaLocalStorage
   Verifica se o conteúdo já foi liberado anteriormente
========================================================= */
function jaLiberouConteudoViaLocalStorage() {
  try {
    return window.localStorage.getItem(CHAVE_LOCALSTORAGE_CONTEUDO_LIBERADO) === "true";
  } catch (erro) {
    return false;
  }
}

/* =========================================================
   FUNÇÃO: salvarLiberacaoNoLocalStorage
   Persiste a informação para não exigir novo tempo de espera
   após atualizar a página
========================================================= */
function salvarLiberacaoNoLocalStorage() {
  try {
    window.localStorage.setItem(CHAVE_LOCALSTORAGE_CONTEUDO_LIBERADO, "true");
  } catch (erro) {
    /* Ignora falhas silenciosamente */
  }
}

/* =========================================================
   FUNÇÃO: bloquearConteudoInicialDaVSL
   Oculta inicialmente todo o conteúdo que só deve aparecer
   após 60 segundos da VSL principal
========================================================= */
function bloquearConteudoInicialDaVSL() {
  if (jaLiberouConteudoViaLocalStorage()) {
    estadoTracking.conteudoBloqueadoLiberado = true;
    return;
  }

  const elementos = capturarElementosBloqueadosInicialmente();

  estadoTracking.elementosBloqueados = elementos.map((elemento) => ({
    elemento,
    displayOriginal: elemento.style.display
  }));

  elementos.forEach((elemento) => {
    elemento.style.display = "none";
  });
}

/* =========================================================
   FUNÇÃO: liberarConteudoBloqueadoDaVSL
   Restaura todo o conteúdo bloqueado após o tempo definido
========================================================= */
function liberarConteudoBloqueadoDaVSL() {
  if (estadoTracking.conteudoBloqueadoLiberado) {
    return;
  }

  estadoTracking.elementosBloqueados.forEach(({ elemento, displayOriginal }) => {
    elemento.style.display = displayOriginal || "";
  });

  estadoTracking.conteudoBloqueadoLiberado = true;
  salvarLiberacaoNoLocalStorage();

  trackCustom("ContentUnlockedAfter60s", {
    unlock_after_seconds: TEMPO_LIBERACAO_CONTEUDO_SEGUNDOS,
    page_title: document.title,
    page_path: window.location.pathname
  });
}

/* =========================================================
   FUNÇÃO: iniciarTemporizadorDeLiberacaoDaVSL
   Inicia o contador de 60 segundos para liberar a página
========================================================= */
function iniciarTemporizadorDeLiberacaoDaVSL() {
  if (jaLiberouConteudoViaLocalStorage()) {
    return;
  }

  window.setTimeout(() => {
    liberarConteudoBloqueadoDaVSL();
  }, TEMPO_LIBERACAO_CONTEUDO_SEGUNDOS * 1000);
}

/* =========================================================
   FUNÇÃO: obterContextoPagina
   Captura o máximo de contexto útil da URL e da página
========================================================= */
function obterContextoPagina() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  return {
    page_title: document.title || "",
    page_url: window.location.href,
    page_path: window.location.pathname,
    page_hostname: window.location.hostname,
    referrer: document.referrer || "",
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    utm_term: params.get("utm_term") || "",
    fbclid: params.get("fbclid") || "",
    gclid: params.get("gclid") || "",
    ttclid: params.get("ttclid") || "",
    user_agent: navigator.userAgent,
    screen_width: window.screen.width || 0,
    screen_height: window.screen.height || 0,
    language: navigator.language || ""
  };
}

/* =========================================================
   FUNÇÃO: bootstrapMetaPixel
   Usa o Pixel já carregado no HTML para evitar duplicidade
========================================================= */
function bootstrapMetaPixel() {
  if (window.fbq) {
    estadoTracking.pixelCarregado = true;
    estadoTracking.pixelIniciado = true;
    return;
  }

  console.warn("Meta Pixel não foi encontrado no HTML.");
}

/* =========================================================
   FUNÇÕES DE TRACKING
   Camada segura para enviar eventos sem quebrar a página
========================================================= */
function trackStandard(evento, parametros = {}) {
  if (!window.fbq || !estadoTracking.pixelIniciado) {
    return;
  }

  try {
    window.fbq("track", evento, parametros);
  } catch (erro) {
    console.error(`Erro ao enviar evento padrão ${evento}:`, erro);
  }
}

function trackCustom(evento, parametros = {}) {
  if (!window.fbq || !estadoTracking.pixelIniciado) {
    return;
  }

  try {
    window.fbq("trackCustom", evento, parametros);
  } catch (erro) {
    console.error(`Erro ao enviar evento customizado ${evento}:`, erro);
  }
}

/* =========================================================
   FUNÇÃO UTILITÁRIA: obterPayloadBaseDaOferta
   Padroniza os dados da oferta enviados ao Pixel
========================================================= */
function obterPayloadBaseDaOferta() {
  return {
    content_name: MICRO_CONVERSAO_CONFIG.contentName,
    content_category: MICRO_CONVERSAO_CONFIG.contentCategory,
    content_type: MICRO_CONVERSAO_CONFIG.contentType,
    content_ids: [MICRO_CONVERSAO_CONFIG.contentId],
    value: MICRO_CONVERSAO_CONFIG.purchaseIntentValor,
    currency: MICRO_CONVERSAO_CONFIG.currency
  };
}

/* =========================================================
   FUNÇÃO UTILITÁRIA: obterPayloadBaseMicroConversao
   Complementa os eventos progressivos com contexto da página
========================================================= */
function obterPayloadBaseMicroConversao() {
  const contexto = estadoTracking.contextoPagina || {};

  return {
    ...obterPayloadBaseDaOferta(),
    page_title: contexto.page_title || document.title || "",
    page_path: contexto.page_path || window.location.pathname,
    page_url: contexto.page_url || window.location.href,
    utm_source: contexto.utm_source || "",
    utm_medium: contexto.utm_medium || "",
    utm_campaign: contexto.utm_campaign || "",
    utm_content: contexto.utm_content || "",
    utm_term: contexto.utm_term || "",
    fbclid: contexto.fbclid || ""
  };
}

/* =========================================================
   FUNÇÃO: avaliarMicroConversaoProgressiva
   Verifica se os degraus já foram alcançados e dispara
   os eventos progressivos sem duplicidade
========================================================= */
function avaliarMicroConversaoProgressiva() {
  const micro = estadoTracking.microConversao;
  const payloadBase = obterPayloadBaseMicroConversao();

  /* -------------------------------------------------------
     DEGRAU 1: Engaged
     Usuário ficou tempo suficiente na página
  ------------------------------------------------------- */
  if (
    !micro.engaged &&
    micro.segundosNaPagina >= MICRO_CONVERSAO_CONFIG.engagedSegundos
  ) {
    micro.engaged = true;

    trackStandard("Lead", {
      ...obterPayloadBaseDaOferta()
    });

    trackCustom("Engaged", {
      ...payloadBase,
      engaged_seconds: MICRO_CONVERSAO_CONFIG.engagedSegundos
    });
  }

  /* -------------------------------------------------------
     DEGRAU 2: Scroll50
     Usuário consumiu metade da página
  ------------------------------------------------------- */
  if (
    !micro.scroll50 &&
    micro.ultimoScrollPercent >= MICRO_CONVERSAO_CONFIG.scroll50
  ) {
    micro.scroll50 = true;

    trackCustom("Scroll50", {
      ...payloadBase,
      scroll_percent: MICRO_CONVERSAO_CONFIG.scroll50
    });
  }

  /* -------------------------------------------------------
     DEGRAU 3: Scroll90
     Usuário chegou ao fundo estratégico da copy
  ------------------------------------------------------- */
  if (
    !micro.scroll90 &&
    micro.ultimoScrollPercent >= MICRO_CONVERSAO_CONFIG.scroll90
  ) {
    micro.scroll90 = true;

    trackCustom("Scroll90", {
      ...payloadBase,
      scroll_percent: MICRO_CONVERSAO_CONFIG.scroll90
    });
  }

  /* -------------------------------------------------------
     DEGRAU 4: PurchaseIntent
     Combinação forte:
     - tempo mínimo na página
     - scroll profundo
     - clique intencional em CTA/Outbound/WhatsApp
  ------------------------------------------------------- */
  const houveCliqueIntencional =
    micro.ctaPrincipalClick ||
    micro.outboundClick ||
    micro.whatsappClick;

  const atingiuTempoMinimo =
    micro.segundosNaPagina >= MICRO_CONVERSAO_CONFIG.purchaseIntentTempoMinimo;

  const atingiuScrollMinimo =
    micro.ultimoScrollPercent >= MICRO_CONVERSAO_CONFIG.purchaseIntentScrollMinimo;

  if (
    !micro.purchaseIntentEnviado &&
    houveCliqueIntencional &&
    atingiuTempoMinimo &&
    atingiuScrollMinimo
  ) {
    micro.purchaseIntentEnviado = true;

    trackCustom("PurchaseIntent", {
      ...payloadBase,
      intent_level: "high",
      engaged_seconds: micro.segundosNaPagina,
      scroll_percent: micro.ultimoScrollPercent,
      clicked_cta: micro.ctaPrincipalClick,
      clicked_outbound: micro.outboundClick,
      clicked_whatsapp: micro.whatsappClick,
      destination_url: micro.ultimoOutboundDestino || "",
      cta_text: micro.ultimoCTA || ""
    });
  }
}

/* =========================================================
   FUNÇÃO: registrarCliqueIntencional
   Marca cliques relevantes para a escada progressiva
========================================================= */
function registrarCliqueIntencional({
  tipo = "",
  destino = "",
  ctaText = ""
} = {}) {
  const micro = estadoTracking.microConversao;

  if (tipo === "cta") {
    micro.ctaPrincipalClick = true;
    micro.ultimoCTA = ctaText || micro.ultimoCTA;
  }

  if (tipo === "whatsapp") {
    micro.whatsappClick = true;
  }

  if (tipo === "outbound") {
    micro.outboundClick = true;
  }

  if (destino) {
    micro.ultimoOutboundDestino = destino;
  }

  avaliarMicroConversaoProgressiva();
}

/* =========================================================
   FUNÇÃO UTILITÁRIA: calcularProfundidadeScrollAtual
   Centraliza o cálculo do percentual de scroll da página
========================================================= */
function calcularProfundidadeScrollAtual() {
  const scrollTop = window.scrollY || window.pageYOffset || 0;
  const alturaDocumento = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
  const alturaViewport = window.innerHeight || document.documentElement.clientHeight || 0;

  const totalRolavel = alturaDocumento - alturaViewport;

  if (totalRolavel <= 0) {
    return 100;
  }

  return Math.min(100, Math.round((scrollTop / totalRolavel) * 100));
}

/* =========================================================
   FUNÇÃO: enviarPageViewInicial
   Dispara eventos base de entrada na página
   OBS:
   - O PageView já é disparado no HTML
   - Aqui permanecem apenas os eventos complementares
========================================================= */
function enviarPageViewInicial() {
  const contexto = estadoTracking.contextoPagina;

  trackStandard("ViewContent", {
    content_name: contexto.page_title,
    content_category: "landing_page",
    content_type: "product",
    content_ids: ["maquina-de-vendas-online-3-0"],
    value: 289.90,
    currency: "BRL"
  });

  trackCustom("LandingPageLoaded", {
    ...contexto,
    content_name: "Máquina de Vendas Online 3.0",
    offer_value: 289.90,
    currency: "BRL"
  });
}

/* =========================================================
   FUNÇÃO: ativarRevelacao
   Responsável por iniciar toda a lógica de reveal no scroll
========================================================= */
function ativarRevelacao() {
  const elementosReveal = document.querySelectorAll(".reveal");

  if (!elementosReveal.length) {
    return;
  }

  const prefereMenosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefereMenosMovimento) {
    elementosReveal.forEach((elemento) => {
      elemento.classList.add("is-visible");
    });
    return;
  }

  if (!("IntersectionObserver" in window)) {
    elementosReveal.forEach((elemento) => {
      elemento.classList.add("is-visible");
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries, observerInstance) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observerInstance.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.12
    }
  );

  elementosReveal.forEach((elemento) => {
    observer.observe(elemento);
  });
}

/* =========================================================
   FUNÇÃO: inicializarScrollDepth
   Mede a profundidade de scroll da página
========================================================= */
function inicializarScrollDepth() {
  function verificarScroll() {
    const profundidadeAtual = calcularProfundidadeScrollAtual();

    /* -----------------------------------------------------
       Atualiza estado global de micro conversão
       Isso alimenta os degraus Scroll50 e Scroll90
    ----------------------------------------------------- */
    estadoTracking.microConversao.ultimoScrollPercent = Math.max(
      estadoTracking.microConversao.ultimoScrollPercent,
      profundidadeAtual
    );

    SCROLL_MARCOS.forEach((marco) => {
      if (profundidadeAtual >= marco && !estadoTracking.scrollEnviado.has(marco)) {
        estadoTracking.scrollEnviado.add(marco);

        trackCustom("ScrollDepth", {
          scroll_percent: marco,
          page_title: document.title,
          page_path: window.location.pathname
        });
      }
    });

    /* -----------------------------------------------------
       Após atualizar o scroll atual, avaliamos os degraus
       progressivos da micro conversão
    ----------------------------------------------------- */
    avaliarMicroConversaoProgressiva();
  }

  window.addEventListener("scroll", verificarScroll, { passive: true });
  verificarScroll();
}

/* =========================================================
   FUNÇÃO: inicializarTempoNaPagina
   Dispara eventos de engajamento por tempo decorrido
========================================================= */
function inicializarTempoNaPagina() {
  function verificarTempo() {
    const segundos = Math.floor((Date.now() - estadoTracking.paginaIniciadaEm) / 1000);

    /* -----------------------------------------------------
       Atualiza o relógio da Micro Conversão Progressiva
    ----------------------------------------------------- */
    estadoTracking.microConversao.segundosNaPagina = segundos;

    TEMPO_MARCOS_SEGUNDOS.forEach((marco) => {
      if (segundos >= marco && !estadoTracking.tempoPaginaEnviado.has(marco)) {
        estadoTracking.tempoPaginaEnviado.add(marco);

        trackCustom("TimeOnPage", {
          seconds_on_page: marco,
          page_title: document.title,
          page_path: window.location.pathname
        });
      }
    });

    /* -----------------------------------------------------
       Após atualizar o tempo, reavaliamos os degraus
       progressivos da micro conversão
    ----------------------------------------------------- */
    avaliarMicroConversaoProgressiva();
  }

  setInterval(verificarTempo, 1000);
}

/* =========================================================
   FUNÇÃO: obterNomeSecao
   Tenta gerar um nome legível para a seção rastreada
========================================================= */
function obterNomeSecao(elemento, indice) {
  const titulo = elemento.querySelector("h1, h2, h3, h4");

  if (titulo && titulo.textContent.trim()) {
    return titulo.textContent.trim().slice(0, 120);
  }

  if (elemento.id) {
    return elemento.id;
  }

  if (elemento.className && typeof elemento.className === "string") {
    return elemento.className.trim().replace(/\s+/g, "_").slice(0, 120);
  }

  return `secao_${indice + 1}`;
}

/* =========================================================
   FUNÇÃO: inicializarVisualizacaoSecoes
   Mede quais blocos estratégicos foram realmente vistos
========================================================= */
function inicializarVisualizacaoSecoes() {
  const secoes = document.querySelectorAll("header.hero, main section, footer.footer");

  if (!secoes.length) {
    return;
  }

  if (!("IntersectionObserver" in window)) {
    secoes.forEach((secao, indice) => {
      const nome = obterNomeSecao(secao, indice);
      estadoTracking.secoesVistas.add(nome);
    });
    return;
  }

  const observerSecoes = new IntersectionObserver(
    (entries, observerInstance) => {
      entries.forEach((entry, indice) => {
        if (!entry.isIntersecting) {
          return;
        }

        const secao = entry.target;
        const nome = obterNomeSecao(secao, indice);

        if (estadoTracking.secoesVistas.has(nome)) {
          observerInstance.unobserve(secao);
          return;
        }

        estadoTracking.secoesVistas.add(nome);

        trackCustom("SectionView", {
          section_name: nome,
          page_title: document.title,
          page_path: window.location.pathname
        });

        observerInstance.unobserve(secao);
      });
    },
    {
      threshold: 0.35
    }
  );

  secoes.forEach((secao) => {
    observerSecoes.observe(secao);
  });
}

/* =========================================================
   FUNÇÃO: inicializarCliquesCTA
   Rastreia o botão principal e demais CTAs relevantes
========================================================= */
function inicializarCliquesCTA() {
  const ctas = document.querySelectorAll(".cta-link");

  ctas.forEach((cta, indice) => {
    cta.addEventListener("click", () => {
      const texto = (cta.textContent || "").trim();

      trackStandard("InitiateCheckout", {
        content_name: "Máquina de Vendas Online 3.0",
        content_category: "landing_page_cta",
        content_type: "product",
        value: 289.90,
        currency: "BRL"
      });

      trackCustom("MainCTAClick", {
        cta_text: texto,
        cta_href: cta.href || "",
        cta_index: indice + 1,
        page_title: document.title,
        page_path: window.location.pathname
      });

      /* ---------------------------------------------------
         Marca clique intencional na escada de micro
         conversão progressiva
      --------------------------------------------------- */
      registrarCliqueIntencional({
        tipo: "cta",
        destino: cta.href || "",
        ctaText: texto
      });
    });
  });
}

/* =========================================================
   FUNÇÃO: inicializarWhatsApp
   Rastreia clique no botão de WhatsApp
========================================================= */
function inicializarWhatsApp() {
  const botaoWhatsApp = document.querySelector(".offer-box__whatsapp");

  if (!botaoWhatsApp) {
    return;
  }

  botaoWhatsApp.addEventListener("click", () => {
    trackStandard("Contact", {
      content_name: "WhatsApp Click",
      content_category: "support"
    });

    trackCustom("WhatsAppClick", {
      destination: botaoWhatsApp.href || "",
      page_title: document.title,
      page_path: window.location.pathname
    });

    /* ---------------------------------------------------
       Clique em WhatsApp também é clique intencional
       forte para a micro conversão progressiva
    --------------------------------------------------- */
    registrarCliqueIntencional({
      tipo: "whatsapp",
      destino: botaoWhatsApp.href || "",
      ctaText: "WhatsApp"
    });
  });
}

/* =========================================================
   FUNÇÃO: inicializarOutboundLinks
   Rastreia cliques em links externos gerais
========================================================= */
function inicializarOutboundLinks() {
  const links = document.querySelectorAll("a[href]");

  links.forEach((link) => {
    link.addEventListener("click", () => {
      try {
        const destino = new URL(link.href, window.location.origin);

        if (destino.hostname !== window.location.hostname) {
          trackCustom("OutboundClick", {
            link_url: link.href,
            link_text: (link.textContent || "").trim().slice(0, 120),
            destination_host: destino.hostname
          });

          /* -----------------------------------------------
             Registra outbound como degrau progressivo
          ----------------------------------------------- */
          registrarCliqueIntencional({
            tipo: "outbound",
            destino: link.href,
            ctaText: (link.textContent || "").trim().slice(0, 120)
          });
        }
      } catch (erro) {
        /* Ignora URLs inválidas silenciosamente */
      }
    });
  });
}

/* =========================================================
   FUNÇÃO UTILITÁRIA: iniciarTrackerDeExposicao
   Mede por quanto tempo um bloco fica visível na tela
========================================================= */
function iniciarTrackerDeExposicao({
  elementos,
  nomeEvento,
  marcosSegundos,
  obterParametrosBase,
  threshold = 0.5
}) {
  if (!elementos || !elementos.length) {
    return;
  }

  const estados = new Map();

  elementos.forEach((elemento, indice) => {
    estados.set(elemento, {
      index: indice + 1,
      visivel: false,
      acumuladoMs: 0,
      iniciouEm: 0,
      marcosEnviados: new Set()
    });
  });

  function atualizarAcumulados() {
    elementos.forEach((elemento) => {
      const estado = estados.get(elemento);

      if (!estado || !estado.visivel) {
        return;
      }

      const agora = Date.now();
      estado.acumuladoMs += agora - estado.iniciouEm;
      estado.iniciouEm = agora;

      const acumuladoSegundos = Math.floor(estado.acumuladoMs / 1000);
      const parametrosBase = obterParametrosBase(elemento, estado.index);

      marcosSegundos.forEach((marco) => {
        if (acumuladoSegundos >= marco && !estado.marcosEnviados.has(marco)) {
          estado.marcosEnviados.add(marco);

          trackCustom(nomeEvento, {
            ...parametrosBase,
            visible_seconds: marco
          });
        }
      });
    });
  }

  setInterval(atualizarAcumulados, 1000);

  if (!("IntersectionObserver" in window)) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const agora = Date.now();

      entries.forEach((entry) => {
        const estado = estados.get(entry.target);

        if (!estado) {
          return;
        }

        if (entry.isIntersecting) {
          estado.visivel = true;
          estado.iniciouEm = agora;
        } else if (estado.visivel) {
          estado.acumuladoMs += agora - estado.iniciouEm;
          estado.visivel = false;
          estado.iniciouEm = 0;
        }
      });
    },
    {
      threshold
    }
  );

  elementos.forEach((elemento) => observer.observe(elemento));
}

/* =========================================================
   FUNÇÃO: inicializarVSLTracking
   Mede o tempo de exposição visual da VSL principal
========================================================= */
function inicializarVSLTracking() {
  const vsl = document.querySelector(".video-frame--hero");

  if (!vsl) {
    return;
  }

  iniciarTrackerDeExposicao({
    elementos: [vsl],
    nomeEvento: "VSLVisibleTime",
    marcosSegundos: VSL_MARCOS_SEGUNDOS,
    threshold: 0.6,
    obterParametrosBase: () => ({
      video_type: "vsl_principal",
      video_title: "Vídeo principal"
    })
  });

  if ("IntersectionObserver" in window) {
    const observerVSL = new IntersectionObserver(
      (entries, observerInstance) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || estadoTracking.exposicaoBlocos.has("vsl_viewed")) {
            return;
          }

          estadoTracking.exposicaoBlocos.add("vsl_viewed");

          trackCustom("VSLViewed", {
            video_type: "vsl_principal",
            video_title: "Vídeo principal"
          });

          observerInstance.unobserve(entry.target);
        });
      },
      {
        threshold: 0.5
      }
    );

    observerVSL.observe(vsl);
  }
}

/* =========================================================
   FUNÇÃO: inicializarProvasSociaisTracking
   Mede exposição visual dos vídeos de prova social
========================================================= */
function inicializarProvasSociaisTracking() {
  const videosSociais = document.querySelectorAll(".video-testimonials .video-card");

  if (!videosSociais.length) {
    return;
  }

  iniciarTrackerDeExposicao({
    elementos: Array.from(videosSociais),
    nomeEvento: "SocialProofVisibleTime",
    marcosSegundos: PROVA_SOCIAL_MARCOS_SEGUNDOS,
    threshold: 0.55,
    obterParametrosBase: (elemento, index) => {
      const titulo = elemento.querySelector(".video-card__title");
      return {
        proof_index: index,
        proof_title: titulo ? titulo.textContent.trim().slice(0, 140) : `Prova ${index}`
      };
    }
  });

  if ("IntersectionObserver" in window) {
    const observerProvas = new IntersectionObserver(
      (entries, observerInstance) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const elemento = entry.target;
          const index = Array.from(videosSociais).indexOf(elemento) + 1;
          const chave = `social_proof_${index}`;

          if (estadoTracking.exposicaoBlocos.has(chave)) {
            observerInstance.unobserve(elemento);
            return;
          }

          estadoTracking.exposicaoBlocos.add(chave);

          const titulo = elemento.querySelector(".video-card__title");

          trackCustom("SocialProofViewed", {
            proof_index: index,
            proof_title: titulo ? titulo.textContent.trim().slice(0, 140) : `Prova ${index}`
          });

          observerInstance.unobserve(elemento);
        });
      },
      {
        threshold: 0.5
      }
    );

    videosSociais.forEach((video) => observerProvas.observe(video));
  }
}

/* =========================================================
   FUNÇÃO: inicializarProvasImagemTracking
   Mede visualização das imagens de prova / prints
========================================================= */
function inicializarProvasImagemTracking() {
  const imagensProva = document.querySelectorAll(".proof-image");

  if (!imagensProva.length || !("IntersectionObserver" in window)) {
    return;
  }

  const observerImagens = new IntersectionObserver(
    (entries, observerInstance) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const elemento = entry.target;
        const index = Array.from(imagensProva).indexOf(elemento) + 1;
        const chave = `proof_image_${index}`;

        if (estadoTracking.exposicaoBlocos.has(chave)) {
          observerInstance.unobserve(elemento);
          return;
        }

        estadoTracking.exposicaoBlocos.add(chave);

        trackCustom("ProofImageViewed", {
          proof_image_index: index,
          page_title: document.title
        });

        observerInstance.unobserve(elemento);
      });
    },
    {
      threshold: 0.5
    }
  );

  imagensProva.forEach((imagem) => observerImagens.observe(imagem));
}

/* =========================================================
   FUNÇÃO PÚBLICA: trackVideoProgressExternally
   Hook público para você chamar a partir da API do player
   quando tiver currentTime e duration reais do vídeo
========================================================= */
function trackVideoProgressExternally({
  tipo = "vsl",
  currentTime = 0,
  duration = 0,
  title = "",
  extra = {}
} = {}) {
  if (!duration || duration <= 0) {
    return;
  }

  const percentual = Math.min(100, Math.round((currentTime / duration) * 100));
  const bucket = tipo === "social" ? "social" : "vsl";
  const cache = estadoTracking.progressoVideoEnviado[bucket];

  VIDEO_PROGRESS_MARCOS.forEach((marco) => {
    if (percentual >= marco && !cache.has(marco)) {
      cache.add(marco);

      trackCustom("VideoProgress", {
        video_type: bucket,
        video_title: title,
        progress_percent: marco,
        current_time: Math.round(currentTime),
        duration: Math.round(duration),
        ...extra
      });
    }
  });
}

/* =========================================================
   FUNÇÃO PÚBLICA: trackVideoPlayExternally
   Hook para registrar play real via API do player
========================================================= */
function trackVideoPlayExternally({
  tipo = "vsl",
  title = "",
  extra = {}
} = {}) {
  trackCustom("VideoPlay", {
    video_type: tipo,
    video_title: title,
    ...extra
  });
}

/* =========================================================
   FUNÇÃO PÚBLICA: trackVideoCompleteExternally
   Hook para registrar conclusão real via API do player
========================================================= */
function trackVideoCompleteExternally({
  tipo = "vsl",
  title = "",
  extra = {}
} = {}) {
  trackCustom("VideoComplete", {
    video_type: tipo,
    video_title: title,
    ...extra
  });
}

/* =========================================================
   EXPOSIÇÃO GLOBAL DOS HOOKS
   Permite integração futura com APIs dos players
========================================================= */
window.trackVideoProgressExternally = trackVideoProgressExternally;
window.trackVideoPlayExternally = trackVideoPlayExternally;
window.trackVideoCompleteExternally = trackVideoCompleteExternally;

/* =========================================================
   FUNÇÃO: inicializarToastsSociais
   Inicia a prova social visual desde o começo da página
========================================================= */
function inicializarToastsSociais() {
  ToastsSociais.iniciar();
}

/* =========================================================
   FUNÇÃO: inicializarTudo
   Orquestra todas as funcionalidades do script
========================================================= */
function inicializarTudo() {
  estadoTracking.contextoPagina = obterContextoPagina();

  /* -------------------------------------------------------
     ETAPA 0
     Oculta todos os botões de checkout, exceto o último
  ------------------------------------------------------- */
  ocultarCTAsDeCheckoutExcetoUltimo();

  /* -------------------------------------------------------
     ETAPA 1
     Bloqueia inicialmente o conteúdo abaixo da VSL
  ------------------------------------------------------- */
  bloquearConteudoInicialDaVSL();

  bootstrapMetaPixel();
  enviarPageViewInicial();

  ativarRevelacao();
  inicializarScrollDepth();
  inicializarTempoNaPagina();
  inicializarVisualizacaoSecoes();
  inicializarCliquesCTA();
  inicializarWhatsApp();
  inicializarOutboundLinks();
  inicializarVSLTracking();
  inicializarProvasSociaisTracking();
  inicializarProvasImagemTracking();
  inicializarToastsSociais();

  /* -------------------------------------------------------
     ETAPA 2
     Inicia o contador que libera todo o conteúdo após 60s
  ------------------------------------------------------- */
  iniciarTemporizadorDeLiberacaoDaVSL();
}

/* =========================================================
   EVENTO: DOMContentLoaded
   Garante que o HTML já exista antes da execução
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  inicializarTudo();
});
