# Contexto: Locus Vita (Fase 252 - Bugfix Definitivo: Extração Tabular do PDF via Coordenada X)

O Stakeholder APROVOU INTEGRALMENTE o seu plano de extração por Colunas (X-Coordinate) para resolver a falha na importação de Lote, UF, Município e Estabelecimento. A junção de itens por Y-Coordinate estava achatando a tabela em strings únicas, impossibilitando a leitura linha a linha.

## 1. Execução do Plano Aprovado `src/lib/parseSusVaccinePdf.ts`)

Proceda com a refatoração do motor de extração utilizando a lógica de Coordenadas X que você propôs no diagnóstico.

* Crie a estrutura de linhas tabulares `extractTableRows`).

* Mapeie os itens baseados na posição X relativa ou pelos X-coordinates dos headers ("Lote", "UF", "Município", "Estabelecimento").

* Atualize o loop de `extractVaccines` para puxar os dados diretamente dos índices das colunas ou da heurística de X-Coordinate.

## 2. ⚠️ TRAVA DE SEGURANÇA (Regras Intocáveis)

Você tem autorização para reescrever o motor de extração de tabelas, MAS é ESTRITAMENTE OBRIGATÓRIO manter:

* **A Validação de Titularidade (CPF):** A lógica de capturar todo o texto corrido (Y-Coordinate fallback), normalizar e usar `.includes(cleanDbCpf)` (Negative Lookarounds) NÃO PODE SER ALTERADA. Se o novo motor quebrar o CPF corrido, mantenha o `extractTextFromPdf` antigo rodando em paralelo apenas para a checagem de CPF.

* **O Dicionário "De/Para" de Doses `translateDose`):** A conversão de "1/2" para "1ª Dose" deve continuar sendo aplicada na string capturada da coluna de dose.

* **A Guilhotina de Sanitização e o Smart Mapping:** A limpeza de lixo demográfico no nome da vacina e a função `mapVaccineToStandard` continuam sendo necessárias para o dado extraído da Coluna 0.

## 3. Validação UI

* Certifique-se de que os dados (Lote, UF, Município e Estabelecimento) extraídos por colunas sejam repassados na estrutura exata que o `VaccineImportReviewDrawer` e o React Hook Form esperam para exibir no card de revisão e salvar no banco.  
  
  
***************************************  
Diagnóstico: Por que Lote, UF, Município e Estabelecimento não são importados

### Causa Raiz

O problema está na função `extractTextFromPdf` (linha 21-37 de `parseSusVaccinePdf.ts`). Ela agrupa os itens de texto do PDF por coordenada Y (com tolerância de 2px) e junta tudo numa única string separada por espaços. Isso significa que uma **linha inteira da tabela do SUS** (que contém Vacina, Data, Dose, Lote, Fabricante, Estratégia, CNES, UF, Município e Estabelecimento) vira **uma única string longa** ou se divide em **poucas linhas mescladas**.

O parser em `extractVaccines` (linhas 246-288) tenta capturar esses campos em **linhas subsequentes separadas**, mas eles nunca aparecem assim:

- **Lote** (linha 258): Exige que o lote seja a linha inteira (`/^[A-Za-z0-9...]{2,30}$/`). Falha quando o lote está concatenado com fabricante/estratégia na mesma linha.
- **UF** (linha 274): Exige exatamente 2 letras maiúsculas como linha inteira (`/^[A-Z]{2}$/`). Falha quando "SP" aparece no meio de "SP São Paulo UBS Centro".
- **Município/Estabelecimento** (linhas 280-287): Procura por keywords em linhas isoladas, mas elas estão mescladas com outros dados.

### Solução: Extração por Colunas (X-Coordinate)

Reformular a extração para usar as coordenadas X dos itens de texto, reconstruindo as colunas reais da tabela do PDF.

### Plano de Implementação

**Arquivo: `src/lib/parseSusVaccinePdf.ts**`

1. **Refatorar `extractTextFromPdf**` para retornar dois outputs:
  - O texto corrido (para CPF e busca genérica — já funciona)
  - Uma estrutura de **linhas tabulares** onde cada linha é um array de células com posição X, permitindo reconstruir colunas
2. **Criar função `extractTableRows**` que:
  - Agrupa itens por Y-coordinate (como hoje)
  - Dentro de cada row, detecta os limites de coluna baseado nos X-coordinates dos headers ("Vacina/Profilaxia", "Data", "Dose", "Lote", "Fabricante", "Estratégia", "UF", "Município", "Estabelecimento de Saúde")
  - Atribui cada célula à coluna mais próxima pelo X
3. **Refatorar `extractVaccines**` para iterar pelas linhas tabulares, extraindo diretamente:
  - Coluna 0 → nome da vacina
  - Coluna 1 → data
  - Coluna 2 → dose
  - Coluna 3 → lote (batch)
  - Coluna ~6 → UF (state)
  - Coluna ~7 → município (city)
  - Coluna ~8 → estabelecimento (facility)
4. **Fallback robusto**: Se a detecção de colunas por header falhar (header não encontrado), usar heurística por posição X relativa: após o date match, qualquer texto curto alfanumérico (2-30 chars) na mesma row com X > date.X é candidato a lote; texto de 2 chars uppercase é UF; texto longo com keywords de saúde é facility.
5. Manter toda a lógica existente de Smart Mapping, sanitização, e validação de CPF intacta.

### Detalhes Técnicos

```text
PDF Table (visual):
┌─────────────┬────────────┬──────┬────────┬───┬──────────┬────────────────┐
│ Vacina      │ Data       │ Dose │ Lote   │UF │ Município│ Estabelecimento│
├─────────────┼────────────┼──────┼────────┼───┼──────────┼────────────────┤
│ HEPATITE B  │ 30/01/1982 │ 1/2  │ FA123  │SP │ SÃO PAULO│ UBS CENTRO     │
└─────────────┴────────────┴──────┴────────┴───┴──────────┴────────────────┘

pdfjs items (X coordinates):
  x=50  "HEPATITE B"
  x=200 "30/01/1982"
  x=300 "1/2"
  x=370 "FA123"
  x=480 "SP"
  x=520 "SÃO PAULO"
  x=650 "UBS CENTRO"

Current parser: joins all → "HEPATITE B 30/01/1982 1/2 FA123 SP SÃO PAULO UBS CENTRO"
→ Finds date ✓, name ✓, dose ✓
→ Looks for batch on NEXT line → ✗ (it's on the same line)

Proposed parser: keeps column structure → cells[0]="HEPATITE B", cells[3]="FA123", cells[4]="SP", etc.
→ Direct column mapping ✓
```

### Resultado Esperado

Após a implementação, o drawer de revisão de importação exibirá corretamente Lote, UF, Município e Estabelecimento para cada vacina extraída do PDF do SUS.