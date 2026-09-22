# Copa Presida de Futevôlei — 5ª Etapa

Site de inscrições com:

- Programação por dia/categoria
- Formulário de dupla
- **PIX** (QR + Copia e Cola) e **Cartão PagBank**
- Valores fixos:
  - Categorias padrão → PIX **R$ 350** · Cartão **R$ 385**
  - Convidados → PIX **R$ 600** · Cartão **R$ 660**
- Área restrita (admin) com KPIs, discos e lista por categoria
- Backend em **Netlify Functions** para checkout dinâmico, login e **webhook PagBank**

## Deploy no Netlify (recomendado)

1. Conecte este repositório no [Netlify](https://app.netlify.com).
2. Build settings (já no `netlify.toml`):
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
3. Em **Site settings → Environment variables** configure:
   - `ADMIN_USER` / `ADMIN_PASS` (login do painel)
   - `PAGBANK_TOKEN` + `PAGBANK_ENV` (opcional — se vazio, usa os links pag.ae já existentes)
   - `SITE_URL` = URL pública do site (ex.: `https://inscricaocopapresida.com`)
4. Deploy.

### Login admin

- Clique 5× no logo **P Complexo Presida** (ou `Ctrl+Shift+K`, ou `?painel=1`).
- Usuário/senha: os valores de `ADMIN_USER` / `ADMIN_PASS` (padrão local: `copa5` / `presida2026`).

### Pagamento

| Método | Fluxo |
|--------|--------|
| **PIX** | QR + payload estático Santander (Welber Francisco Rodrigue). Confirmação com titular + CPF. |
| **Cartão** | Chama `/.netlify/functions/pagbank-checkout`. Com token PagBank → checkout dinâmico. Sem token → link estático `pag.ae`. |

### Webhook PagBank

Endpoint: `/.netlify/functions/pagbank-webhook` (também `/api/pagbank-webhook`)

No checkout dinâmico já são enviados:
- `payment_notification_urls` → pagamento (`PAID`, `DECLINED`, `WAITING`, …)
- `notification_urls` → checkout (`EXPIRED`, …)

Quando chega `PAID`, a inscrição no Firebase vira **paga** e o ingresso é gerado.

Env opcional:
- `PAGBANK_WEBHOOK_SECRET` — exige `?secret=` ou header `x-webhook-secret`
- `FIREBASE_DB_URL` — override do RTDB
- `SITE_URL` / `URL` — base da URL do webhook no create checkout

Teste manual:
```bash
curl -X POST https://SEU-SITE.netlify.app/.netlify/functions/pagbank-webhook \
  -H 'Content-Type: application/json' \
  -d '{"reference_id":"INS-TESTE","charges":[{"id":"CHAR_1","status":"PAID","payment_method":{"type":"CREDIT_CARD"},"amount":{"value":38500}}]}'
```

## Desenvolvimento local

```bash
npm i -g netlify-cli
netlify dev
```

## Estrutura

```
copa-presida/
├── public/
│   ├── index.html
│   └── app.js
├── netlify/
│   └── functions/
│       ├── pagbank-checkout.js
│       ├── pagbank-webhook.js
│       └── admin-login.js
├── netlify.toml
├── .env.example
└── README.md
```

## Firebase

`https://copa-presida-default-rtdb.firebaseio.com/presida_v2.json`

## Organização

Complexo Presida · Taguatinga Norte · @complexopresida  
WhatsApp org: (61) 99594-5367
