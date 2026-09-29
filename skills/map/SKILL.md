---
name: map
description: Mantém o mapa de telas do quality-kit (FEATURE_MAP.md da régua) e o checker de arquitetura em dia com o código. Use quando criar, mover ou apagar uma tela ou rota, quando o gate cobrar "Tela sem linha no mapa", quando o verify não souber abrir uma tela, ou quando pedirem "atualiza o mapa de telas", "mapeia as rotas". Acrescenta as rotas que faltam, preenche o caminho de demonstração e as features de cada tela, e aponta o que mudou na estrutura e precisa virar régua.
---

# map: o mapa de telas e o checker

O mapa diz ao verify o que abrir e ao gate que telas uma mudança afeta. O
checker diz onde cada coisa mora. Os dois ficam para trás quando o código anda.

1. **Conferir:** `quality-kit map`. Ele lista a rota sem linha no mapa e a
   linha sem rota (nos apps com roteamento por arquivo, Next e Expo Router).
2. **Acrescentar o que falta:** `quality-kit map --write` põe as linhas das
   rotas novas no fim da tabela do app. Depois preencha à mão, no
   `FEATURE_MAP.md` da régua (`quality-kit paths`):
   - **Abrir em:** um caminho que abre com dado de demonstração. Rota dinâmica
     (`/evento/[id]`) precisa de um id que exista no ambiente do verify; sem
     isso, escreva o motivo no lugar do caminho.
   - **Feature:** as pastas (relativas ao `src`) que alimentam a tela, para o
     `verify --changed` achar a tela quando elas mudam.
   - **Resumo:** o que a tela é, em poucas palavras.
3. **Linha sem rota:** a tela saiu ou mudou de lugar. Apague a linha ou corrija
   o arquivo.
4. **App sem roteamento por arquivo** (Vite/React Router): as telas são linhas
   escritas à mão, com o componente da tela em **Arquivo** (relativo ao `src`).
   Tela nova é linha nova.
5. **Estrutura que mudou:** se a mudança criou uma pasta de topo, uma camada
   ou uma convenção nova que o checker reprova, isso não é para contornar: é
   uma decisão de régua. Descreva a mudança proposta na config
   (`architecture.roots`) e deixe para um humano aplicar e aceitar
   (`quality-kit rules accept`), como na skill `gardener`.
6. **Provar:** `quality-kit verify --changed` abre as telas novas.

O mapa não é régua: editar o `FEATURE_MAP.md` não pede aceite. O gate só
reprova a tela nova sem linha.
