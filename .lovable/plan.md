

## Plano: Substituir logo do PDF pelo ícone oficial enviado

### O que muda
O PDF do Prontuário atualmente usa `/logo-locus-vita.svg` no cabeçalho. Vamos substituir pela imagem enviada (heartbeat + coração).

### Passos

1. **Copiar a imagem** do upload para `public/logo-locus-vita-icon.jpeg` (o projeto já tem esse arquivo referenciado no branding).

2. **Atualizar `Prontuario.tsx`** — alterar o `fetch` do logo de `/logo-locus-vita.svg` para `/logo-locus-vita-icon.jpeg`.

3. **Atualizar `generateProntuarioPdf.ts`** — trocar o formato da imagem no `addImage` de `"PNG"` para `"JPEG"`, já que o arquivo é JPEG.

### Arquivos alterados
- `public/logo-locus-vita-icon.jpeg` (cópia do upload)
- `src/pages/Prontuario.tsx` (path do fetch)
- `src/lib/generateProntuarioPdf.ts` (formato da imagem)

Correção cirúrgica, sem impacto visual na UI — apenas no PDF exportado.

