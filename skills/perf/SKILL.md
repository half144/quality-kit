---
name: perf
description: Playbook de performance do quality-kit, escolhido pelo roteador task. Use quando algo está lento, pesado ou pulando - carregamento de página, troca de tela, LCP, INP, CLS, nota do Lighthouse, consulta que lê demais, lista grande, bundle pesado. Medir antes e depois; sem medição, a mudança não entra.
---

# perf

Copie estes passos para a lista de tarefas antes de começar (ver `task`).
Leia antes as regras de performance do projeto, se houver (AGENTS.md,
PLAYBOOKS.md da régua).

1. **Escolher a medida** que a pessoa sente, no celular:

   | Sintoma | Medida |
   | --- | --- |
   | Carregamento de página | `npx -y lighthouse <url> --output=json --chrome-flags="--headless=new"`, mediana de 3 |
   | Resposta ao toque | Event Timing API (`PerformanceObserver` de `event`), não o tempo do `click()` do Playwright |
   | Consulta ao backend | documentos lidos e bytes devolvidos |
   | Bundle | tamanho do chunk da rota no build de produção |

2. **Medir o antes** em build de produção, com a base numa worktree à parte,
   alternando execuções A/B. Guarde a saída.
3. **Achar o gargalo com o trace**, não por palpite: tarefas longas, cascata de
   rede, o que o LCP espera. Famílias de hipótese: eliminar trabalho, adiar,
   reduzir o que vem, fatiar, cachear, adiantar pela intenção.
4. **Mudar uma coisa por vez.**
5. **Medir o depois** com o mesmo script, perfil e número de execuções.
   Mediana. Se não melhorou fora do ruído, desfaça.
6. **Registrar a regra** que a medição ensinou, com o número, onde o projeto
   guarda as regras de performance.
7. **Verificar:** `task/references/verificacao.md`; a tela continua certa
   (`quality-kit verify --changed`).

## Resposta

- Tabela antes e depois: medida, perfil, execuções, mediana.
- O gargalo em uma frase e a mudança que o tirou.
- Hipóteses que não ganharam, com o número.
