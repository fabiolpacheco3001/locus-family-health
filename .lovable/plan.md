

## Plano: Ajuste de Copy das Notificações de Tratamento

### Problema
O formato atual da mensagem é:
> "Registro de tratamento com Amoxicilina realizado.\nInício: 21/03/2026 às 23:30 | Término: 28/03/2026 às 23:30"

O formato desejado é:
> "Medicamento: Amoxicilina\nInício: 21/03/2026 às 23:30\nTérmino: 28/03/2026 às 23:30"

### Alterações

#### 1. `src/components/AddMedicationDrawer.tsx` (linhas 162-168)
Alterar a construção da mensagem para o novo formato:
```tsx
let msgParts = `Medicamento: ${name.trim()}`;
if (startStr) {
  msgParts += `\nInício: ${startStr}${timeStr ? ` às ${timeStr}` : ""}`;
}
if (endStr) {
  msgParts += `\nTérmino: ${endStr}${timeStr ? ` às ${timeStr}` : ""}`;
}
```

#### 2. Atualizar notificações existentes no banco
Executar UPDATE via insert tool para corrigir as notificações já gravadas, reformatando a mensagem de "Registro de tratamento com X realizado.\nInício: ... | Término: ..." para "Medicamento: X\nInício: ...\nTérmino: ...".

### Sem alteração
- Layout do card em `Notificacoes.tsx` — já faz `split("\n")` e renderiza cada linha como `<p>`, funciona perfeitamente com o novo formato.
- Timestamp — sem alteração.

