/**
 * Netlify Function — cria link de pagamento InfinitePay (Pix + Cartão)
 *
 * Env (Netlify → Site settings → Environment variables):
 *   INFINITEPAY_HANDLE = sua InfiniteTag (sem o $)
 *   SITE_URL           = https://inscricaocopapresida.com
 *
 * Após o pagamento, o cliente volta para:
 *   https://inscricaocopapresida.com/?infinitepay=retorno&order=INS-XXXX
 * onde o site abre a tela de ingresso.
 *
 * API: POST https://api.checkout.infinitepay.io/links
 */

const PRECOS = {
  padrao: { pix: 350, credito: 385 },
  convidado: { pix: 600, credito: 660 }
};

function isConvidado(cat) {
  return String(cat || "").toLowerCase().includes("convidado");
}

function valorCentavos(categoria, metodo) {
  const t = isConvidado(categoria) ? PRECOS.convidado : PRECOS.padrao;
  const reais = metodo === "pix" ? t.pix : t.credito;
  return Math.round(reais * 100);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "JSON inválido" });
  }

  const {
    nome,
    email,
    whatsapp,
    cpf,
    categoria,
    referencia,
    metodo = "cartao",
    redirect_url
  } = body;

  if (!nome || !email || !referencia) {
    return json(400, {
      ok: false,
      error: "nome, email e referencia são obrigatórios"
    });
  }

  const handle = (process.env.INFINITEPAY_HANDLE || "").trim().replace(/^\$/, "");
  if (!handle) {
    return json(500, {
      ok: false,
      error: "INFINITEPAY_HANDLE não configurado nas variáveis de ambiente"
    });
  }

  const amount = valorCentavos(categoria, metodo);
  const siteBase = (
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.SITE_URL ||
    "https://inscricaocopapresida.com"
  ).replace(/\/$/, "");

  const webhookUrl = `${siteBase}/.netlify/functions/infinitepay-webhook`;
  const orderNsu = String(referencia).slice(0, 64);

  // Volta para a página de pagamento do site → tela de ingresso
  const defaultRedirect =
    `${siteBase}/?infinitepay=retorno&order=${encodeURIComponent(orderNsu)}&metodo=${encodeURIComponent(metodo || "cartao")}#inscricao`;

  const payload = {
    handle,
    redirect_url: redirect_url || defaultRedirect,
    webhook_url: webhookUrl,
    order_nsu: orderNsu,
    customer: {
      name: String(nome).slice(0, 120),
      email: String(email).slice(0, 120),
      phone_number: whatsapp
        ? `+55${String(whatsapp).replace(/\D/g, "").slice(0, 11)}`
        : undefined
    },
    items: [
      {
        quantity: 1,
        price: amount,
        description: `Copa Presida — ${categoria || "Inscrição"}`.slice(0, 100)
      }
    ]
  };

  if (!payload.customer.phone_number) delete payload.customer.phone_number;

  try {
    const res = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("InfinitePay error", res.status, data);
      return json(502, {
        ok: false,
        error: "Falha ao criar link InfinitePay",
        detail: data
      });
    }

    const paymentUrl = data.url || data.checkout_url;
    if (!paymentUrl) {
      return json(502, {
        ok: false,
        error: "Link criado sem URL de pagamento",
        detail: data
      });
    }

    return json(200, {
      ok: true,
      paymentUrl,
      orderNsu,
      valorCentavos: amount,
      mode: "infinitepay",
      webhookUrl,
      redirectUrl: payload.redirect_url
    });
  } catch (err) {
    console.error(err);
    return json(500, {
      ok: false,
      error: "Erro interno ao chamar InfinitePay"
    });
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function json(status, obj) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders()
    },
    body: JSON.stringify(obj)
  };
}
