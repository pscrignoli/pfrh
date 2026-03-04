
Objetivo: corrigir o travamento ao clicar em “Nova Vaga” (fica em “Criando...” sem concluir).

Diagnóstico já feito (com base em logs e código):
- As políticas de acesso de `vacancies` e `candidates` já estão abertas (não é o gargalo atual).
- O botão entra em estado de loading, mas não aparece POST de criação da vaga no tráfego capturado.
- O app tem listener de autenticação com callback assíncrono que faz consulta no banco dentro de `onAuthStateChange` (`AuthContext.tsx`), padrão conhecido por causar lock de chamadas do cliente em alguns eventos de auth (sintoma típico: request “pendente”/não dispara).
- O fluxo de criação ainda depende de `insert(...).select(...).single()` + `await fetchVacancies()`, o que aumenta chance de ficar preso quando há lock/intermitência.

Plano de implementação:
1) Remover risco de lock no ciclo de autenticação
- Arquivo: `src/contexts/AuthContext.tsx`
- Refatorar `onAuthStateChange` para callback síncrono (sem `await` dentro do listener).
- Separar carregamento de roles para um fluxo assíncrono fora do callback (ex.: função disparada por mudança de `session?.user?.id`).
- Adicionar proteção contra corrida (flag `mounted` + controle de request ativo para não sobrescrever estado antigo).

2) Tornar criação de vaga resiliente e não bloqueante
- Arquivo: `src/hooks/useVacancies.ts`
- Alterar criação para `insert(payload)` sem `select().single()` no mesmo call.
- Aplicar timeout defensivo na mutation (ex.: 10–12s) para nunca deixar Promise pendente indefinidamente.
- Após sucesso, disparar `fetchVacancies()` em background (sem bloquear encerramento do modal), mantendo feedback imediato ao usuário.
- Padronizar erro retornado com mensagem amigável (“Não foi possível concluir a criação. Tente novamente.”) + detalhe no console para debug.

3) Ajustar UX para não parecer “travado”
- Arquivo: `src/pages/Recrutamento.tsx`
- Manter botão desabilitado durante save, mas com fallback de liberação caso timeout estoure.
- Garantir reset de `saving` em todos os cenários (sucesso, erro, timeout) e toast consistente.

4) Corrigir warning de acessibilidade relacionado a Dialog (aproveitando o ajuste)
- Arquivo: `src/pages/RecrutamentoKanban.tsx`
- Adicionar `DialogDescription` no modal “Novo Candidato” (esse warning apareceu no console e é simples de eliminar).

Detalhes técnicos (resumo):
- Não vou alterar estrutura de tabelas nem criar migração para esta correção.
- O foco é estabilidade de fluxo assíncrono no cliente:
  - evitar await dentro de listener de auth,
  - evitar mutation dependente de retorno “single row”,
  - colocar timeout explícito para impedir loading infinito.

Checklist de validação após implementar:
1. Login normal.
2. Ir em `/recrutamento` → criar vaga só com título.
3. Confirmar:
   - botão volta de “Criando...” para estado normal,
   - modal fecha,
   - toast de sucesso aparece,
   - card da vaga aparece no grid.
4. Repetir com departamento selecionado.
5. Abrir/fechar modal rapidamente e tentar criar novamente (não pode ficar preso).
6. Conferir console sem novo warning de `DialogContent` sem descrição.

Se aprovado, implemento exatamente esse plano.
