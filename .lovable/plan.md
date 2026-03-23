

## Plan: Sincronizar Avatares dos Drawers com o Padrão da Aba Família

### O que muda

Os avatares nos Drawers de seleção de familiar (Acesso Rápido e "Minha Saúde") devem adotar o estilo da aba Família:

- **De:** `bg-[#A7D3CB] border-2 border-[#A7D3CB]` + `text-white font-medium`
- **Para:** `bg-secondary/20 border-2 border-secondary` + `text-secondary font-bold`

### Arquivos afetados

1. **`src/pages/Home.tsx`** — Drawer de Acesso Rápido (Consultas, Exames, Medicamentos)
   - Trocar a `div` circular do avatar para usar `bg-secondary/20 border-2 border-secondary`
   - Trocar o `span` das iniciais para `text-secondary font-bold`

2. **`src/components/BottomNav.tsx`** — Drawer "De quem você deseja ver?" (Minha Saúde)
   - Mesma substituição de classes no avatar e iniciais

### O que NÃO muda

- Nome em `text-black font-semibold`
- Parentesco em `text-muted-foreground`
- Ordenação hierárquica (Titular, Cônjuge, Filho(a)...)
- Avatar da própria aba Família (`src/pages/Familia.tsx`)

