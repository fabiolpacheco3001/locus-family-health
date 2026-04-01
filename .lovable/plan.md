

## Plano: Usar PNG da logo no PDF do Prontuário

### Problema
O `jsPDF` não renderiza SVG — apenas formatos raster (PNG/JPEG). Atualmente o código carrega um SVG, resultando num quadrado branco.

### Solução
1. **Copiar** o arquivo `Logo_Locus_Vita.png` enviado para `public/logo-locus-vita-pdf.png`
2. **Alterar** `src/pages/Prontuario.tsx` (linhas 51-59): trocar o fetch de `/logo-locus-vita.svg?v=2` para `/logo-locus-vita-pdf.png`
3. **Nenhuma** alteração em `generateProntuarioPdf.ts` — o código já usa `doc.addImage(..., "PNG", ...)` corretamente

### Resultado
A logo PNG (com fundo branco, compatível com jsPDF) aparecerá no cabeçalho verde do PDF, legível e sem quadrado em branco.

