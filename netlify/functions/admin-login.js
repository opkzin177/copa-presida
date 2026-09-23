/**
 * Login da área restrita — senha SOMENTE via variável de ambiente
 *
 * Netlify → Environment variables (marque ADMIN_PASS como Secret):
 *   ADMIN_USER = admincopa
 *   ADMIN_PASS = senha-forte-de-pelo-menos-12-caracteres
 *
 * Em produção: se ADMIN_PASS não estiver definido, o login fica desabilitado.
 */

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const expectedPass = process.env.ADMIN_PASS;
  if (!expectedPass || expectedPass.length < 8) {
    return json(503, {
      ok: false,
      error: "Admin não configurado. Defina ADMIN_PASS nas variáveis de ambiente do Netlify."
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "JSON inválido" });
  }

  const user = String(body.user || "").trim().toLowerCase();
  const pass = String(body.pass || "");

  const expectedUser = (process.env.ADMIN_USER || "admincopa").toLowerCase();

  if (user !== expectedUser || pass !== expectedPass) {
    // atraso anti-brute-force
    await new Promise((r) => setTimeout(r, 800));
    return json(401, { ok: false, error: "Usuário ou senha incorretos" });
  }

  const exp = Date.now() + 8 * 60 * 60 * 1000; // 8h
  const token = Buffer.from(
    JSON.stringify({ u: expectedUser, exp, v: 2 })
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
