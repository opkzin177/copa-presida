/* InfinitePay — checkout, UI e retorno com ingresso */
(function () {
  function urlRetornoInfinitePay(item) {
    var base = location.href.split("#")[0].split("?")[0];
    return (
      base +
      "?infinitepay=retorno&order=" +
      encodeURIComponent((item && item.id) || "") +
      "&cat=" +
      encodeURIComponent((item && item.categoria) || "") +
      "&metodo=" +
      encodeURIComponent((item && item.metodo) || "cartao") +
      "#inscricao"
    );
  }

  window.checkoutInfinitePay = async function (item) {
    var body = {
      nome: item.nome,
      email: item.email,
      whatsapp: item.whatsapp,
      cpf: item.cpf,
      categoria: item.categoria,
      referencia: item.id,
      metodo: item.metodo || "cartao",
      redirect_url: urlRetornoInfinitePay(item)
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
    var item = typeof pedidoPendente !== "undefined" ? pedidoPendente : null;
    if (!item) {
      try {
        item = JSON.parse(localStorage.getItem("presida_v2_last") || "null");
      } catch (e) {
        item = null;
      }
    }
    if (!item) {
      if (typeof fecharTela === "function") fecharTela("telaTutorial");
      return;
    }
    try {
      localStorage.setItem(
        "presida_v2_retorno",
        JSON.stringify({ id: item.id, url: urlRetornoInfinitePay(item) })
      );
    } catch (e) {}
    var apiUrl = await window.checkoutInfinitePay(item);
    if (typeof fecharTela === "function") fecharTela("telaTutorial");
    if (apiUrl) {
      location.href = apiUrl;
      return;
    }
    var msg = document.getElementById("payMsg");
    if (msg) {
      msg.className = "note err";
      msg.textContent =
        "Não foi possível abrir o checkout InfinitePay. Verifique INFINITEPAY_HANDLE no Netlify.";
    }
  };

  window.tentarLiberarIngressoPago = async function (orderId) {
    if (!orderId || typeof lerNuvem !== "function") return;
    try {
      var db = await lerNuvem();
      var map =
        db.inscricoes && typeof db.inscricoes === "object" ? db.inscricoes : {};
      var item = map[orderId] || null;
      if (!item) {
        Object.keys(map).forEach(function (k) {
          var it = map[k];
          if (it && (it.id === orderId || it.orderNsu === orderId)) item = it;
        });
      }
      if (!item || String(item.status || "") !== "pago") return;
      if (!item.ingresso)
        item.ingresso =
          "PRESIDA-" + String(item.id || orderId).replace(/^INS-/, "");
      try {
        localStorage.setItem("presida_v2_last", JSON.stringify(item));
      } catch (e) {}
      if (typeof pedidoPendente !== "undefined") pedidoPendente = item;
      if (typeof abrirRetorno === "function") abrirRetorno(item);
      var tb = document.getElementById("ticketBox");
      var tc = document.getElementById("ticketCode");
      var td = document.getElementById("ticketDupla");
      var rm = document.getElementById("retMsg");
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
          "Pagamento confirmado. Ingresso liberado automaticamente.";
      }
    } catch (e) {}
  };

  function patchUI() {
    // Botão cartão → InfinitePay
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
    // Tutorial → InfinitePay
    var tut = document.getElementById("telaTutorial");
    if (tut) {
      var steps = tut.querySelectorAll(".steps li span:last-child");
      if (steps[0]) steps[0].textContent = "O checkout InfinitePay abre (Pix ou cartão).";
      if (steps[2])
        steps[2].textContent =
          "Ao concluir, o site volta sozinho para a tela de ingresso.";
      var nota = document.getElementById("tutNota");
      if (nota)
        nota.textContent =
          "Após pagar, você é redirecionado de volta para esta página e o ingresso é liberado.";
      var go = tut.querySelector(".btn-solid");
      if (go) {
        go.textContent = "Entendi, ir para o pagamento";
        go.setAttribute("onclick", "seguirParaInfinitePay()");
      }
    }
    // Override seguirParaPagBank se existir
    if (typeof window.seguirParaPagBank === "function") {
      window.seguirParaPagBank = window.seguirParaInfinitePay;
    }
  }

  function onReturn() {
    if (!/[?&]infinitepay=retorno/.test(location.search)) return;
    var params = new URLSearchParams(location.search);
    var orderId = params.get("order") || params.get("ref") || "";
    var last = null;
    try {
      last = JSON.parse(localStorage.getItem("presida_v2_last") || "null");
    } catch (e) {}
    if (typeof abrirRetorno === "function" && last) abrirRetorno(last);
    else {
      var insc = document.getElementById("inscricao");
      var tela = document.getElementById("telaRetorno");
      if (insc) insc.classList.add("show");
      if (tela) tela.classList.add("open");
    }
    if (orderId) {
      setTimeout(function () {
        window.tentarLiberarIngressoPago(orderId);
      }, 600);
      setTimeout(function () {
        window.tentarLiberarIngressoPago(orderId);
      }, 2500);
    }
  }

  function boot() {
    patchUI();
    onReturn();
    // Re-patch after app.js may re-render
    setTimeout(patchUI, 500);
    setTimeout(patchUI, 1500);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
