

## Plano: Usar CARREGAMENTO_INICIAL.svg no splash pós-login (um pouco maior)

### O que muda

1. **Copiar asset**: `user-uploads://CARREGAMENTO_INICIAL.svg` → `public/logo-carregamento.svg`

2. **Atualizar 3 arquivos** — trocar a referência da logo nos splash/loading screens:

   - **`src/App.tsx`** (linha 99): `/logo-locus-vita.svg?v=2` → `/logo-carregamento.svg` e classe `w-32 h-32` → `w-40 h-40`
   - **`src/components/InviteAcceptInterceptor.tsx`** (linha 266): mesma troca, `w-40 h-40`
   - **`src/components/AdminRoute.tsx`** (linha 35): mesma troca, `w-40 h-40`

3. **Não alterar**: Login, Cadastro, Reset, PDF, CommandCenter, notificações — ficam como estão.

### Resultado
Splash de carregamento pós-login exibirá a `CARREGAMENTO_INICIAL.svg` em tamanho `w-40 h-40` (10rem × 10rem, ~25% maior que antes) com a animação breathing mantida.

