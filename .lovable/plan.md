

## Plan: Arredondar bordas da logo no Login

**Arquivo:** `src/pages/Login.tsx` (linha 48)

**Mudança:** Adicionar `rounded-3xl` e um leve `shadow-md` à imagem para criar um efeito elegante de moldura com cantos arredondados.

```tsx
// De:
<img src={locusvitaLogo} alt="Locus Vita" className="w-40 h-40 object-contain mb-4" />

// Para:
<img src={locusvitaLogo} alt="Locus Vita" className="w-40 h-40 object-cover rounded-3xl shadow-md mb-4" />
```

- `rounded-3xl` — cantos bem arredondados (24px)
- `shadow-md` — sombra sutil que destaca a logo do fundo
- `object-cover` — garante preenchimento uniforme sem distorção

