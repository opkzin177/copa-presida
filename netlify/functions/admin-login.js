/**
 * Login da área restrita — senha via variável de ambiente
 *
 * Netlify → Environment variables:
 *   ADMIN_USER = copa5          (opcional, default copa5)
 *   ADMIN_PASS = sua-senha-forte
 *
 * Retorna um token simples (base64) válido por 8h no client.
 * Em produção real, troque por JWT assinado ou Netlify Identity.
 */

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors(), body: "" };
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

  const user = String(body.user || "").trim().toLowerCase();
  const pass = String(body.pass || "");

  const expectedUser = (process.env.ADMIN_USER || "copa5").toLowerCase();
  const expectedPass = process.env.ADMIN_PASS || "presida2026";

  if (user !== expectedUser || pass !== expectedPass) {
    // pequeno atraso anti-brute
    await new Promise((r) => setTimeout(r, 600));
    return json(401, { ok: false, error: "Usuário ou senha incorretos" });
  }

  const exp = Date.now() + 8 * 60 * 60 * 1000; // 8h
  const token = Buffer.from(
    JSON.stringify({ u: expectedUser, exp, v: 1 })
  ).toString("base64url");

  return json(200, {
    ok: true,
    token,
    expiresAt: new Date(exp).toISOString()
  });
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function json(status, obj) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", ...cors() },
    body: JSON.stringify(obj)
  };
}
