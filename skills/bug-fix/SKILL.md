---
name: bug-fix
description: Playbook de correção de bug do quality-kit, escolhido pelo roteador task. Use quando algo que funcionava, ou devia funcionar, está errado - erro na tela, dado errado, crash, teste quebrado, regressão. Reproduzir primeiro, escrever o teste que falha, corrigir na causa raiz e provar na mesma superfície onde o bug apareceu.
---

# bug-fix

Copie estes passos para a lista de tarefas antes de começar (ver `task`).

1. **Reproduzir você mesmo**, na superfície onde o bug aparece: a tela
   (`quality-kit verify <caminho>` com o caminho de demonstração do mapa, ou o
   app rodando), a função num teste, o script. Se o gatilho é raro (fuso,
   volume, celular, conexão lenta), force-o. Anote o comando e a saída.
2. **Achar a causa, não o sintoma.** Liste hipóteses pelo caminho do dado e
   elimine uma a uma com evidência de runtime (teste, log temporário, consulta),
   não por leitura. Só avance quando souber o mecanismo: "X chega como Y porque Z".
3. **Escrever o teste que falha**, ao lado do arquivo da causa. Ele tem que
   falhar pelo motivo certo: rode e confira a mensagem. Cubra a borda vizinha
   que o mesmo mecanismo quebraria. Se o bug só existe na tela, a prova do
   passo 6 faz esse papel; registre isso.
4. **Corrigir na causa raiz**, com o menor diff que elimina o mecanismo. Nada
   de guarda no consumidor para esconder dado errado do produtor, `try/catch`
   que engole, `setTimeout` ou `!important`. Se a causa está em código
   compartilhado, confira os outros chamadores.
5. **Ver o teste passar**, e a suíte do workspace inteira.
6. **Provar na mesma superfície.** Repita a reprodução do passo 1 e mostre que
   o erro sumiu.
7. **Verificar:** `task/references/verificacao.md`.
8. **Commit** com a causa na mensagem, não só o sintoma.

## Resposta

- A causa em uma frase, com `arquivo:linha`.
- A saída do teste falhando e depois passando, literal.
- A prova do passo 6.
- O que ficou de fora e por quê.
