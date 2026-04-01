

## Plano: Usar PNG com bordas arredondadas na tela de Login

### Alterações

1. **Copiar asset**: `user-uploads://Logo_Locus_Vita-2.png` → `src/assets/locus-vita-logo-login.png`

2. **Alterar `src/pages/Login.tsx`**:
   - Trocar o import da logo: `import locusvitaLogo from "@/assets/locus-vita-logo-login.png"`
   - Na linha 173, adicionar classes de arredondamento e sombra à tag `<img>`:
     ```
     className="h-32 w-32 object-cover rounded-3xl shadow-md mb-4"
     ```
   - Mesma alteração na logo da view "forgot" (linha ~135) para consistência

3. **Sem alterações** em Cadastro, Reset, PDF ou qualquer outra tela.

