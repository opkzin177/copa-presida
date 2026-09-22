/**
 * Netlify Function — cria checkout dinâmico PagBank (cartão)
 * Valores já definidos no site: padrão R$ 385 / convidado R$ 660
 *
 * Variáveis de ambiente (Netlify UI → Site settings → Environment variables):
 *   PAGBANK_TOKEN   = token de produção ou sandbox
 *   PAGBANK_ENV     = "production" | "sandbox" (default sandbox)
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
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: ""
    };
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
    return json(400, { ok: false, error: "nome, email e referencia são obrigatórios" });
  }

  const token = process.env.PAGBANK_TOKEN;
  if (!token) {
    // Fallback: devolve o link estático já usado no site
    const isConv = isConvidado(categoria);
    const staticUrl = isConv
      ? "https://pag.ae/82av5xD4o"
      : "https://pag.ae/82av5Uipo";
    return json(200, {
      ok: true,
      paymentUrl: staticUrl,
      mode: "static-fallback",
      valorCentavos: valorCentavos(categoria, metodo)
    });
  }

  const env = (process.env.PAGBANK_ENV || "sandbox").toLowerCase();
  const baseUrl =
    env === "production"
      ? "https://api.pagseguro.com"
      : "https://sandbox.api.pagseguro.com";

  const amount = valorCentavos(categoria, metodo);
  const payload = {
    reference_id: String(referencia).slice(0, 64),
    customer: {
      name: String(nome).slice(0, 120),
      email: String(email).slice(0, 120),
      tax_id: String(cpf || "").replace(/\D/g, "").slice(0, 11) || undefined,
      phones: whatsapp
        ? [
            {
              country: "55",
              area: String(whatsapp).replace(/\D/g, "").slice(0, 2) || "61",
              number: String(whatsapp).replace(/\D/g, "").slice(2) || "999999999",
              type: "MOBILE"
            }
          ]
        : undefined
    },
    items: [
      {
        reference_id: "copa-presida",
        name: `Copa Presida — ${categoria || "Inscrição"}`.slice(0, 100),
        quantity: 1,
        unit_amount: amount
      }
    ],
    payment_methods: [
      { type: "CREDIT_CARD" },
      { type: "DEBIT_CARD" }
    ],
    redirect_url:
      redirect_url ||
      "https://copa-presida.netlify.app/?pagbank=retorno",
    soft_descriptor: "COPA PRESIDA"
  };

  try {
    const res = await fetch(`${baseUrl}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("PagBank error", res.status, data);
      return json(502, {
        ok: false,
        error: "Falha ao criar checkout PagBank",
        detail: data
      });
    }

    const payLink = (data.links || []).find((l) => l.rel === "PAY");
    const paymentUrl = payLink?.href;

    if (!paymentUrl) {
      return json(502, {
        ok: false,
        error: "Checkout criado sem link de pagamento",
        detail: data
      });
    }

    return json(200, {
      ok: true,
      paymentUrl,
      checkoutId: data.id,
      valorCentavos: amount,
      mode: "dynamic"
    });
  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: "Erro interno ao chamar PagBank" });
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
