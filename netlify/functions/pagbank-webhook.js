/**
 * Webhook PagBank — notificação de pagamento / checkout
 *
 * URL pública (após deploy):
 *   https://SEU-SITE.netlify.app/.netlify/functions/pagbank-webhook
 *   ou  https://SEU-SITE.netlify.app/api/pagbank-webhook
 *
 * No criar checkout, envie esta URL em:
 *   payment_notification_urls  → status do pagamento (PAID, DECLINED, …)
 *   notification_urls          → status do checkout (EXPIRED, …)
 *
 * Env (opcional):
 *   FIREBASE_DB_URL     — default: RTDB da Copa Presida
 *   PAGBANK_WEBHOOK_SECRET — se definido, exige header x-webhook-secret ou ?secret=
 *
 * Docs: https://developer.pagbank.com.br/reference/webhooks-checkout
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
      service: "pagbank-webhook",
      hint: "PagBank envia POST com JSON de charge/checkout"
    });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const secret = process.env.PAGBANK_WEBHOOK_SECRET;
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

  console.log("pagbank-webhook", {
    id: body.id,
    reference_id: body.reference_id,
    status: body.status,
    charges: (body.charges || []).map((c) => ({
      id: c.id,
      status: c.status,
      type: c.payment_method && c.payment_method.type
    }))
  });

  const parsed = interpretPayload(body);

  try {
    await appendWebhookLog({
      receivedAt: new Date().toISOString(),
      referenceId: parsed.referenceId,
      chargeStatus: parsed.chargeStatus,
      checkoutStatus: parsed.checkoutStatus,
      chargeId: parsed.chargeId,
      paymentType: parsed.paymentType,
      amount: parsed.amount,
      rawId: body.id
    });

    if (parsed.paid && parsed.referenceId) {
      const updated = await markInscricaoPaga(parsed);
      return json(200, {
        ok: true,
        action: "marked_paid",
        referenceId: parsed.referenceId,
        ingresso: updated && updated.ingresso,
        chargeId: parsed.chargeId
      });
    }

    if (parsed.referenceId && parsed.chargeStatus) {
      await updateInscricaoStatus(parsed);
      return json(200, {
        ok: true,
        action: "status_updated",
        referenceId: parsed.referenceId,
        chargeStatus: parsed.chargeStatus
      });
    }

    return json(200, {
      ok: true,
      action: "ignored",
      reason: "sem referência paga ou status útil",
      referenceId: parsed.referenceId || null
    });
  } catch (err) {
    console.error("webhook error", err);
    return json(200, {
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
};

function interpretPayload(body) {
  const referenceId = String(
    body.reference_id ||
      body.referenceId ||
      (body.charges && body.charges[0] && body.charges[0].reference_id) ||
      ""
  ).trim();

  const charges = Array.isArray(body.charges) ? body.charges : [];
  const paidCharge = charges.find(
    (c) => String(c.status || "").toUpperCase() === "PAID"
  );
  const charge = paidCharge || charges[charges.length - 1] || null;

  const chargeStatus = charge
    ? String(charge.status || "").toUpperCase()
    : "";
  const checkoutStatus = String(body.status || "").toUpperCase();

  const rootPaid = checkoutStatus === "PAID";
  const paid = chargeStatus === "PAID" || rootPaid;

  const paymentType = charge && charge.payment_method
    ? String(charge.payment_method.type || "").toUpperCase()
    : "";

  const amount =
    (charge && charge.amount && charge.amount.value) ||
    (charge && charge.amount && charge.amount.summary && charge.amount.summary.paid) ||
    null;

  return {
    referenceId,
    chargeStatus,
    checkoutStatus,
    chargeId: charge ? charge.id : body.id || null,
    paymentType,
    amount,
    paid,
    paidAt:
      (charge && (charge.paid_at || charge.paidAt)) ||
      (paid ? new Date().toISOString() : null),
    customer: body.customer || null
  };
}

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
  const key = "WH-" + Date.now().toString(36).toUpperCase();
  db.webhooks[key] = entry;
  const keys = Object.keys(db.webhooks).sort();
  if (keys.length > 200) {
    keys.slice(0, keys.length - 200).forEach((k) => delete db.webhooks[k]);
  }
  await writeDb(db);
}

function findInscricao(db, referenceId) {
  const map = db.inscricoes && typeof db.inscricoes === "object" ? db.inscricoes : {};
  if (map[referenceId]) return { key: referenceId, item: map[referenceId] };
  for (const k of Object.keys(map)) {
    const it = map[k];
    if (it && (it.id === referenceId || it.checkoutId === referenceId)) {
      return { key: k, item: it };
    }
  }
  return null;
}

async function markInscricaoPaga(parsed) {
  const db = await readDb();
  if (!db.inscricoes || typeof db.inscricoes !== "object") db.inscricoes = {};

  let found = findInscricao(db, parsed.referenceId);
  if (!found) {
    const id = parsed.referenceId;
    db.inscricoes[id] = {
      id,
      status: "aguardando",
      createdAt: new Date().toISOString(),
      categoria: "—",
      nome: (parsed.customer && parsed.customer.name) || "",
      email: (parsed.customer && parsed.customer.email) || ""
    };
    found = { key: id, item: db.inscricoes[id] };
  }

  const item = found.item;
  const metodo =
    parsed.paymentType.includes("PIX")
      ? "pix"
      : parsed.paymentType.includes("CREDIT") || parsed.paymentType.includes("DEBIT")
        ? "cartao"
        : item.metodo || "cartao";

  item.status = "pago";
  item.metodo = metodo;
  item.pagoEm = parsed.paidAt || new Date().toISOString();
  item.chargeId = parsed.chargeId || item.chargeId;
  item.pagbankStatus = "PAID";
  if (parsed.amount != null) item.valorPagoCentavos = parsed.amount;
  if (!item.ingresso) {
    item.ingresso = "PRESIDA-" + String(item.id || found.key).replace(/^INS-/, "");
  }
  item.webhookAt = new Date().toISOString();

  db.inscricoes[found.key] = item;
  await writeDb(db);
  return item;
}

async function updateInscricaoStatus(parsed) {
  const db = await readDb();
  const found = findInscricao(db, parsed.referenceId);
  if (!found) return null;

  const item = found.item;
  item.pagbankStatus = parsed.chargeStatus || parsed.checkoutStatus;
  item.chargeId = parsed.chargeId || item.chargeId;
  item.webhookAt = new Date().toISOString();

  const st = parsed.chargeStatus;
  if (st === "DECLINED" || st === "CANCELED") {
    if (item.status !== "pago") item.status = "recusado";
  } else if (st === "IN_ANALYSIS" || st === "WAITING") {
    if (item.status !== "pago") item.status = "aguardando";
  }

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
