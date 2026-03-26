

# Desativar Confirmação de E-mail no Cadastro

## O que será feito

Usar a ferramenta `cloud--configure_auth` para ativar o **auto-confirm** de e-mail, fazendo com que novos usuários possam acessar o app imediatamente após o cadastro, sem precisar verificar o e-mail.

## Mudança no código

No `Login.tsx`, remover a mensagem de sucesso que pede para verificar o e-mail e redirecionar direto para `/home` após o cadastro.

## Impacto

- Novos usuários entram direto no app ao criar conta
- Convites ficam mais fluidos (o convidado cria a conta e já cai no `InviteAcceptInterceptor`)
- Tradeoff: qualquer e-mail pode ser usado sem validação de propriedade

