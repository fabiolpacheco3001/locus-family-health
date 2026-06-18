## Re-deploy de todas as Edge Functions

### Objetivo
Re-deployar todas as 12 Edge Functions do projeto Locus Vita para garantir que as versões mais recentes do código estejam ativas no ambiente Lovable Cloud.

### Edge Functions a serem deployadas
1. analyze-exam
2. analyze-prescription
3. asaas-webhook
4. cancel-asaas-subscription
5. create-asaas-checkout
6. delete-user-account
7. manage-admins
8. process-email-queue
9. publish-changelog
10. search-meds
11. webauthn-challenge
12. webauthn-verify

### Validação pós-deploy
- Verificar logs de cada função para confirmar deploy bem-sucedido
- Testar chamada CORS (OPTIONS + POST) em uma função crítica (ex: analyze-prescription) para confirmar que o preflight não está sendo rejeitado
