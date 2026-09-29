---
name: task
description: Ponto de entrada de toda tarefa de código num projeto com o quality-kit. Use ANTES de começar qualquer pedido que mude ou explique o código, mesmo curto - corrigir bug ("corrige", "conserta", "tá quebrado", "erro", "fix"), criar ou mudar funcionalidade ("adiciona", "implementa", "cria", "muda", "add", "build"), refatorar ("refatora", "extrai", "quebra esse arquivo", "limpa", "move"), performance ("tá lento", "otimiza", "LCP", "INP", "perf") ou investigar ("como funciona", "por que", "onde fica", "explica"). Escolhe o playbook (bug-fix, feature, refactor, perf, investigation), copia os passos para a lista de tarefas e fecha com a verificação que prova o que mudou.
---

# task: escolher o playbook

Toda tarefa segue um playbook. O playbook é o método: o que provar antes de
mexer, como mexer e como mostrar que funcionou. Improvisar o método é onde o
agente erra.

## 1. Escolha

| O pedido | Playbook |
| --- | --- |
| Algo que funcionava, ou devia funcionar, e não funciona | `bug-fix` |
| Comportamento novo ou mudança de comportamento pedida | `feature` |
| Mudar a forma do código sem mudar o que ele faz | `refactor` |
| Lento, pesado, pulando, nota do Lighthouse | `perf` |
| Entender, explicar, localizar, avaliar opções, sem mudar código | `investigation` |

Leia o playbook escolhido inteiro antes do primeiro passo, e o complemento do
projeto: `PLAYBOOKS.md` na pasta da régua (`quality-kit paths` mostra onde; no
modo time, `.quality/PLAYBOOKS.md`).

Casos de fronteira:
- Bug que só aparece com volume ou em aparelho lento é `perf`.
- Feature que exige mexer em código ruim: `refactor` primeiro, num commit
  separado, depois `feature`.
- Pedido ambíguo: comece por `investigation`; se a conclusão pedir mudança,
  troque de playbook e diga qual.

## 2. Copie os passos

Abra a lista de tarefas (no Claude Code, a de todos; no Codex, o
`update_plan`) com os passos do playbook copiados na íntegra, na ordem, antes
de qualquer item da tarefa. Passo que não se aplica fica na lista marcado
`pulado: <motivo>`.

## 3. Feche com a verificação

Todo playbook termina em [`references/verificacao.md`](references/verificacao.md):
o gate e a prova em runtime que bate com o que mudou. Build verde não é prova.

## Regras de todo playbook

- Comece da base atualizada (`git fetch` e branch a partir dela).
- Leia o AGENTS.md do projeto e, se for mexer em pastas, o `ARCHITECTURE.md`
  da régua.
- Mecanismo oficial da ferramenta ou nada: sem gambiarra. Na dúvida sobre uma
  lib, consulte a documentação da versão instalada.
- Lógica nova chega com teste ao lado.
- A régua (config, lint-extra, baseline, hooks, workflow) não é sua: não a
  edite para passar. Se uma regra estiver errada, diga isso na resposta e use
  a skill `gardener` para propor a mudança a um humano.
- Não pare para perguntar o que dá para decidir lendo o código; decida e
  registre a decisão na resposta.
