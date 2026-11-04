# stack-decision — meudia-saude-treino

## Decisão de branch (Astro Chief, 04/11/2026)
- Branch nova `feat/saude-treino` a partir de `a618475` (cabeça do PR #27 https://github.com/Estevamjd/MeuDia/pull/27), com PR draft novo empilhado sobre ele.
- Motivo: o Estevam quer "atualizar tudo e depois publicar"; o #27 já tem QA aprovado e fica isolado.
- Os dois são publicados juntos só com o OK do Estevam.
- Situação: branch criada só LOCAL em /home/box/repos/meudia-ci. **Push e PR draft aguardando o OK do Estevam.**

## Qual IA fez cada parte (F1)
- Análise de código e redação do PLANO-F1.md: Claude Code CLI local (`claude -p`).
- Medição do Supabase (só leitura): Astro Backend, via conector Supabase (MEDICAO-SUPABASE-F1.md).
- Orquestração, revisão contra 02-DoD/03-ANTI e este registro: Astro Backend.

## Execução F1 (04/11/2026, ~20:31–20:39 BRT)
- PLANO-F1.md escrito pelo Claude Code CLI (`claude -p`, sem permissão de rede/banco; repo intacto em a618475). Uma primeira execução foi interrompida e refeita para incluir os acréscimos do Chief/Prompt Engineer (anexos TACO e onboarding); nenhuma outra IA substituiu o Claude Code.
- Revisão contra 02-DoD e 03-ANTI: Astro Backend.

## Decisões aprovadas pelo Estevam (04/11/2026, ~20:50 BRT)
- Plano F1 aprovado com as sugestões: fatores de atividade 1,40 / 1,70 / 2,00 (FAO 2004, borda de baixo), superávit de +10% para ganho, lembretes com horário via GitHub Actions.
- Visual escolhido: B · Caderno.
- Push da branch feat/saude-treino e PR draft empilhado sobre a #27 aprovados (sem merge).
