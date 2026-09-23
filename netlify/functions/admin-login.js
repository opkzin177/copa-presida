/**
 * Login área restrita
 * Env: ADMIN_USER (default admincopa), ADMIN_PASS (default presida2026)
 */
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const expectedPass = String(process.env.ADMIN_PASS || "presida2026").trim();
  const expectedUser = String(process.env.ADMIN_USER || "admincopa").trim().toLowerCase();

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "JSON inválido" });
  }

  const user = String(body.user || "").trim().toLowerCase();
  const pass = String(body.pass || "");

  if (user !== expectedUser || pass !== expectedPass) {
    await new Promise((r) => setTimeout(r, 600));
    return json(401, { ok: false, error: "Usuário ou senha incorretos" });
  }

  const exp = Date.now() + 8 * 60 * 60 * 1000;
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
