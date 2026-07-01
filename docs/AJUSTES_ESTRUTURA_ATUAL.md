# Locus Vita — Estrutura Atual da Tela de Ajustes

> **Documento gerado em:** 30/06/2026
> **Finalidade:** Briefing para o PM elaborar a SPEC de Login Social. Mapeia a estrutura real da tela de Ajustes e todos os sub-menus implementados.

---

## Visão Geral da Navegação

```
/ajustes  (Ajustes.tsx)
├── Card de Perfil
├── Card de Assinatura  ← condicional por papel + status da assinatura
├── Menu Principal (6 itens)
│   ├── /meus-dados           → MeusDados.tsx
│   ├── /gerenciar-familia    → GerenciarFamilia.tsx
│   ├── /ajustes/seguranca    → AjustesSeguranca.tsx (sub-menu)
│   │   ├── /seguranca-conta  → Seguranca.tsx
│   │   └── /gestao-acessos  → GestaoAcessos.tsx  [adminOnly]
│   ├── /notificacoes         → Notificacoes.tsx
│   ├── /ajustes/conformidade → AjustesConformidade.tsx (sub-menu)
│   │   ├── /politica-de-privacidade → PoliticaPrivacidade.tsx
│   │   ├── [ação] Exportar Meus Dados (download JSON inline)
│   │   ├── [ação] Revogar Consentimento (dialog de confirmação)
│   │   └── [ação] Excluir Conta (dialog com reautenticação)
│   └── /ajustes/suporte      → AjustesSuporte.tsx (sub-menu)
│       ├── /ajuda            → Ajuda.tsx
│       ├── [ação] Fale Conosco (URL externa ou mailto:)
│       └── /changelog        → Changelog.tsx
└── Botão "Sair da conta"
```

---

## 1. Tela Principal — `/ajustes`

**Arquivo:** `src/pages/Ajustes.tsx`
**Rota:** `/ajustes` (protegida, dentro de `AppLayout`)

### 1.1 Card de Perfil

Exibido no topo, sempre visível. Mostra:
- Avatar do perfil vinculado ao usuário logado
- Nome completo
- Parentesco (ex: "Cônjuge", "Filho(a)")

Dados obtidos via `useFamilyMembers()` + `useFamilyGroup().linkedMemberId`.

### 1.2 Card de Assinatura

Condicional por **papel RBAC** (`useFamilyGroup().isAdmin`) e **status da assinatura** (`useSubscription()`):

| Cenário | Visual | Ações Disponíveis |
|---------|--------|------------------|
| Admin — plano ativo (mensal ou anual) | Gradiente Azul+Verde, preço e próximo pagamento | Botão "Gerenciar Assinatura" → `/meu-plano` |
| Admin — pagamento pendente (past due) | Gradiente vermelho | Botão "Regularizar Pagamento" (abre checkout Asaas) |
| Admin — cancelado em grace period | Gradiente cinza, exibe "Acesso válido até [data]" | Botão "Ver Meu Plano" → `/meu-plano` |
| Admin — plano grátis (sem subscription) | Gradiente Azul claro, contador de dias restantes | Botão "Assinar Agora" (abre PaywallModal) |
| Admin — trial expirado | Gradiente cinza, mensagem de expiração | Botão "Assinar Agora" (abre PaywallModal) |
| Usuário não-admin (convidado) | Gradiente Azul+Verde, texto informativo | Nenhuma ação — apenas informa que o plano é do admin |

> **Nota para o PM:** O card de assinatura é visível **somente ao admin do grupo**. Usuários convidados veem um card estático informando que o acesso é via plano do administrador. Isso é relevante para o Login Social: um usuário que entra via Google como não-admin não vê nem acessa o fluxo de pagamento.

### 1.3 Menu Principal — 6 Itens

| # | Ícone | Label | Rota Destino |
|---|-------|-------|-------------|
| 1 | `User` | Meus Dados | `/meus-dados` |
| 2 | `Users` | Gerenciar Família | `/gerenciar-familia` |
| 3 | `Shield` | Segurança | `/ajustes/seguranca` |
| 4 | `Bell` | Notificações | `/notificacoes` |
| 5 | `Scale` | Conformidade | `/ajustes/conformidade` |
| 6 | `HelpCircle` | Suporte | `/ajustes/suporte` |

