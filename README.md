# quality-kit

Um plugin que monta, em qualquer projeto JS/TS existente, um ambiente onde
agentes de código são **obrigados** a entregar com qualidade. Traz as skills
(setup, playbooks, verify) e, diferente do [pstack](https://github.com/JoshueOsuna/pstack),
as **travas mecânicas**: o agente não encerra o turno com o gate vermelho e não
consegue afrouxar a régua sozinho.

## A escada de confiança

A ideia é a de Lauren Tan: cada degrau pega o que o anterior deixa passar.

1. **A estrutura impede o erro.** Um checker de arquitetura configurável
   (pastas, camadas, direção dos imports, pasta de rotas do framework, nomes).
2. **Análise estática.** Lint com tipos e zero warning (preset rígido, com as
   regras travadas contra `eslint-disable`), TypeScript estrito, testes ligados
   aos arquivos tocados, teste ao lado de arquivo novo com lógica, knip e jscpd.
3. **Método e prova em runtime.** Playbooks com um roteador (bug-fix, feature,
   refactor, perf, investigation) e o `verify`, que abre as telas afetadas em
   desktop e celular com Playwright e grava a prova que o gate confere.

## Instalação

No Claude Code:

```
/plugin marketplace add half144/quality-kit
/plugin install quality-kit@quality-kit
```

Depois, dentro do projeto: "monta o quality-kit neste projeto" (skill `setup`).
Ela roda `quality-kit install` uma vez por máquina: as dependências (eslint,
typescript-eslint, knip, jscpd, playwright) ficam em `~/.quality-kit/runtime`,
nunca no projeto. Para chamar `quality-kit` direto, ponha `~/.quality-kit/bin`
no PATH.

No Codex: `codex plugin marketplace add half144/quality-kit` e instale `quality-kit@quality-kit` (o catálogo está em
`.agents/plugins/marketplace.json` e as skills em `skills/`, no formato que o
Codex lê).

## Os dois modos

| | Local | Time |
| --- | --- | --- |
| Onde mora a régua | `~/.quality-kit/projects/<id>/` | `.quality/` no repo |
| O repo muda? | Não (`git status` limpo) | Sim, num PR |
| Lint | Config do kit por cima da do projeto | Igual, ou o preset do próprio projeto |
| TS estrito | Flags na linha de comando do `tsc` | Igual |
| Hooks do git | `.git/hooks` (não sobe) | `.githooks/` versionado |
| CI | Nenhum | `.github/workflows/quality.yml` |
| Deny do Claude | Só a guarda do plugin | Guarda + `.claude/settings.json` |

Nos dois, o gate só cobra o que foi tocado em relação à base: a dívida de
hoje fica congelada (lint, tsc, arquitetura) e só encolhe; o código novo nasce
limpo.

## O que cada trava faz

- **Gate (`quality-kit gate`).** Um comando só, chamado pelo hook
  Stop/SubagentStop, pelos hooks do git e pelo CI. Roda nos arquivos tocados:
  arquitetura, lint com tipos, typecheck estrito, testes ligados, teste ao
  lado de arquivo novo, catraca da dívida, knip, jscpd e a prova do `verify`
  quando mudou tela. Reprovou, o Claude Code não deixa o agente parar e
  devolve o relatório do que corrigir.
- **Trava de integridade.** O gate guarda, assinado com uma chave desta
  máquina, o hash da régua (config, regras extras, arquivos protegidos) e a
  dívida aceita. Régua alterada reprova com "a régua foi alterada; mudança de
  régua é decisão humana: rode `quality-kit rules accept`". Esse comando só
  roda num terminal de verdade, fora de agente e de hook. No modo time vale
  também a régua da base (a que passou pela revisão do merge), e o CI só aceita
  régua nova com o rótulo `regua-aprovada` no PR.
- **Guarda (PreToolUse).** Tira do alcance do agente a chave, os aceites, o
  código do kit, `rules accept`, `--suppress-all` e `--no-verify`.
- **Hooks do git.** `pre-commit` e `pre-push` rodam o perfil rápido
  (estrutura, teste ao lado, dívida). Servem ao Codex, que não tem hook de Stop.
- **CI (modo time).** O gate inteiro no PR, com a mesma versão do kit.

## Skills

`setup` (monta tudo e congela a dívida), `task` (o roteador) e os playbooks
`bug-fix`, `feature`, `refactor`, `perf`, `investigation`; `verify` (prova na
tela), `map` (mapa de telas e checker em dia) e `gardener` (o anti-padrão que
volta vira regra, com o código corrigido).

## Codex

O Codex lê as mesmas skills e o trecho que o setup injeta no `AGENTS.md`. Ele
não tem hook de Stop, então para ele as travas são os hooks do git e o CI; o
agente é instruído a rodar `quality-kit gate` antes de encerrar. O próximo
passo é um plugin do Paseo que dispare o gate no fim do turno do Codex.

## O limite

A trava é contra o atalho do agente, não contra quem tem a máquina. O dono da
máquina sempre pode desligar o plugin, apagar a régua ou aceitar qualquer
coisa; o agente não. No modo time, proteja `.quality/` com CODEOWNERS para a
mudança de régua passar por revisão.

## Licença

MIT.
