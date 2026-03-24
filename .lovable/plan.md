

## Plan: Substituir logo do coração pela logo Locus Vita na tela de Login

**Arquivo:** `src/pages/Login.tsx`

### Mudanças:

1. **Copiar a imagem** do upload para `src/assets/locus-vita-logo.jpeg`

2. **Atualizar `src/pages/Login.tsx`:**
   - Remover o import do `Heart` (se não usado em outro lugar)
   - Adicionar `import locusvitaLogo from "@/assets/locus-vita-logo.jpeg"`
   - Substituir o bloco do logo (linhas 46-51) — remover o quadrado verde com coração e colocar a imagem da logo:

```tsx
<div className="flex flex-col items-center mb-12">
  <img src={locusvitaLogo} alt="Locus Vita" className="w-40 h-40 object-contain mb-4" />
  <p className="text-muted-foreground text-sm mt-1">Saúde familiar simplificada</p>
</div>
```

   - O título "Locus Vita" em texto será removido pois a logo já contém o nome
   - A tagline "Saúde familiar simplificada" permanece

