---
name: refactor
description: Playbook de refatoração do quality-kit, escolhido pelo roteador task. Use para extrair, mover, renomear, quebrar arquivo grande, subir peça para o compartilhado, pagar dívida de lint ou de tipo, sem mudar o que o sistema faz. Registrar o comportamento com testes de caracterização antes de mexer e provar comportamento idêntico depois.
---

# refactor

Copie estes passos para a lista de tarefas antes de começar (ver `task`).
Refatorar é mudar a forma sem mudar o comportamento. Bug no caminho: anote e
corrija depois, pelo `bug-fix`.

1. **Fixar o comportamento atual** com testes de caracterização: saída de
   função pura para entradas reais e de borda, render do componente com o que a
   pessoa vê e clica, retorno do backend. Typecheck e lint não contam. Verde.
2. **Nomear a forma-alvo:** qual estrutura falta e onde cada peça mora pela
   régua. Para caber num limite do lint (300 linhas, 80 por função,
   complexidade 15), extraia por responsabilidade, não por tamanho.
3. **Subtrair antes de somar:** apague código morto e duplicação primeiro.
   Abstração nova só com repetição concreta.
4. **Passos pequenos, testes verdes em cada um.** Migre todos os chamadores e
   apague a API velha na mesma leva: nada de reexport de compatibilidade entre
   pastas. Código movido leva a própria dívida congelada; arquivo novo nasce
   limpo.
5. **Provar comportamento idêntico:** os mesmos testes, sem mudar uma
   expectativa. Tela afetada passa pelo `quality-kit verify --changed`.
6. **Verificar:** `task/references/verificacao.md`. Meça os maiores arquivos
   tocados: nenhum arquivo gigante novo. A baseline encolhe sozinha quando você
   conserta dívida antiga; ela nunca cresce.
7. **Reverter se não ficou melhor.**

## Resposta

- A forma antes e depois, em uma ou duas linhas.
- Os testes de caracterização e a saída deles antes e depois.
- Os chamadores migrados e o que foi apagado.
