---
name: verify
description: Prova na tela do quality-kit. Use quando a mudança mexe em tela (componente, estilo, rota), quando o gate cobrar "Prova na tela", ou quando pedirem "abre a tela e confere", "prova que funciona", "verifica no navegador", "roda o verify". Sobe o app com o comando da régua, abre as telas afetadas em desktop e celular (iPhone 14), reprova erro de console, exceção, hidratação, asset quebrado e tela vazia, e grava o relatório que o gate confere.
---

# verify: prova na tela

Build e teste verdes não provam que a tela abre. O `quality-kit verify` abre.

1. **Deduzir as telas:** `quality-kit verify --changed` usa o mapa de telas
   (`FEATURE_MAP.md` da régua) e o grafo de imports para achar as telas que a
   branch afeta. Para telas explícitas: `quality-kit verify /conta web:/painel`
   (sem prefixo é o primeiro app da config). `--all` abre todas as do mapa.
2. **Rodar e ler a saída.** Cada tela abre em desktop e celular. Reprova:
   erro de console, exceção, erro de hidratação, 4xx/5xx de asset do próprio
   site, navegação que não completa e tela sem texto.
3. **Olhar as capturas** na pasta que o comando imprime. Relatório aprovado com
   a tela errada não é prova: confira que a captura mostra o que a mudança
   devia mostrar.
4. **Reprovou:** desconfie do método primeiro (o caminho de demonstração tem
   dado? o app subiu com o env certo? veja o log do servidor na mesma pasta),
   depois corrija o código e rode de novo.
5. O relatório vale para o estado dos arquivos em que rodou: mudou um arquivo,
   rode de novo. O gate só libera com o relatório aprovado para o estado atual.

Tela nova, ou caminho de demonstração que mudou: use a skill `map` antes.
Como subir o app (comando, build, env) fica em `verify.apps` da config da
régua; mudar isso é mudar a régua (humano aceita).