Todos os itens passam `state: { from: "/ajustes" }` no navigate para o back button funcionar corretamente.

### 1.4 Botão Sair

Botão de logout no rodapé da tela. Chama `signOut()` do `useAuth()` e redireciona para `/login`.

---

## 2. Sub-menu Segurança — `/ajustes/seguranca`

**Arquivo:** `src/pages/AjustesSeguranca.tsx`

| # | Ícone | Label | Rota Destino | Visibilidade |
|---|-------|-------|-------------|-------------|
| 1 | `Lock` | Senha e Biometria | `/seguranca-conta` | Todos os usuários |
| 2 | `UserCog` | Gestão de Acessos | `/gestao-acessos` | **adminOnly** |

> **Nota para o PM:** "Gestão de Acessos" só aparece para usuários com papel `admin` no grupo familiar. Usuários convidados que entram via Google não verão este item.

---

## 3. Senha e Biometria — `/seguranca-conta`

**Arquivo:** `src/pages/Seguranca.tsx`

Tela com dois blocos funcionais:

### 3.1 Biometria (BK-02 — WebAuthn/Passkeys)
- Toggle para habilitar/desabilitar Face ID / Touch ID / biometria
- Usa FIDO2/WebAuthn via edge functions (`webauthn-challenge` + `webauthn-verify`)
- Exibe data de cadastro da passkey quando ativa
- Detecta automaticamente se o browser suporta WebAuthn (`browserSupportsWebAuthn()`)
- Ao ativar: toast orientando a selecionar "Senhas" (iCloud Keychain) no picker iOS

### 3.2 Alterar Senha (A2)
- Campos: Senha Atual, Nova Senha (mín. 8 caracteres), Confirmar Nova Senha
- Valida senha atual via `supabase.auth.signInWithPassword` antes de atualizar
- Botão com spinner durante `isPending`

> **Nota para o PM — gap de Login Social:** Atualmente não há indicador de provedor de login nesta tela. Um usuário que entrou via Google não tem senha no Supabase, então o bloco "Alterar Senha" seria irrelevante (ou causaria erro) para ele. Esta é uma área que a SPEC de Login Social precisará endereçar.

---

## 4. Gestão de Acessos — `/gestao-acessos` [adminOnly]

**Arquivo:** `src/pages/GestaoAcessos.tsx`
**Acesso:** somente usuários com `role = 'admin'` no grupo familiar

### 4.1 Lista de Membros Ativos
- Cada membro exibe: avatar, nome, parentesco, badge de papel (Admin / Usuário)
- Ao tocar (exceto no próprio usuário): abre Drawer de Permissões
- Botão de lixeira: remove acesso do membro (confirmação via AlertDialog)

### 4.2 Lista de Convites Pendentes
- Exibida somente quando há convites não aceitos
- Cada convite: e-mail, perfil vinculado (ou "Acesso total"), badge de papel, botão de reenvio, botão de exclusão
- Reenvio chama edge function `send-invite-email`

### 4.3 FAB — Convidar Pessoa
- Abre Drawer de convite com:
  - Campo e-mail do convidado
  - Selector de perfil vinculado (opcional; filtra pets e perfis já vinculados)
  - Convidados sempre entram como `role = 'user'` (DB enforça)
- Após envio bem-sucedido: tela de confirmação no drawer com opções "Avisar pelo WhatsApp" e "Copiar Mensagem"

### 4.4 Drawer de Permissões (por membro)
- Seção "Papel no Grupo": botão para Promover a Admin ou Rebaixar a Usuário
- Seção "Perfis que pode gerenciar" (apenas para role=user):
  - Switches por perfil da família
  - Perfil principal do membro é fixo (não pode desmarcar)
- Botão "Salvar Permissões"

### 4.5 Dialog de Informação
- Botão `Info` no header abre dialog explicando os níveis de acesso (Admin × Usuário)

