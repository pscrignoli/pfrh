

## Plano: Campos dinâmicos por vaga + detalhe do candidato

### Resumo
Criar um sistema onde cada vaga tem campos personalizados (texto, dropdown, sim/não, número) definidos pelo RH na criação/edição da vaga. Ao clicar num card de candidato no Kanban, abre um modal centralizado onde o RH preenche esses campos para aquele candidato.

---

### 1. Banco de dados — 2 novas tabelas

**`vacancy_fields`** — define os campos de cada vaga:
| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | |
| vacancy_id | uuid FK→vacancies | |
| label | varchar | Ex: "Certificações" |
| field_type | varchar | `text`, `dropdown`, `boolean`, `number` |
| options | jsonb | Para dropdown: `["Opção A","Opção B"]` |
| sort_order | int | Ordem de exibição |
| created_at | timestamptz | |

**`candidate_field_values`** — respostas por candidato:
| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | |
| candidate_id | uuid FK→candidates | |
| field_id | uuid FK→vacancy_fields | |
| value | text | Valor preenchido (serializado) |
| updated_at | timestamptz | |
| unique(candidate_id, field_id) | | Evita duplicatas |

RLS desabilitado em ambas (conforme decisão anterior). RPC para salvar valores (evitar CORS com PATCH).

---

### 2. Modal de criação de vaga — wizard 2 steps

Arquivo: `src/pages/Recrutamento.tsx`

- **Step 1** (atual): Título, Departamento, Modelo de Trabalho.
- **Step 2** (novo): "Campos da Vaga" — lista editável onde o RH:
  - Clica "Adicionar campo"
  - Escolhe tipo (Texto / Dropdown / Sim ou Não / Número)
  - Digita o label
  - Se dropdown: adiciona opções uma a uma
  - Pode reordenar e remover campos
- Botão "Criar Vaga" só no step 2; "Voltar" retorna ao step 1.

Fluxo: cria vaga via RPC → depois insere os campos em `vacancy_fields`.

---

### 3. Edição de campos após criação

No Kanban (`RecrutamentoKanban.tsx`), botão "Editar campos" ao lado do título. Abre modal com a mesma UI do step 2. Se houver candidatos, exibe aviso: "Candidatos existentes podem perder dados ao remover campos."

---

### 4. Modal de detalhe do candidato

Ao clicar no card no Kanban → modal centralizado com:
- Nome, e-mail, telefone (fixos, editáveis)
- **Etapa** (dropdown com as 5 etapas do Kanban — campo fixo, salva no `candidates.stage`)
- Campos dinâmicos da vaga, renderizados por tipo:
  - `text` → Input
  - `dropdown` → Select com as opções
  - `boolean` → Checkbox
  - `number` → Input numérico
- Botão "Salvar" → upsert via RPC em `candidate_field_values`

---

### 5. RPC functions (evitar CORS)

- **`upsert_candidate_field_values`**: recebe `_candidate_id` + `_values jsonb` (array de {field_id, value}), faz upsert em `candidate_field_values`.
- **`save_vacancy_fields`**: recebe `_vacancy_id` + `_fields jsonb`, deleta campos antigos e insere novos (transação atômica).

---

### 6. Arquivos impactados

| Arquivo | Alteração |
|---|---|
| Migration SQL | Tabelas + RPCs + disable RLS |
| `src/hooks/useVacancyFields.ts` | Novo hook para CRUD de campos da vaga |
| `src/hooks/useCandidateFieldValues.ts` | Novo hook para ler/salvar valores |
| `src/pages/Recrutamento.tsx` | Wizard 2 steps no modal |
| `src/pages/RecrutamentoKanban.tsx` | Click no card → modal detalhe; botão editar campos |
| `src/hooks/useVacancies.ts` | Ajuste no `createVacancy` para retornar o ID da vaga criada |

---

### 7. Comportamento no card do Kanban

O card continua exibindo apenas nome e data (sem preview dos campos). Os campos só aparecem ao abrir o modal de detalhe.

