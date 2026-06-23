# Runbook — Resposta a Incidentes de Segurança (LGPD Art. 48)

> **Controlador:** Locus Tech  
> **Encarregado (DPO):** Fábio — fabio@locustech.com.br  
> **Produto:** Locus Vita (vita.locustech.com.br)  
> **Base legal:** LGPD Art. 48 + Resolução CD/ANPD 4/2023  
> **Versão:** 1.0 | Criado em: junho/2026

---

## 1. Objetivo

Este runbook define o processo obrigatório de resposta a incidentes de segurança que envolvam dados pessoais tratados pelo Locus Vita, conforme exigido pelo Art. 48 da LGPD e pela Resolução CD/ANPD 4/2023.

**Prazo crítico:** A ANPD deve ser notificada em até **3 dias úteis** a partir do momento em que o controlador toma conhecimento do incidente.

---

## 2. O que Configura um Incidente

Qualquer evento que comprometa a **confidencialidade, integridade ou disponibilidade** de dados pessoais tratados pelo Locus Vita, incluindo:

- Acesso não autorizado ao banco de dados (Supabase)
- Vazamento de arquivos de exames ou receitas (buckets `exam-files`, `receitas`)
- Exposição de credenciais de usuários (tokens, senhas)
- Ransomware ou destruição de dados
- Exfiltração de dados via Edge Functions comprometidas
- Falha de RLS que exponha dados de outros grupos familiares
- Acesso indevido via conta administrativa comprometida

**Dados sensíveis envolvidos (atenção redobrada — Art. 11 LGPD):**
- Histórico de medicamentos, dosagens e aderência
- Consultas, exames e laudos médicos
- Vacinas e histórico de saúde
- Dados de pets e rotinas veterinárias
- Registros de pressão arterial, ciclo menstrual e medições

---

## 3. Classificação de Severidade

| Nível | Critério | Exemplos |
|-------|----------|---------|
| **P0 — Crítico** | Dados sensíveis de saúde expostos em massa; acesso não autorizado ativo; credenciais de service_role vazadas | Dump do banco acessível publicamente; ANPD_SERVICE_ROLE_KEY exposta no GitHub |
| **P1 — Alto** | Exposição de dados de grupo restrito; falha de RLS confirmada; arquivos médicos de usuários acessíveis a terceiros | Usuário conseguiu ver exames de outro grupo familiar |
| **P2 — Moderado** | Tentativa de acesso contida; suspeita sem confirmação; dados não-sensíveis expostos | Rate limit atingido em endpoint de autenticação; log com e-mail em texto plano |

---

## 4. Fluxo de Resposta

### Hora 0 — Detecção

Fontes de detecção:
- **Sentry** (vita.locustech.com.br) — erros e exceções em produção
- **Supabase Dashboard** → Database → Logs / Auth → Logs
- **GitHub** — alertas de Secret Scanning (credenciais commitadas)
- **Relato de usuário** — via fabio@locustech.com.br
- **Monitoramento manual** de queries suspeitas

**Ação imediata:** Registrar data/hora de conhecimento do incidente. Esse timestamp é o marco zero para o prazo de 3 dias úteis.

---

### Hora 0–2 — Contenção

#### P0 (Crítico)
- [ ] Revogar imediatamente as credenciais comprometidas no Supabase Dashboard
- [ ] Desabilitar Edge Functions afetadas (Supabase → Edge Functions → Pause)
- [ ] Ativar modo de manutenção se necessário (Supabase → Settings → Pause project)
- [ ] Revogar `SUPABASE_SERVICE_ROLE_KEY` e gerar nova chave
- [ ] Verificar e revogar todos os tokens Asaas, Gemini, Sentry afetados
- [ ] Isolar o vetor de ataque (desabilitar rota/função específica)

#### P1 (Alto)
- [ ] Identificar quais `group_id` ou `user_id` foram afetados
- [ ] Verificar logs de acesso no Supabase Auth → Logs
- [ ] Corrigir a falha de RLS ou permissão e re-deployar
- [ ] Revogar sessões ativas dos usuários afetados (Supabase Auth → Users → Delete sessions)

#### P2 (Moderado)
- [ ] Registrar o evento no log de incidentes (seção 8)
- [ ] Monitorar para confirmação ou descarte

---

### Dias 1–3 — Investigação e Notificação ANPD

#### Investigação
- [ ] Identificar exatamente quais dados foram expostos (tabelas, colunas, registros)
- [ ] Estimar número de titulares afetados
- [ ] Determinar janela temporal do incidente (início e fim)
- [ ] Coletar evidências: logs do Supabase, logs do Sentry, logs do Cloudflare
- [ ] Identificar causa-raiz

#### Notificação à ANPD (prazo: 3 dias úteis)