---

## 5. Meus Dados — `/meus-dados`

**Arquivo:** `src/pages/MeusDados.tsx`

Formulário de edição do perfil do usuário logado.

### Campos disponíveis

| Campo | Tipo | Editável | Obs. |
|-------|------|----------|------|
| Foto / Avatar | AvatarSelector | ✅ | Emoji ou URL de imagem |
| Badge de papel | readonly | — | "Admin" ou "Usuário Convidado" |
| Nome Completo | text input | ✅ | Obrigatório |
| E-mail | text input | ❌ readonly | E-mail de login — não editável aqui |
| Parentesco | select | ✅ | Cônjuge, Filho(a), Pai/Mãe, Irmão(ã), Outros |
| Data de Nascimento | CustomDateTimePicker | ✅ | |
| Gênero | select | ✅ | Masculino, Feminino, Outro, Prefiro não informar |
| Tipo Sanguíneo | select | ✅ | A+, A-, B+, B-, AB+, AB-, O+, O- |
| CPF | text masked | ✅ | 000.000.000-00 |
| Telefone | tel masked | ✅ | (11) 99999-9999 |
| CEP | text masked | ✅ | Para cobrança com cartão; busca via ViaCEP |
| Número | text | ✅ | Complementa o CEP |

> **Nota para o PM — gap crítico de Login Social:** O campo e-mail é exibido como readonly com o texto "Este é seu e-mail de login e não pode ser alterado aqui." Não há nenhum indicador de **qual provedor** foi usado para criar a conta (Google, Apple ou e-mail/senha). Após a implementação do Login Social, esta tela precisará exibir: "Conta vinculada ao Google" ou similar, e possivelmente a opção de vincular/desvincular provedores. As APIs já existem em `useAuth`: `getUserIdentities()`, `linkIdentity()`, `unlinkIdentity()`.

---

## 6. Conformidade — `/ajustes/conformidade`

**Arquivo:** `src/pages/AjustesConformidade.tsx`

| # | Ícone | Label | Sublabel (LGPD) | Comportamento |
|---|-------|-------|----------------|--------------|
| 1 | `FileText` | Política de Privacidade | — | Navega para `/politica-de-privacidade` |
| 2 | `Download` | Exportar Meus Dados | LGPD Art. 18-V — portabilidade | Download inline de JSON com todos os dados clínicos do grupo |
| 3 | `ShieldOff` | Revogar Consentimento | LGPD Art. 18-IX — revogação | Dialog de confirmação → insere registro em `consent_log` |
| 4 | `Trash2` | Excluir Conta | — | Dialog com reautenticação (senha ou passkey) → edge function `delete-user-account` |

### Exportar Meus Dados (item 2)
Gera e faz download de arquivo JSON com:
- Dados da conta (userId, e-mail)
- Membros da família (nome, nascimento, gênero, etc.)
- Dados clínicos: medicamentos, consultas, exames, vacinas, alergias, doenças, medições de saúde, pressão arterial, ciclos menstruais, rotinas pet
- Histórico de consentimentos

### Excluir Conta (item 4 — RX-01)
- Se usuário tem passkey cadastrada: solicita autenticação biométrica
- Se não tem passkey: solicita senha atual
- Confirma e chama `delete-user-account` edge function
- Redireciona para `/login` após exclusão

---

## 7. Suporte — `/ajustes/suporte`

**Arquivo:** `src/pages/AjustesSuporte.tsx`

| # | Ícone | Label | Comportamento |
|---|-------|-------|--------------|
| 1 | `HelpCircle` | Dúvidas Frequentes | Navega para `/ajuda` |
| 2 | `MessageCircle` | Fale Conosco | Abre `support_url` (tabela `system_configs`) em nova aba; fallback `mailto:suporte@locustech.com.br` |
| 3 | `Sparkles` | Novidade Locus Vita | Navega para `/changelog` |

A URL de suporte é configurável via tabela `system_configs` (chaves `support_url` e `support_email`), sem necessidade de novo deploy.

---

## 8. Rotas Relacionadas a Ajustes (App.tsx)

