# ContaMZ

Ferramenta web (PWA) em português de Moçambique (`pt-MZ`) para ajudar pequenos negócios a registar vendas e despesas, simular IVA incluído (16% ou isento) e organizar movimentos localmente com funcionamento offline.

## Estrutura do projeto

Os ficheiros publicáveis estão na pasta `contamz-site/`:

- `index.html` — Página inicial com simulador interativo de IVA e roadmap.
- `app.html` / `app.js` — Aplicação de registo, edição, pesquisa, filtros, pré-visualização de IVA e armazenamento em `localStorage`.
- `styles.css` — Estilos responsivos com contraste WCAG AA e suporte a movimento reduzido.
- `manifest.webmanifest`, `sw.js`, `pwa.js`, `icons/` — Suporte PWA (instalável e offline).
- `robots.txt`, `sitemap.xml` — Indexação para motores de busca.
- `vercel.json` / `netlify.toml` — Configurações de publicação e cabeçalhos HTTP.

## Publicar no GitHub e Vercel

1. Crie um repositório no GitHub e faça push deste projeto.
2. Na Vercel, importe o repositório e defina **Root Directory** como `contamz-site` (sem comando de build, pois é um site estático).
3. Após o primeiro deploy, caso o seu endereço seja diferente de `https://usecontamz.vercel.app`, atualize o domínio em:
   - `contamz-site/sitemap.xml`
   - `contamz-site/robots.txt`
   - `<link rel="canonical">` e `og:url` / `og:image` em `contamz-site/index.html` e `contamz-site/app.html` (recomendado usar URLs absolutos no Open Graph para WhatsApp/Facebook).