**Canal:** [peticionamento.anpd.gov.br](https://peticionamento.anpd.gov.br)  
**Serviço:** "Comunicação de Incidente de Segurança com Dados Pessoais"

**Conteúdo mínimo obrigatório (Art. 8, Resolução 4/2023):**

```
1. Data e hora em que o controlador tomou conhecimento do incidente
2. Descrição do incidente (o que ocorreu)
3. Categoria e tipo dos dados pessoais afetados
4. Quantidade estimada de titulares afetados
5. Medidas técnicas de segurança adotadas pelo controlador
6. Riscos decorrentes do incidente para os titulares
7. Medidas adotadas ou a adotar para reverter ou mitigar os efeitos
8. Se a comunicação é parcial, motivos do prazo e previsão de informações complementares
```

> **Nota:** Para incidentes P0 envolvendo dados sensíveis de saúde (Art. 11), considerar contato telefônico prévio com a ANPD antes da formalização: (61) 3411-6509.

---

### Dias 1–5 — Notificação aos Titulares

Notificar os usuários afetados quando o incidente puder causar **risco ou dano relevante** (Art. 48, §1º).

**Como notificar:**
1. E-mail direto via `process-email-queue` (Edge Function existente)
2. Notificação in-app via tabela `notifications` no Supabase
3. Banner no Dashboard (Home.tsx) para usuários afetados

**O que comunicar:**
- O que aconteceu (em linguagem acessível, sem jargão técnico)
- Quais dados foram afetados
- O que o usuário deve fazer (trocar senha, monitorar uso)
- Como entrar em contato com o DPO: fabio@locustech.com.br

---

## 5. Templates de Comunicação

### 5.1 E-mail para Titulares Afetados

```
Assunto: [Locus Vita] Comunicado importante sobre a segurança dos seus dados

Prezado(a) [NOME],

Identificamos um incidente de segurança que pode ter afetado seus dados 
no Locus Vita no período de [DATA_INÍCIO] a [DATA_FIM].

O que aconteceu:
[DESCRIÇÃO CLARA E OBJETIVA DO INCIDENTE]

Dados possivelmente afetados:
[LISTAR: ex. histórico de medicamentos, arquivos de exames]

O que já fizemos:
- Corrigimos a falha que deu origem ao incidente
- Revogamos acessos indevidos
- Notificamos a Autoridade Nacional de Proteção de Dados (ANPD)

O que recomendamos que você faça:
- Altere sua senha em Ajustes → Segurança → Alterar senha
- Se usar a mesma senha em outros serviços, altere-as também
- Fique atento a comunicações suspeitas em seu nome

Você pode entrar em contato com nosso Encarregado de Dados pelo e-mail 
fabio@locustech.com.br para mais informações ou para exercer seus 
direitos previstos na LGPD.

Lamentamos profundamente o ocorrido e reforçamos nosso compromisso 
com a proteção dos seus dados.

Atenciosamente,
Fábio
Encarregado de Dados — Locus Tech
fabio@locustech.com.br
```

### 5.2 Comunicação Interna de Abertura de Incidente

```
[INCIDENTE #YYYY-MM-DD-001]
Severidade: P0 / P1 / P2
Detectado em: [DATA HORA]
Conhecimento confirmado em: [DATA HORA] ← marco zero para prazo ANPD
Prazo ANPD: [DATA HORA + 3 dias úteis]

Descrição inicial:
[...]

Ações imediatas tomadas:
[...]

Responsável: Fábio (fabio@locustech.com.br)
```

---

## 6. Registro de Evidências

Para cada incidente, criar um arquivo em `docs/incidentes/YYYY-MM-DD-NNN.md` com:

```markdown
# Incidente YYYY-MM-DD-001

## Linha do Tempo
| Timestamp | Evento |
|-----------|--------|
| YYYY-MM-DDTHH:MM | Detecção / alerta |
| YYYY-MM-DDTHH:MM | Confirmação de incidente |
| YYYY-MM-DDTHH:MM | Contenção aplicada |
| YYYY-MM-DDTHH:MM | Notificação ANPD enviada |
| YYYY-MM-DDTHH:MM | Notificação a titulares enviada |
| YYYY-MM-DDTHH:MM | Incidente encerrado |

## Dados Afetados
- Tabelas: 
- Titulares estimados: 
- Período de exposição: 

## Causa-Raiz
[Descrição técnica]

## Medidas Corretivas
- [ ] Medida 1
- [ ] Medida 2

## Lições Aprendidas
[O que mudar para evitar recorrência]

## Notificações
- ANPD: [ ] Enviada em [DATA] | Protocolo: [NÚMERO]
- Titulares: [ ] Enviada em [DATA] | Quantidade: [N]
```

---

## 7. Contatos de Emergência

| Quem | Contato | Quando acionar |
|------|---------|---------------|
| DPO / Responsável | fabio@locustech.com.br | Sempre — primeiro acionamento |
| Supabase Support | support.supabase.com | Incidentes P0 envolvendo infraestrutura |
| ANPD | peticionamento.anpd.gov.br / (61) 3411-6509 | Notificação obrigatória até D+3 úteis |
| Asaas Suporte | suporte.asaas.com | Se dados financeiros forem comprometidos |
| Sentry | sentry.io (dashboard) | Coleta de evidências e rastreamento |

---

## 8. Revisão Pós-Incidente

Após encerramento de qualquer incidente P0 ou P1, realizar reunião de revisão em até **5 dias úteis** com:

1. Linha do tempo completa do incidente
2. Avaliação da eficácia das medidas de contenção
3. Identificação de gaps nos controles de segurança
4. Plano de ação preventivo com responsáveis e prazos
5. Atualização deste runbook se necessário

---

## 9. Referências Legais

- **LGPD Art. 48** — Obrigação de comunicar incidentes à ANPD e aos titulares
- **Resolução CD/ANPD 4/2023** — Regulamenta o prazo (3 dias úteis) e o conteúdo mínimo da comunicação
- **LGPD Art. 11** — Dados pessoais sensíveis (saúde): exige atenção redobrada
- **Portal de peticionamento ANPD:** peticionamento.anpd.gov.br

---

*Documento mantido pelo Encarregado de Dados. Revisar após cada incidente P0/P1 e anualmente.*
