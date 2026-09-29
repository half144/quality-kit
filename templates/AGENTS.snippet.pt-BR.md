<!-- quality-kit:start -->
## Qualidade (quality-kit)

Este repo usa o [quality-kit](https://github.com/half144/quality-kit): a entrega
só vale depois de passar pela escada de confiança.

1. **Estrutura.** A régua de pastas, camadas e imports está em
   `{architecture}`; o checker reprova o que foge dela.
2. **Análise estática.** Lint com tipos e zero warning, TypeScript estrito,
   testes ligados aos arquivos tocados, teste ao lado de arquivo novo com
   lógica, código morto e duplicado.
3. **Prova em runtime.** Mudou tela, rode `quality-kit verify --changed`; as
   telas e como abri-las estão em `{map}`.

Toda tarefa começa pela skill `task` (o roteador), que escolhe um dos seus
playbooks (`bug-fix`, `feature`, `refactor`, `perf`, `investigation`). Os
comandos reais do projeto estão em `.quality/PLAYBOOKS.md`.

Antes de dizer que terminou, rode `quality-kit gate` (se não estiver no PATH:
`node ~/.quality-kit/kit/bin/quality-kit.mjs gate`) e corrija o que ele
reprovar. No Claude Code o hook Stop já faz isso e não deixa o turno acabar
reprovado; no Codex não há hook, então as travas são os hooks do git e o CI.

A régua (`.quality/config.json`, `lint-extra.cjs`, a baseline, os hooks e o
workflow) é decisão humana: o gate reprova qualquer mudança nela até alguém
rodar `quality-kit rules accept` num terminal. Não desligue regra por
comentário nem suprima em massa: conserte o código.
<!-- quality-kit:end -->
