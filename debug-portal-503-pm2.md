# Debug: portal-503-pm2

Status: [OPEN]

## Sintoma
- Usuário relata erro recorrente no frontend: “Servidor de produção indisponível (HTTP 503). Contate TI para reiniciar PM2.”
- Frequência: diária

## Escopo
- Ambiente: produção (Apache 8444 → backend Node/Nest via PM2)
- Impacto: login/uso do portal intermitente quando backend está fora do ar

## Hipóteses (falsificáveis)
1) O processo PM2 do backend está caindo por OOM (memória) e reinicia/para.
2) O processo está saindo por exceção não tratada (crash) em rotina agendada (scheduler/jobs).
3) O processo fica “vivo” no PM2, mas deixa de responder (deadlock / event loop travado) e o Apache retorna 503.
4) Há reinício automático do host/serviço (janela de manutenção) e o PM2 não está com startup/persistência corretos.
5) Há saturação de recursos (CPU/IO) no horário do erro (importações/rotinas) e o backend não atende a tempo.

## Evidências a coletar
- pm2 status, restarts, uptime, memory/CPU
- logs do PM2 (stdout/stderr) no período do erro
- logs do Apache (503/connection refused)
- journalctl (reboots, OOM-killer, node crashes)

## Decisões
- Nenhuma alteração em produção sem autorização explícita do usuário.

