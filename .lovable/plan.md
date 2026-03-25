

# Plano: Corrigir Toast Repetitivo de Permissão de Notificação

## Problema
O toast "Ative as notificações..." aparece repetidamente porque o `useEffect` que verifica permissões roda a cada montagem do hook. Como `useMedicationAlarms` é chamado no `AppLayout`, qualquer re-render (navegação, atualização de dados) pode re-disparar o aviso.

## Solução
Adicionar uma flag global (fora do componente) que garante que o toast só seja exibido **uma única vez por sessão do app**.

## Alteração

**Arquivo:** `src/hooks/useMedicationAlarms.ts`

1. Criar uma variável de módulo `let permissionToastShown = false` fora do hook.
2. Nos dois locais onde o `toast.warning` é chamado (linhas 30 e 36), envolver com `if (!permissionToastShown)` e setar `permissionToastShown = true` após o disparo.

Resultado: o aviso aparece no máximo 1 vez por sessão, independente de quantas vezes o componente re-renderize.

