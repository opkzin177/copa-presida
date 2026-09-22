# Copa Presida de Futevôlei — 5ª Etapa

Site de inscrições com:

- Programação por dia/categoria
- Formulário de dupla
- **PIX** (QR + Copia e Cola) e **Cartão PagBank**
- Valores fixos:
  - Categorias padrão → PIX **R$ 350** · Cartão **R$ 385**
  - Convidados → PIX **R$ 600** · Cartão **R$ 660**
- Área restrita (admin) com KPIs, discos e lista por categoria
- Backend em **Netlify Functions** para checkout dinâmico e login

## Deploy no Netlify (recomendado)

1. Conecte este repositório no [Netlify](https://app.netlify.com).
2. Build settings (já no `netlify.toml`):
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
3. Em **Site settings → Environment variables** configure:
   - `ADMIN_USER` / `ADMIN_PASS` (login do painel)
   - `PAGBANK_TOKEN` + `PAGBANK_ENV` (opcional — se vazio, usa os links pag.ae já existentes)
4. Deploy. URL de exemplo: `https://seu-site.netlify.app`

### Login admin

- Clique 5× no logo **P Complexo Presida** (ou `Ctrl+Shift+K`, ou `?painel=1`).
- Usuário/senha: os valores de `ADMIN_USER` / `ADMIN_PASS` (padrão local: `copa5` / `presida2026`).

### Pagamento

| Método | Fluxo |
|--------|--------|
| **PIX** | QR + payload estático Santander (Welber Francisco Rodrigue). Confirmação com titular + CPF. |
| **Cartão** | Chama `/.netlify/functions/pagbank-checkout`. Com token PagBank → checkout dinâmico. Sem token → link estático `pag.ae`. |

## Desenvolvimento local

```bash
# com Netlify CLI
npm i -g netlify-cli
netlify dev
```

Abre em `http://localhost:8888`.

## Estrutura

```
copa-presida/
├── public/
│   └── index.html          # site completo
├── netlify/
│   └── functions/
│       ├── pagbank-checkout.js
│       └── admin-login.js
├── netlify.toml
├── .env.example
└── README.md
```

## Firebase

Os dados de inscrição ficam em:

`https://copa-presida-default-rtdb.firebaseio.com/presida_v2.json`

(leitura/escrita pública controlada pelo front — em produção considere regras de segurança e Auth).

## Organização

Complexo Presida · Taguatinga Norte · @complexopresida  
WhatsApp org: (61) 99594-5367
