# Deploy rápido — Copa Presida

## 1. Repositório
https://github.com/opkzin177/copa-presida

## 2. Netlify
1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Conecte o GitHub e escolha `opkzin177/copa-presida`
3. Build settings (já no `netlify.toml`):
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
4. **Environment variables** (Site settings):
   | Variável | Exemplo |
   |----------|---------|
   | `ADMIN_USER` | `copa5` |
   | `ADMIN_PASS` | senha forte |
   | `PAGBANK_TOKEN` | (opcional) token API PagBank |
   | `PAGBANK_ENV` | `sandbox` ou `production` |

## 3. Arquivo principal
O `public/index.html` completo (com formulário, PIX, cartão e painel) está no anexo original do projeto.

Se o arquivo no GitHub estiver como placeholder, faça upload do HTML completo:
- Via interface do GitHub: `public/index.html` → Edit → colar o HTML completo
- Ou localmente:
```bash
git clone https://github.com/opkzin177/copa-presida.git
cp /caminho/para/Copa-Presida.html public/index.html
git add public/index.html && git commit -m "site completo" && git push
```

## 4. Valores de pagamento (já definidos)
- **Padrão:** PIX R$ 350 · Cartão R$ 385
- **Convidados:** PIX R$ 600 · Cartão R$ 660

## 5. Login admin
Clique 5× no logo, ou `Ctrl+Shift+K`, ou acesse `?painel=1`.

## 6. Teste local
```bash
npm i -g netlify-cli
netlify dev
```
