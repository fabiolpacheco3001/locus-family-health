# Schema do contexto JSON para o script generate_spec.py

```json
{
  "meta": {
    "produto": "Locus Vita",
    "modulo": "Nome do Módulo",
    "feature": "Nome da Funcionalidade",
    "autor": "Fábio",
    "data": "DD/MM/AAAA",
    "versao": "1.0",
    "status": "Planejado"
  },
  "visao_geral": {
    "resumo": "Parágrafo(s) descrevendo o que é, para quem serve e o valor entregue.",
    "kpis": [
      {"id": "KPI-01", "metrica": "Descrição da métrica", "meta": "Valor alvo"}
    ],
    "impacto_saude": {
      "comportamento_alvo": "Qual comportamento de saúde a feature apoia ou muda (ex: aumentar adesão medicamentosa em usuários com doença crônica).",
      "kpis_saude": [
        {"indicador": "Taxa de adesão medicamentosa", "baseline": "~60% estimado", "meta": "> 80%"},
        {"indicador": "Exames realizados vs. agendados", "baseline": "—", "meta": "> 70%"}
      ]
    }
  },
  "escopo": {
    "incluido": [
      {"icone": "✅", "funcionalidade": "Funcionalidade incluída", "status": "Lançado", "obs": ""},
      {"icone": "⚠️", "funcionalidade": "Item em investigação", "status": "Em investigação", "obs": "Detalhe"}
    ],
    "excluido": [
      {"icone": "❌", "funcionalidade": "Fora de escopo", "status": "Fora de escopo", "obs": "Motivo"}
    ]
  },
  "problema": "Descrição do problema, personas afetadas (incluindo papel de cuidador onde relevante) e custo de não resolver. Ancorar em evidência: relatos de usuários, dados de uso, ou literatura em saúde.",
  "contexto_comportamental": {
    "analise": "Análise COM-B: qual barreira está impedindo o comportamento de saúde desejado.",
    "pernas": [
      {"dimensao": "Capability (Capacidade)", "avaliacao": "O usuário sabe/consegue realizar o comportamento?", "estrategia": "Como a feature reduz esse gap"},
      {"dimensao": "Opportunity (Oportunidade)", "avaliacao": "O ambiente (app, rotina, família) facilita?", "estrategia": "Como a feature cria a oportunidade"},
      {"dimensao": "Motivation (Motivação)", "avaliacao": "O usuário quer fazer? Acredita que vale?", "estrategia": "Como a feature aumenta a motivação"}
    ]
  },
  "user_stories": [
    {
      "id": "US-01",
      "story": "Como [persona], quero [ação] para [benefício].",
      "criterio": "Dado que... Quando... Então...",
      "prioridade": "Alta"
    }
  ],
  "fluxo_principal": {
    "passos": [
      "Ponto de entrada do usuário",
      "Ação do usuário",
      "Resposta do sistema",
      "Conclusão / estado final"
    ],
    "fluxos_alternativos": [
      {"alternativa": "Nome", "tratamento": "Como o sistema trata"}
    ],
    "casos_de_borda": [
      {"situacao": "Situação limite", "comportamento": "Resposta esperada", "estado": "Mensagem ou estado visual"}
    ]
  },
  "regras_negocio": [
    {
      "id": "RN-01",
      "regra": "Nome da regra",
      "logica": "Fórmula ou lógica determinística",
      "exemplo": "Caso concreto"
    }
  ],
  "requisitos_nao_funcionais": [
    {
      "categoria": "Mobile/PWA",
      "requisito": "Inputs com font-size ≥ 16px",
      "criterio": "Sem auto-zoom no iOS"
    }
  ],
  "arquitetura": {
    "componentes": [
      {
        "arquivo": "src/caminho/Arquivo.tsx",
        "responsabilidade": "Descrição",
        "acao": "Criar"
      },
      {
        "arquivo": "supabase/functions/nome/",
        "responsabilidade": "Descrição",
        "acao": "Modificar"
      }
    ],
    "modelo_dados": [
      {
        "entidade_coluna": "tabela.coluna",
        "tipo": "text",
        "descricao": "Descrição e regras de negócio"
      }
    ],
    "requer_migration": true,
    "nome_migration": "20260622000000_add_feature_name",
    "padrao_visual": [
      {
        "componente": "ConfiguracaoNotificacoes.tsx — container principal",
        "token_classe": "bg-background",
        "observacao": "Fundo padrão de páginas"
      },
      {
        "componente": "Botão 'Ativar Notificações'",
        "token_classe": "variant='default' (--primary)",
        "observacao": "Ação principal"
      },
      {
        "componente": "Ícone de status ativo",
        "token_classe": "CheckCircle2 text-green-500",
        "observacao": "Confirmação visual"
      }
    ]
  },
  "consideracoes_saude": [
    {
      "dimensao": "Segurança Clínica",
      "avaliacao": "Qual o risco à saúde se a feature falhar ou for mal interpretada? (ex: dose dupla, pânico com dado, abandono de tratamento)",
      "acao": "Salvaguardas de design / alertas / contexto clínico adicional",
      "nivel": "Alto"
    },
    {
      "dimensao": "LGPD — Dados Sensíveis",
      "avaliacao": "Esta feature abre novo processamento de dado de saúde (Art. 11 LGPD)?",
      "acao": "Registrar em consent_log com consent_type específico antes de processar",
      "nivel": "Médio"
    },
    {
      "dimensao": "Letramento em Saúde",
      "avaliacao": "Conteúdo de interface acessível para usuário com escolaridade fundamental?",
      "acao": "Revisar linguagem: remover jargão clínico, adicionar explicações simples",
      "nivel": "Baixo"
    },
    {
      "dimensao": "Regulação Setorial",
      "avaliacao": "Toca CFM / ANVISA / ANS de alguma forma?",
      "acao": "Flag para avaliação jurídica se aplicável; caso contrário: N/A",
      "nivel": "Baixo"
    }
  ],
  "roadmap": [
    {"versao": "v1.0 — MVP", "escopo": "O que será entregue", "status": "📋 Planejado", "data": "TBD"}
  ],
  "riscos": [
    {"risco": "Descrição do risco", "severidade": "Alta", "mitigacao": "Como mitigar"}
  ],
  "prompt_lovable": "Rascunho do primeiro prompt a enviar para o Lovable via MCP send_message."
}
```

## Notas

- Campos de array podem ter 0 itens (tabela será omitida do documento)
- `status` em `meta` aceita: "Planejado" | "Em Desenvolvimento" | "Lançado" | "Depreciado"
- `acao` em `componentes` aceita: "Criar" | "Modificar" | "Deletar"
- `prioridade` em `user_stories` aceita: "Alta" | "Média" | "Baixa"
- `severidade` em `riscos` aceita: "Alta" | "Média" | "Baixa"
- `padrao_visual` em `arquitetura`: array vazio ou ausente → seção 7.4 omitida do documento. Listar apenas componentes **novos** desta feature com tokens específicos — não replicar o design system completo.
