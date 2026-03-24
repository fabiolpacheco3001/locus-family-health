

## Plan: Usar a logo Locus Vita como ícone do PWA

**Objetivo:** Substituir os ícones genéricos do PWA (icon-192.png, icon-512.png, favicon) pela logo SVG da Locus Vita enviada.

### Abordagem

O SVG será copiado para a pasta `public/` e adicionado ao `manifest.json` como ícone SVG. Além disso, será gerado um PNG a partir do SVG via script para garantir compatibilidade com iOS (Safari não suporta SVG como `apple-touch-icon`) e navegadores mais antigos.

### Alterações

**1. Copiar o SVG para o projeto**
- `user-uploads://Logo_Locus_Vita.svg` → `public/logo-locus-vita.svg`

**2. Gerar PNGs 192x192 e 512x512 a partir do SVG**
- Usar script com `sharp` ou `resvg` para converter o SVG em `public/icon-192.png` e `public/icon-512.png` (sobrescrevendo os atuais)

**3. Atualizar `public/manifest.json`**
- Adicionar entrada SVG com `"type": "image/svg+xml"` e `"purpose": "any"`
- Manter as entradas PNG (agora com a nova logo)
- Atualizar `background_color` para `#f2f0eb` (consistente com o fundo do app)

**4. Atualizar `index.html`**
- Trocar o favicon para apontar ao SVG: `<link rel="icon" href="/logo-locus-vita.svg" type="image/svg+xml">`
- Manter o `apple-touch-icon` apontando para o PNG 192px (compatibilidade iOS)

### Limitação
- A conversão SVG→PNG será feita via script no build. Se a qualidade não ficar ideal, o usuário pode fornecer PNGs prontos nos tamanhos 192x192 e 512x512.

