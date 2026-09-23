/**
 * Webhook InfinitePay — notificação de pagamento aprovado
 *
 * URL pública após deploy:
 *   https://inscricaocopapresida.com/.netlify/functions/infinitepay-webhook
 *   ou  https://inscricaocopapresida.com/api/infinitepay-webhook
 *
 * Envie esta URL no campo webhook_url ao criar o link.
 * Responda 200 OK rápido (< 1s). Se 400, a InfinitePay reenvia.
 *
 * Env opcional:
 *   FIREBASE_DB_URL
 *   INFINITEPAY_WEBHOOK_SECRET — se definido, exige header x-webhook-secret ou ?secret=
 */

const DEFAULT_DB =
  "https://copa-presida-default-rtdb.firebaseio.com/presida_v2.json";

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors(), body: "" };
  }

  if (event.httpMethod === "GET") {
    return json(200, {
      ok: true,
      service: "infinitepay-webhook",
      hint: "InfinitePay envia POST quando o pagamento é aprovado"
    });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const secret = process.env.INFINITEPAY_WEBHOOK_SECRET;
  if (secret) {
    const q = event.queryStringParameters || {};
    const hdr =
      event.headers["x-webhook-secret"] ||
      event.headers["X-Webhook-Secret"] ||
      "";
    if (q.secret !== secret && hdr !== secret) {
      return json(401, { ok: false, error: "Unauthorized" });
    }
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "JSON inválido" });
  }

  // Payload típico InfinitePay:
  // invoice_slug, amount, paid_amount, installments, capture_method,
  // transaction_nsu, order_nsu, receipt_url, items[]
  const orderNsu = String(
    body.order_nsu || body.orderNsu || body.order_id || ""
  ).trim();
  const transactionNsu = body.transaction_nsu || body.transactionNsu || null;
  const captureMethod = String(body.capture_method || body.captureMethod || "").toLowerCase();
  const amount = body.paid_amount != null ? body.paid_amount : body.amount;
  const receiptUrl = body.receipt_url || body.receiptUrl || null;
  const invoiceSlug = body.invoice_slug || body.invoiceSlug || null;

  console.log("infinitepay-webhook", {
    orderNsu,
    transactionNsu,
    captureMethod,
    amount,
    invoiceSlug
  });

  if (!orderNsu) {
    // Sem order_nsu não conseguimos marcar a inscrição — responde 200 para não reenviar infinitamente
    return json(200, {
      ok: true,
      action: "ignored",
      reason: "sem order_nsu"
    });
  }

  try {
    await appendWebhookLog({
      receivedAt: new Date().toISOString(),
      provider: "infinitepay",
      orderNsu,
      transactionNsu,
      captureMethod,
      amount,
      invoiceSlug,
      receiptUrl
    });

    const updated = await markInscricaoPaga({
      orderNsu,
      transactionNsu,
      captureMethod,
      amount,
      receiptUrl,
      invoiceSlug
    });

    return json(200, {
      ok: true,
      action: "marked_paid",
      orderNsu,
      ingresso: updated && updated.ingresso,
      transactionNsu
    });
  } catch (err) {
    console.error("infinitepay webhook error", err);
    // InfinitePay reenvia em 400; devolvemos 200 para não travar, e logamos o erro
    return json(200, {
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
};

async function dbUrl() {
  return process.env.FIREBASE_DB_URL || DEFAULT_DB;
}

async function readDb() {
  const url = await dbUrl();
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("Firebase read failed " + r.status);
  return (await r.json()) || {};
}

async function writeDb(db) {
  const url = await dbUrl();
  db.updatedAt = new Date().toISOString();
  const r = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(db)
  });
  if (!r.ok) throw new Error("Firebase write failed " + r.status);
}

async function appendWebhookLog(entry) {
  const db = await readDb();
  if (!db.webhooks || typeof db.webhooks !== "object") db.webhooks = {};
  const key = "WH-IP-" + Date.now().toString(36).toUpperCase();
  db.webhooks[key] = entry;
  const keys = Object.keys(db.webhooks).sort();
  if (keys.length > 200) {
    keys.slice(0, keys.length - 200).forEach((k) => delete db.webhooks[k]);
  }
  await writeDb(db);
}

function findInscricao(db, orderNsu) {
  const map =
    db.inscricoes && typeof db.inscricoes === "object" ? db.inscricoes : {};
  if (map[orderNsu]) return { key: orderNsu, item: map[orderNsu] };
  for (const k of Object.keys(map)) {
    const it = map[k];
    if (
      it &&
      (it.id === orderNsu ||
        it.checkoutId === orderNsu ||
        it.orderNsu === orderNsu)
    ) {
      return { key: k, item: it };
    }
  }
  return null;
}

async function markInscricaoPaga(parsed) {
  const db = await readDb();
  if (!db.inscricoes || typeof db.inscricoes !== "object") db.inscricoes = {};

  let found = findInscricao(db, parsed.orderNsu);
  if (!found) {
    const id = parsed.orderNsu;
    db.inscricoes[id] = {
      id,
      status: "aguardando",
      createdAt: new Date().toISOString(),
      categoria: "—",
      nome: "",
      email: ""
    };
    found = { key: id, item: db.inscricoes[id] };
  }

  const item = found.item;
  const metodo =
    parsed.captureMethod.includes("pix")
      ? "pix"
      : parsed.captureMethod.includes("credit") ||
          parsed.captureMethod.includes("card") ||
          parsed.captureMethod.includes("debit")
        ? "cartao"
        : item.metodo || "cartao";

  item.status = "pago";
  item.metodo = metodo;
  item.pagoEm = new Date().toISOString();
  item.transactionNsu = parsed.transactionNsu || item.transactionNsu;
  item.invoiceSlug = parsed.invoiceSlug || item.invoiceSlug;
  item.receiptUrl = parsed.receiptUrl || item.receiptUrl;
  item.infinitepayStatus = "PAID";
  if (parsed.amount != null) item.valorPagoCentavos = parsed.amount;
  if (!item.ingresso) {
    item.ingresso =
      "PRESIDA-" + String(item.id || found.key).replace(/^INS-/, "");
  }
  item.webhookAt = new Date().toISOString();
  item.provider = "infinitepay";

  db.inscricoes[found.key] = item;
  await writeDb(db);
  return item;
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };
}

function json(status, obj) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", ...cors() },
    body: JSON.stringify(obj)
  };
}
