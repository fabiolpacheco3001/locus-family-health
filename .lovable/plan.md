

## Plano: Trocar ordem de "Status do Tratamento" e "Vincular Consulta"

### O que muda

No formulário de edição de medicamentos, a ordem atual é:
1. Início | Duração
2. **Status do Tratamento** (linha 305-334)
3. **Vincular Consulta** (linha 336-358)
4. Moldura Uso Contínuo

A nova ordem será:
1. Início | Duração
2. **Vincular Consulta** (sobe)
3. **Status do Tratamento** (desce, continua só em edição)
4. Moldura Uso Contínuo

### Alteração

Arquivo: `src/components/AddMedicationDrawer.tsx`

Mover o bloco "Vincular Consulta" (linhas 336-358) para **antes** do bloco "Status do Tratamento" (linhas 305-334). Apenas troca de posição dos dois blocos, sem alteração de código ou estilo.

