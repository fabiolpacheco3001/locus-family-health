

## Diagnóstico

O código de **geração** de notificações (`AddMedicationDrawer.tsx` linhas 147-177) já está correto — ele busca o nome do familiar e monta o título como `"Novo Tratamento de {memberName}"` com a mensagem em múltiplas linhas. O código de **renderização** (`Notificacoes.tsx`) também já faz `split("\n")` e aplica os alinhamentos corretos.

**O problema:** as notificações visíveis na screenshot foram criadas **antes** da atualização do código — elas estão gravadas no banco com o título antigo ("Novo Tratamento Iniciado") e a mensagem em formato simples, sem `\n`. Nenhuma alteração de código no frontend vai mudar o que já está gravado.

## Plano

### 1. Corrigir as notificações existentes no banco de dados

Executar uma migration SQL para atualizar as notificações existentes que ainda possuem o título antigo, preenchendo-as com os dados corretos extraídos das tabelas `medications` e `family_members`:

```sql
UPDATE notifications n
SET 
  title = 'Novo Tratamento de ' || COALESCE(fm.name, 'Familiar'),
  message = 'Registro de tratamento com ' || COALESCE(m.name, 'medicamento') || ' realizado.' ||
    E'\n' || 'Início: ' || COALESCE(TO_CHAR(m.start_date::date, 'DD/MM/YYYY'), '---') || 
    CASE WHEN m.start_time IS NOT NULL THEN ' às ' || LEFT(m.start_time, 5) ELSE '' END ||
    CASE WHEN m.end_date IS NOT NULL THEN ' | Término: ' || TO_CHAR(m.end_date::date, 'DD/MM/YYYY') || 
      CASE WHEN m.start_time IS NOT NULL THEN ' às ' || LEFT(m.start_time, 5) ELSE '' END
    ELSE '' END
FROM medications m
JOIN family_members fm ON fm.id = n.family_member_id
WHERE n.type = 'medication'
  AND n.title LIKE 'Novo Tratamento%'
  AND m.family_member_id = n.family_member_id
  AND m.user_id = n.user_id;
```

### 2. Verificar que novas notificações continuam sendo geradas corretamente

O código em `AddMedicationDrawer.tsx` já está correto — nenhuma alteração de frontend necessária.

### Resultado esperado

As notificações existentes passarão a exibir:
- **Título:** "Novo Tratamento de Livia" (centralizado)
- **Linha 1:** "Registro de tratamento com Nasonex realizado."
- **Linha 2:** "Início: 23/03/2026 às 18:00 | Término: 02/04/2026 às 18:00"
- **Rodapé:** "23 mar · 18:12" (à direita) — já funciona

