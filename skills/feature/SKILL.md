---
name: feature
description: Playbook de funcionalidade nova ou mudança de comportamento do quality-kit, escolhido pelo roteador task. Use para adicionar tela, campo, endpoint, função de backend, fluxo, integração ou copy com lógica. Entender o caminho do dado, decidir onde cada peça mora pela régua de arquitetura, construir em fatias testadas e provar rodando.
---

# feature

Copie estes passos para a lista de tarefas antes de começar (ver `task`).

1. **Entender o que existe.** O caminho do dado de ponta a ponta (rota, tela,
   estado, chamada ao backend, regra de negócio, armazenamento). Procure o
   padrão que o vizinho já usa e o componente que já resolve. Reutilize antes
   de criar.
2. **Decidir onde cada peça mora**, pelo `ARCHITECTURE.md` da régua: liste os
   arquivos novos e alterados com a camada de cada um. Peça usada por dois
   donos sobe para o compartilhado. Decisão contestável (formato do dado, onde
   fica o estado, contrato da função): escreva as opções e escolha com o motivo.
3. **Planejar a compatibilidade** quando backend e frontend publicam em
   separado: o novo entra antes de quem o usa, e o velho só sai depois.
4. **Construir em fatias**, da base para a tela: cada fatia com o teste dela ao
   lado e o gate verde antes da próxima. Lógica (formatação, cálculo, decisão)
   em função pura, testada sem navegador.
5. **Cuidar do que a tela exige:** vazio, carregando e erro; celular primeiro;
   nada pesado no caminho de quem não usa.
6. **Provar rodando**, pelo caminho que a pessoa usa: `quality-kit verify
   --changed`. Tela nova entra no mapa (skill `map`) no mesmo PR.
7. **Verificar:** `task/references/verificacao.md`.
8. **Commits pequenos**, um por fatia que faz sentido sozinha.

## Resposta

- O que a feature faz agora, em uma ou duas linhas.
- As decisões do passo 2 que não eram óbvias.
- A prova: capturas, saídas dos testes novos.
- O que ficou para depois.