```
Públicas (sem auth):
  /politica-de-privacidade  → PoliticaPrivacidade.tsx
  /termos-de-uso            → TermosUso.tsx
  /seguranca                → SegurancaInfo.tsx  ← página pública de controles de segurança

Protegidas (dentro de AppLayout):
  /ajustes                  → Ajustes.tsx
  /meus-dados               → MeusDados.tsx
  /gerenciar-familia        → GerenciarFamilia.tsx
  /notificacoes             → Notificacoes.tsx
  /seguranca-conta          → Seguranca.tsx  (senha + biometria)
  /meu-plano                → MeuPlano.tsx
  /gestao-acessos           → GestaoAcessos.tsx
  /ajustes/seguranca        → AjustesSeguranca.tsx
  /ajustes/conformidade     → AjustesConformidade.tsx
  /ajustes/suporte          → AjustesSuporte.tsx
  /ajuda                    → Ajuda.tsx
  /changelog                → Changelog.tsx
```

---

## 9. Gaps Identificados para a SPEC de Login Social

Esta seção resume os pontos específicos da tela de Ajustes que precisarão ser endereçados pela SPEC de Login Social:

### GAP-1 — Sem indicador de provedor em Meus Dados (`/meus-dados`)
**Situação atual:** O e-mail é exibido como campo readonly, sem informar como a conta foi criada.
**O que falta:** Exibir o provedor de autenticação (ex: "Conta Google", "Conta Apple" ou "E-mail e senha"). As APIs já existem (`getUserIdentities()`).

### GAP-2 — Fluxo "Alterar Senha" inadequado para usuários OAuth
**Situação atual:** A tela `/seguranca-conta` exibe campos de senha para todos os usuários.
**O que falta:** Para usuários Google/Apple (sem senha Supabase), ocultar ou desabilitar o bloco de alteração de senha e exibir uma mensagem adequada.

### GAP-3 — Sem opção de vincular/desvincular provedor em `/seguranca-conta`
**Situação atual:** A tela de segurança gerencia apenas biometria e senha.
**O que falta (futuro):** Permitir que um usuário e-mail/senha vincule sua conta Google, ou que um usuário Google adicione senha. As APIs `linkIdentity()` e `unlinkIdentity()` já existem em `useAuth`.

### GAP-4 — Fluxo de reautenticação em Excluir Conta (`/ajustes/conformidade`)
**Situação atual:** Reautenticação solicita senha (ou passkey). Usuários Google não têm senha.
**O que falta:** Para usuários Google, a reautenticação de exclusão de conta deve usar re-autenticação OAuth (`supabase.auth.reauthenticate()` via Google).

### GAP-5 — Sem Login Social nas telas de Login e Cadastro (já implementado em produção)
A SPEC deve confirmar que os botões "Continuar com Google" e "Apple (Em Breve)" já estão presentes nas telas `/login` e `/cadastro` via `SocialLoginButtons.tsx`.

---

## Apêndice — Componentes Técnicos Relevantes

| Hook/Componente | Responsabilidade |
|-----------------|-----------------|
| `useAuth.tsx` | Sessão, `signInWithGoogle()`, `signInWithApple()`, `getUserIdentities()`, `linkIdentity()`, `unlinkIdentity()` |
| `useFamilyGroup.tsx` | `isAdmin`, `role`, `linkedMemberId`, `groupId` — fonte de verdade do RBAC |
| `useSubscription.tsx` | `isActive`, `isPastDue`, `isCanceled`, `canceledButGracePeriod`, `trialDaysLeft` |
| `usePasskeys.tsx` | `passkeys[]`, `register`, `remove` — gestão de WebAuthn |
| `SocialLoginButtons.tsx` | Botões Google e Apple para Login e Cadastro |
| `PaywallModal.tsx` | Modal de assinatura acionado pelo card de plano grátis |
| `AuthCallback.tsx` | Callback OAuth — processa SIGNED_IN, consentimento LGPD e tunnel de checkout |
| `SegurancaInfo.tsx` | Página pública `/seguranca` — documenta controles de segurança (sem auth) |
