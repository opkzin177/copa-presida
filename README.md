# Copa Presida de Futevôlei — 5ª Etapa

Site de inscrições: **https://inscricaocopapresida.com**

- Programação por dia/categoria
- Formulário de dupla
- **InfinitePay** (Pix taxa zero + Cartão até 12x) — **recomendado**
- PagBank (legado, ainda disponível)
- Valores fixos:
  - Categorias padrão → PIX **R$ 350** · Cartão **R$ 385**
  - Convidados → PIX **R$ 600** · Cartão **R$ 660**
- Área restrita (admin) com KPIs e lista por categoria
- Backend em **Netlify Functions**

---

## Deploy no Netlify

1. Conecte este repositório: https://app.netlify.com/projects/copapreisda  
   **Site settings → Build & deploy → Continuous deployment → Link repository** → `opkzin177/copa-presida`
2. Build settings (já no `netlify.toml`):
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
3. **Environment variables** (obrigatórias):

| Variável | Descrição |
|----------|-----------|
| `INFINITEPAY_HANDLE` | Sua InfiniteTag **sem** o `$` |
| `ADMIN_USER` | Usuário do painel admin |
| `ADMIN_PASS` | Senha forte (marque como **Secret**) |
| `SITE_URL` | `https://inscricaocopapresida.com` |

Opcionais:
- `INFINITEPAY_WEBHOOK_SECRET` — protege o webhook
- `PAGBANK_TOKEN` / `PAGBANK_ENV` — se ainda quiser PagBank
- `FIREBASE_DB_URL` — override do RTDB

4. Deploy.

---

## Login admin

- Clique 5× no logo **P Complexo Presida** (ou `Ctrl+Shift+K`, ou `?painel=1`).
- Usuário/senha: **somente** os valores de `ADMIN_USER` / `ADMIN_PASS` no Netlify.
- **Nunca** coloque a senha no código, no README ou em commit.

---

## Pagamento — InfinitePay (principal)

| Endpoint | Função |
|----------|--------|
| `POST /.netlify/functions/infinitepay-checkout` | Cria link de pagamento (Pix + Cartão) |
| `POST /.netlify/functions/infinitepay-webhook` | Recebe confirmação e marca inscrição como **paga** |

Fluxo:
1. Front envia `{ nome, email, whatsapp, cpf, categoria, referencia, metodo }` para o checkout.
2. A função cria o link na InfinitePay e devolve `paymentUrl`.
3. Cliente paga (Pix grátis ou cartão).
4. InfinitePay chama o webhook → inscrição no Firebase vira `status: "pago"` e gera ingresso.

Teste manual do webhook:
```bash
curl -X POST https://inscricaocopapresida.com/.netlify/functions/infinitepay-webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "order_nsu": "INS-TESTE",
    "transaction_nsu": "uuid-teste",
    "capture_method": "pix",
    "amount": 35000,
    "paid_amount": 35000,
    "invoice_slug": "abc123"
  }'
```

Documentação oficial: https://www.infinitepay.io/checkout

---

## Pagamento — PagBank (legado)

Ainda funciona se configurar `PAGBANK_TOKEN`.
Endpoints: `pagbank-checkout` e `pagbank-webhook`.

---

## Segurança aplicada

- Senha admin **apenas** em variável de ambiente (Secret no Netlify).
- README sem credenciais em texto puro.
- Headers HTTP no `netlify.toml`:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- Webhook pode exigir `INFINITEPAY_WEBHOOK_SECRET` (header ou query).
- Login admin com atraso anti-brute-force.

**Próximo passo recomendado:** no console Firebase, restringir regras de escrita do RTDB (hoje a escrita é aberta pela URL).

---

## Desenvolvimento local

```bash
npm i -g netlify-cli
# copie .env.example → .env e preencha
netlify dev
```

---

## Estrutura

```
copa-presida/
├── public/
│   ├── index.html
│   └── app.js
├── netlify/
│   └── functions/
│       ├── infinitepay-checkout.js   ← NOVO
│       ├── infinitepay-webhook.js    ← NOVO
│       ├── pagbank-checkout.js
│       ├── pagbank-webhook.js
│       └── admin-login.js
├── netlify.toml
├── .env.example
└── README.md
```

---

## Firebase

`https://copa-presida-default-rtdb.firebaseio.com/presida_v2.json`

## Organização

Complexo Presida · Taguatinga Norte · @complexopresida  
WhatsApp org: (61) 99594-5367
