# Verificação: provar que funciona

Todo playbook termina aqui. A escada de confiança tem três degraus, e cada um
pega o que o anterior deixa passar:

1. **Estrutura.** A régua de pastas (`ARCHITECTURE.md` da régua) e o checker
   impedem o erro antes de ele existir.
2. **Análise estática.** TypeScript estrito, lint com tipos e zero warning,
   testes ligados, teste ao lado de arquivo novo, knip e jscpd.
3. **Prova em runtime.** Rodar o artefato de verdade e olhar o resultado.

## Degraus 1 e 2: o gate (sempre)

```
quality-kit gate                   tudo, nos arquivos que a branch tocou
quality-kit gate --profile fast    só estrutura, teste ao lado e dívida
```

No Claude Code o hook Stop já roda o gate e não deixa o turno acabar
reprovado. **No Codex não há hook:** rode `quality-kit gate` você mesmo antes de
dizer que terminou; os hooks do git e o CI cobram de qualquer jeito.

Reprovou: conserte o código. `eslint-disable` em regra de qualidade,
`--suppress-all`, `!` ou `as` para calar o tipo, `--no-verify` e editar a régua
não são saída: a trava de integridade reprova a régua alterada até um humano
aceitar.

## Degrau 3: a prova que bate com o que mudou

| Mudou | Prova |
| --- | --- |
| Tela (componente, estilo, rota) | `quality-kit verify --changed` antes de encerrar. As telas e o caminho de demonstração estão no `FEATURE_MAP.md` da régua; tela nova entra no mapa (skill `map`). Olhe as capturas, não só o relatório. |
| Backend, função, script | O teste ao lado, rodando, e o comando de verdade uma vez (a função chamada, o script executado). |
| Performance | A medição do playbook `perf`, antes e depois, no mesmo ambiente. |
| Só documentação | Leia o texto e confira que todo comando citado existe. |

Se a prova falhar, desconfie primeiro do método de observação (a URL certa? o
build novo? o dado semeado?), depois do código.

## A resposta

- Cole a saída que prova, literal.
- Rotule cada afirmação: **medido** (rodou e viu), **inferido** (leu o código)
  ou **palpite**.
- Não passe para a pessoa uma checagem que você mesmo podia rodar.
