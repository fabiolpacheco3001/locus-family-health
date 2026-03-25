

## Diagnóstico: Por que o alarme das 02:16h não disparou

Identifiquei **3 problemas críticos** na implementação atual:

### Problema 1: Hook só roda na página Home
O `useMedicationAlarms()` está chamado **apenas** dentro do componente `Home.tsx`. Quando o usuário navega para qualquer outra tela (Família, Agenda, Medicamentos, etc.), o hook é desmontado e o `setInterval` para de rodar. Se às 02:16h o usuário não estava exatamente na tela Home, o alarme nunca disparou.

### Problema 2: App fechado/tela bloqueada = sem verificação
O `setInterval` do JavaScript **não roda** quando o navegador está em segundo plano, minimizado ou com a tela do celular bloqueada. Às 02:16h da manhã, é quase certo que o app não estava ativo.

### Problema 3: Dedup key sem data
A chave de deduplicação usa `${med.id}-${hora}:${minuto}` sem incluir a data. Se o alarme já disparou uma vez para aquele horário em outro dia, ele não dispara novamente até o Set ser limpo (>500 entradas).

---

## Plano de Correção

### 1. Mover o hook para o AppLayout (global)
Mover `useMedicationAlarms()` de `Home.tsx` para `AppLayout.tsx`, garantindo que rode em **qualquer página** autenticada.

### 2. Incluir data na chave de deduplicação
Alterar a key para `${med.id}-${YYYY-MM-DD}-${HH}:${MM}` para que o mesmo horário em dias diferentes dispare normalmente.

### 3. Verificação ao retomar o app (visibilitychange)
Adicionar um listener de `document.visibilitychange` que executa `checkAlarms()` imediatamente quando o usuário volta ao app. Isso cobre o cenário de tela bloqueada: ao abrir o celular, se a dose já passou mas foi perdida, o sistema dispara um alerta de "dose atrasada".

### 4. Alerta de dose atrasada
Quando o usuário volta ao app e a próxima dose calculada já passou (dentro de uma janela de tolerância de 30 minutos), disparar um toast de alerta: "Dose atrasada: [Medicamento] era às HH:MM".

---

### Detalhes Técnicos

**Arquivos a modificar:**
- `src/components/AppLayout.tsx` — importar e chamar `useMedicationAlarms()`
- `src/pages/Home.tsx` — remover chamada do hook
- `src/hooks/useMedicationAlarms.ts` — corrigir dedup key, adicionar `visibilitychange` listener, adicionar lógica de dose atrasada

**Dedup key corrigida:**
```text
`${med.id}-${now.toISOString().slice(0,10)}-${doseH}:${doseM}`
```

**Listener de visibilidade:**
```text
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkAlarms();
});
```

**Dose atrasada:** Ao retornar ao app, verificar se `nextDose` está no passado (até 30min atrás). Se sim, disparar toast warning em vez de toast error.

