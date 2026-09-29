---
name: investigation
description: Playbook de investigação do quality-kit, escolhido pelo roteador task. Use para explicar como uma parte do sistema funciona, por que algo se comporta assim, onde uma coisa mora, qual o impacto de uma mudança ou quais as opções para um problema, sem mudar código. Só leitura e execução para observar; a saída é uma explicação com arquivo e linha.
---

# investigation

Copie estes passos para a lista de tarefas antes de começar (ver `task`).
Nenhum arquivo do repo muda neste playbook. Rodar para observar vale; editar
não. Se a conclusão pedir mudança, termine a explicação e diga qual playbook
segue.

1. **Fixar a pergunta** em uma frase, com o que conta como resposta.
2. **Achar a entrada:** a rota, o mapa de telas (`FEATURE_MAP.md` da régua), o
   endpoint, o schema.
3. **Seguir o dado** da entrada até a saída, anotando cada parada com
   `arquivo:linha`.
4. **Confirmar em runtime o que for decisivo.** Leitura dá hipótese; teste,
   consulta ou a tela aberta dão o fato. Rotule: medido, inferido ou palpite.
5. **Ler a história** quando o porquê não está no código: `git log -L`,
   `git log --follow`, o PR que trouxe.
6. **Verificar** que `git status` está limpo e que cada `arquivo:linha` citado
   existe.

## Resposta

- **Como funciona:** visão geral em duas linhas; o caminho do dado com
  `arquivo:linha`; onde as coisas moram; as armadilhas.
- **Opções:** tabela com opção, custo, risco e o que cada uma quebra, e a
  recomendação com o motivo.
