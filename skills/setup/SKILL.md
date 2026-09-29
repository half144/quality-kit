---
name: setup
description: Monta o quality-kit num projeto JS/TS existente (Next, Expo, Vite/React, Node, Convex; monorepo ou não). Use quando pedirem "monta o quality-kit", "configura o gate", "setup do quality-kit", "quero travas de qualidade para agentes neste repo", ou na primeira vez que o kit for usado num projeto. Lê o projeto, faz de 3 a 5 perguntas, gera a régua (checker de arquitetura, ARCHITECTURE.md, mapa de telas, config do verify, complemento dos playbooks, regras extras de lint), congela a dívida e entrega um relatório.
---

# setup: montar o quality-kit num projeto

O kit monta a escada de confiança: (1) a estrutura impede o erro, (2) análise
estática, (3) prova em runtime. O núcleo é igual para todo projeto; o que é do
projeto você gera aqui.

`quality-kit` abaixo é o comando do kit. No Claude Code o plugin já o põe no
PATH do Bash. No Codex, ou fora do plugin, use `bin/quality-kit` do clone do
kit; depois do passo 1, `~/.quality-kit/bin/quality-kit` também serve.

## Passos

1. **Instalar as dependências do kit nesta máquina** (uma vez; não toca no
   projeto): `quality-kit install`.
2. **Ler o projeto:** `quality-kit detect`. Anote a stack de cada pacote, o
   gerenciador de pacotes, os testes, os tsconfig, a forma do código
   (`shape`: pastas do topo, convenção de nomes, barris, `__tests__`), se já há
   config de lint, knip, jscpd, hooks do git e CI. Confira o que o projeto
   precisa para rodar (dependências instaladas? se não, instale com o
   gerenciador dele antes do passo 5).
3. **Perguntar (de 3 a 5 decisões, numa rodada só).** Use a ferramenta de
   perguntas quando houver; senão, pergunte em texto. Sugira a resposta que a
   leitura indicou e siga com ela se a pessoa não tiver preferência:
   - **Arquitetura:** manter a atual como régua (`keep`: congela a forma de
     hoje, o que existe passa e o código novo segue) ou sugerir o padrão por
     features (`suggest`: rotas → features → compartilhado, kebab-case, sem
     barril, teste ao lado; as violações de hoje vão para a baseline).
   - **Modo:** `local` (nada muda no repo: régua em `~/.quality-kit/projects/`,
     hooks em `.git/hooks`) ou `team` (régua commitada em `.quality/`, hooks em
     `.githooks/`, passo de CI, deny no `.claude/settings.json`, trecho no
     AGENTS.md).
   - **O que é tela:** confirme os apps com UI e a pasta de rotas (Next e Expo
     Router são deduzidos); para Vite/React sem roteamento por arquivo, quais
     componentes são telas e o caminho de cada uma.
   - **Como subir o app** para o verify (comando com `{port}`, build antes, env
     de backend num arquivo fora do repo).
   - Se couber: a branch de base (`origin/main`?) e o runner do CI (modo time).
4. **Gerar os rascunhos.** Escreva as respostas num arquivo temporário fora do
   repo e rode `quality-kit init --answers <arquivo>`. Formato:

   ```json
   {
     "mode": "local",
     "architecture": "keep",
     "base": "origin/main",
     "lint": "kit",
     "apps": { "root": { "name": "web", "start": { "command": "npx vite --port {port} --strictPort --host 127.0.0.1" } } },
     "screens": [{ "app": "web", "file": "App.tsx", "route": "/", "open": "/", "summary": "Tela inicial", "features": [] }],
     "ci": { "runsOn": "ubuntu-latest", "install": { "run": "npm ci" } }
   }
   ```

   `apps` é indexado pela pasta do pacote (`root` para a raiz). `lint`:
   `kit` (preset do kit por cima da config do projeto) ou `project` (o projeto
   já tem um preset rígido, como o Flock; aí vale o dele e as supressões dele).
5. **Revisar os rascunhos** na pasta que o `init` imprimiu (`quality-kit
   paths`): `config.json` (raízes, camadas, direção dos imports com
   `imports.forbid`, pastas especiais do framework em `rootFiles`, workspaces e
   runner de teste, flags do tsc, `verify.apps`), `ARCHITECTURE.md`,
   `FEATURE_MAP.md` (preencha Resumo, Feature e o caminho de demonstração das
   rotas dinâmicas), `PLAYBOOKS.md` e `lint-extra.cjs` (regras que o projeto já
   pede em texto, no CLAUDE.md ou AGENTS.md dele, viram regra aqui). Ajuste até
   a régua descrever o projeto; o `init` pode rodar de novo.
6. **Ligar:** `quality-kit finalize`. Ele congela a dívida (lint, tsc estrito,
   arquitetura), confere se knip e jscpd rodam no projeto (e desliga o que não
   roda, com o motivo), instala os hooks do git, gera os arquivos do modo time,
   liga a régua e assina o aceite. Depois disso a régua só muda por
   `quality-kit rules accept`, que é de humano.
7. **Medir:** `quality-kit gate` na árvore de agora (deve aprovar: a dívida
   antiga está congelada) e `quality-kit map`. No modo local, confira que
   `git status` continua limpo.

## Relatório

- Modo, pasta da régua e o que foi gerado (no modo time, os arquivos novos do
  repo).
- As decisões e o porquê de cada uma.
- A dívida congelada: totais do `finalize` (`eslint`, `tsc`, `arch`).
- Os checks desligados e o motivo; o que falta a pessoa fazer (PATH, `core.hooksPath`
  nos outros clones, rótulo `regua-aprovada` no GitHub, CODEOWNERS para
  `.quality/`).
- O limite: o dono da máquina sempre pode desligar o kit; o agente não.
