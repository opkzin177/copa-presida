/**
 * InfinitePay — Copa Presida
 * Links fixos + API como fallback + retorno confiável + liberação de ingresso
 */
(function () {
  "use strict";

  /* ── Links fixos (valores alinhados ao site) ─────────────────────────
   * Convidados → R$ 600 (PIX e cartão)
   * Demais modalidades → R$ 350 PIX / R$ 385 cartão
   * Ajuste aqui se algum slug mudar no painel InfinitePay.
   */
  var INFINITEPAY_LINKS = {
    padrao: {
      pix: {
        valor: 350,
        url: "https://checkout.infinitepay.io/welber-francisco/uKAuGUBBoc"
      },
      cartao: {
        valor: 385,
        url: "https://checkout.infinitepay.io/welber-francisco/81LkHD3qUw"
      }
    },
    convidado: {
      pix: {
        valor: 600,
        url: "https://checkout.infinitepay.io/welber-francisco/xsbbGLTjo3"
      },
      cartao: {
        valor: 600,
        url: "https://checkout.infinitepay.io/welber-francisco/ydnWGkgjNy"
      }
    }
  };

  var STORAGE_LAST = "presida_v2_last";
  var STORAGE_RETORNO = "presida_v2_retorno";
  var STORAGE_ULTIMA_PAGA = "presida_v2_ultima_modalidade_paga";

  function isConvidadoCat(cat) {
    return String(cat || "")
      .toLowerCase()
      .indexOf("convidado") >= 0;
  }

  function escolherLink(item) {
    var grupo = isConvidadoCat(item && item.categoria) ? "convidado" : "padrao";
    var modo =
      String((item && item.metodo) || "cartao").toLowerCase() === "pix"
        ? "pix"
        : "cartao";
    return INFINITEPAY_LINKS[grupo][modo];
  }

  function baseSite() {
    return location.href.split("#")[0].split("?")[0].replace(/\/$/, "") ||
      "https://inscricaocopapresida.com";
  }

  function urlRetorno(item) {
    return (
      baseSite() +
      "/?infinitepay=retorno" +
      "&order=" +
      encodeURIComponent((item && item.id) || "") +
      "&cat=" +
      encodeURIComponent((item && item.categoria) || "") +
      "&metodo=" +
      encodeURIComponent((item && item.metodo) || "cartao") +
      "#inscricao"
    );
  }

  function salvarLocal(item) {
    try {
      localStorage.setItem(STORAGE_LAST, JSON.stringify(item));
    } catch (e) {}
  }

  function lerLocal() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_LAST) || "null");
    } catch (e) {
      return null;
    }
  }

  function registrarUltimaModalidadePaga(item) {
    if (!item) return;
    var info = {
      id: item.id || null,
      categoria: item.categoria || null,
      metodo: item.metodo || null,
      valor: item.valor || null,
      nome: item.nome || null,
      parceiro: item.parceiro || null,
      ingresso: item.ingresso || null,
      pagoEm: item.pagoEm || new Date().toISOString(),
      captureMethod: item.captureMethod || item.metodo || null
    };
    try {
      localStorage.setItem(STORAGE_ULTIMA_PAGA, JSON.stringify(info));
    } catch (e) {}
    try {
      window.__presidaUltimaModalidadePaga = info;
    } catch (e) {}
  }

  window.getUltimaModalidadePaga = function () {
    try {
      return (
        window.__presidaUltimaModalidadePaga ||
        JSON.parse(localStorage.getItem(STORAGE_ULTIMA_PAGA) || "null")
      );
    } catch (e) {
      return null;
    }
  };

  window.checkoutInfinitePay = async function (item) {
    var body = {
      nome: item.nome,
      email: item.email,
      whatsapp: item.whatsapp,
      cpf: item.cpf,
      categoria: item.categoria,
      referencia: item.id,
      metodo: item.metodo || "cartao",
      redirect_url: urlRetorno(item)
    };
    var endpoints = [
      "/api/infinitepay-checkout",
      "/.netlify/functions/infinitepay-checkout"
    ];
    for (var i = 0; i < endpoints.length; i++) {
      try {
        var r = await fetch(endpoints[i], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (!r.ok) continue;
        var data = await r.json();
        if (data && data.ok && data.paymentUrl) return data.paymentUrl;
      } catch (e) {}
    }
    return "";
  };

  window.seguirParaInfinitePay = async function () {
    var item =
      typeof pedidoPendente !== "undefined" && pedidoPendente
        ? pedidoPendente
        : lerLocal();

    if (!item || !item.id) {
      if (typeof fecharTela === "function") fecharTela("telaTutorial");
      var msg = document.getElementById("payMsg");
      if (msg) {
        msg.className = "note err";
        msg.textContent =
          "Preencha a ficha e gere o pedido antes de pagar.";
      }
      return;
    }

    item.metodo = item.metodo || "cartao";
    item.status = item.status || "aguardando";
    item.pagoEm = item.pagoEm || null;

    if (typeof salvarNuvem === "function") {
      try {
        await salvarNuvem(item);
      } catch (e) {}
    }
    salvarLocal(item);

    try {
      localStorage.setItem(
        STORAGE_RETORNO,
        JSON.stringify({
          id: item.id,
          cat: item.categoria,
          metodo: item.metodo,
          url: urlRetorno(item),
          em: new Date().toISOString()
        })
      );
    } catch (e) {}

    if (typeof fecharTela === "function") fecharTela("telaTutorial");

    var apiUrl = await window.checkoutInfinitePay(item);
    if (apiUrl) {
      location.href = apiUrl;
      return;
    }

    var fixo = escolherLink(item);
    if (fixo && fixo.url) {
      var destino = fixo.url;
      var ret = urlRetorno(item);
      if (destino.indexOf("?") < 0) {
        destino +=
          "?redirect_url=" +
          encodeURIComponent(ret) +
          "&order_nsu=" +
          encodeURIComponent(item.id);
      }
      location.href = destino;
      return;
    }

    var payMsg = document.getElementById("payMsg");
    if (payMsg) {
      payMsg.className = "note err";
      payMsg.textContent =
        "Não foi possível abrir o pagamento. Tente de novo ou fale com a organização.";
    }
  };

  function mostrarIngresso(item) {
    if (!item) return;
    salvarLocal(item);
    if (typeof pedidoPendente !== "undefined") pedidoPendente = item;
    if (String(item.status || "").toLowerCase() === "pago") {
      registrarUltimaModalidadePaga(item);
    }
    if (typeof abrirRetorno === "function") abrirRetorno(item);

    var insc = document.getElementById("inscricao");
    var tela = document.getElementById("telaRetorno");
    if (insc) insc.classList.add("show");
    if (tela) tela.classList.add("open");

    var tb = document.getElementById("ticketBox");
    var tc = document.getElementById("ticketCode");
    var td = document.getElementById("ticketDupla");
    var rm = document.getElementById("retMsg");
    var pago = String(item.status || "").toLowerCase() === "pago";

    if (pago) {
      if (!item.ingresso) {
        item.ingresso =
          "PRESIDA-" + String(item.id || "").replace(/^INS-/, "");
      }
      if (tb) tb.style.display = "block";
      if (tc) tc.textContent = item.ingresso;
      if (td)
        td.textContent =
          (item.nome || "") +
          " / " +
          (item.parceiro || "") +
          " · " +
          (item.categoria || "");
      if (rm) {
        rm.className = "note ok";
        rm.textContent =
          "Pagamento confirmado. Ingresso liberado · " +
          (item.categoria || "") +
          " · " +
          (item.metodo || "");
      }
    } else if (rm) {
      rm.className = "note";
      rm.textContent =
        "Aguardando confirmação do pagamento. Se já pagou, aguarde alguns segundos ou toque em confirmar.";
    }
  }

  function orderIdValido(id) {
    id = String(id || "").trim();
    if (!id) return "";
    if (id.indexOf("{") >= 0 || id.indexOf("}") >= 0) return "";
    if (id === "ORDER" || id === "order" || id === "undefined" || id === "null") return "";
    return id;
  }

  window.tentarLiberarIngressoPago = async function (orderId) {
    var local = lerLocal();
    orderId = orderIdValido(orderId);
    if (!orderId && local) orderId = orderIdValido(local.id);
    if (!orderId) return null;

    var item = null;

    if (typeof lerNuvem === "function") {
      try {
        var db = await lerNuvem();
        var map =
          db && db.inscricoes && typeof db.inscricoes === "object"
            ? db.inscricoes
            : {};
        item = map[orderId] || null;
        if (!item) {
          Object.keys(map).forEach(function (k) {
            var it = map[k];
            if (
              it &&
              (it.id === orderId ||
                it.orderNsu === orderId ||
                String(it.referencia || "") === orderId)
            ) {
              item = it;
            }
          });
        }
      } catch (e) {}
    }

    if (!item && local && (local.id === orderId || !orderId)) item = local;

    if (!item) return null;

    if (String(item.status || "").toLowerCase() === "pago") {
      if (!item.ingresso) {
        item.ingresso =
          "PRESIDA-" + String(item.id || orderId).replace(/^INS-/, "");
      }
      mostrarIngresso(item);
      return item;
    }

    mostrarIngresso(item);
    return item;
  };

  function pollLiberacao(orderId, tentativas) {
    tentativas = tentativas || 0;
    if (tentativas > 12) return;
    window.tentarLiberarIngressoPago(orderId).then(function (item) {
      if (item && String(item.status || "").toLowerCase() === "pago") return;
      setTimeout(function () {
        pollLiberacao(orderId, tentativas + 1);
      }, tentativas < 4 ? 1500 : 3000);
    });
  }

  function onReturn() {
    var qs = location.search || "";
    if (!/[?&]infinitepay=retorno/.test(qs) && !/[?&]pagamento=retorno/.test(qs))
      return;

    var params = new URLSearchParams(qs);
    var orderId = orderIdValido(
      params.get("order") ||
      params.get("order_nsu") ||
      params.get("ref") ||
      ""
    );
    var slug = params.get("slug") || params.get("invoice_slug") || "";
    var capture = params.get("capture_method") || "";
    var receipt = params.get("receipt_url") || "";
    var metodoQ = params.get("metodo") || "";
    if (metodoQ && (metodoQ.indexOf("{") >= 0 || metodoQ === "METODO")) metodoQ = "";

    var last = lerLocal();
    if (!orderId && last) orderId = orderIdValido(last.id);

    if (last) {
      if (slug) last.invoiceSlug = slug;
      if (capture) last.captureMethod = capture;
      if (receipt) last.receiptUrl = receipt;
      if (metodoQ) last.metodo = metodoQ;
      if (params.get("transaction_nsu"))
        last.transactionNsu = params.get("transaction_nsu");
      salvarLocal(last);
    }

    mostrarIngresso(last || { id: orderId, status: "aguardando" });

    if (orderId) {
      setTimeout(function () {
        window.tentarLiberarIngressoPago(orderId);
      }, 400);
      setTimeout(function () {
        window.tentarLiberarIngressoPago(orderId);
      }, 1800);
      pollLiberacao(orderId, 0);
    }
  }

  function patchUI() {
    var panel = document.getElementById("panel-cartao");
    if (panel) {
      var note = panel.querySelector(".note");
      if (note)
        note.textContent =
          "InfinitePay · Pix ou cartão (até 12x). Após pagar, você volta ao site e o ingresso é liberado.";
      var btn = panel.querySelector("button");
      if (btn) {
        btn.textContent = "Pagar com InfinitePay";
        btn.setAttribute("onclick", "iniciarPagamento('cartao')");
      }
    }

    var tut = document.getElementById("telaTutorial");
    if (tut) {
      var steps = tut.querySelectorAll(".steps li span:last-child");
      if (steps[0])
        steps[0].textContent = "O checkout InfinitePay abre (Pix ou cartão).";
      if (steps[2])
        steps[2].textContent =
          "Ao concluir, o site volta sozinho para a tela de ingresso.";
      var nota = document.getElementById("tutNota");
      if (nota)
        nota.textContent =
          "Após pagar, você é redirecionado de volta e o ingresso é liberado automaticamente.";
      var go = tut.querySelector(".btn-solid");
      if (go) {
        go.textContent = "Entendi, ir para o pagamento";
        go.setAttribute("onclick", "seguirParaInfinitePay()");
      }
    }

    if (typeof window.seguirParaPagBank === "function") {
      window.seguirParaPagBank = window.seguirParaInfinitePay;
    }
  }

  function boot() {
    patchUI();
    onReturn();
    setTimeout(patchUI, 500);
    setTimeout(patchUI, 1500);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
