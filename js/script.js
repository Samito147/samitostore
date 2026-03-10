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
  elementosBloqueados: []
};

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
  function calcularProfundidadeScroll() {
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

  function verificarScroll() {
    const profundidadeAtual = calcularProfundidadeScroll();

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
   FUNÇÃO: inicializarTudo
   Orquestra todas as funcionalidades do script
========================================================= */
function inicializarTudo() {
  estadoTracking.contextoPagina = obterContextoPagina();

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