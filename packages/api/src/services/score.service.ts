import { format, subDays } from 'date-fns';
import { scoreRepository, sessaoRepository } from '../repositories';
import * as habitoService from './habito.service';

export async function obterScoreHoje(userId: string) {
  const today = format(new Date(), 'yyyy-MM-dd');
  return scoreRepository.findByDate(userId, today);
}

export async function obterHistorico(userId: string, days: number = 30) {
  const today = new Date();
  const start = format(subDays(today, days), 'yyyy-MM-dd');
  const end = format(today, 'yyyy-MM-dd');
  return scoreRepository.findByDateRange(userId, start, end);
}

export async function calcularStreak(userId: string) {
  const today = new Date();
  const start = format(subDays(today, 60), 'yyyy-MM-dd');
  const end = format(today, 'yyyy-MM-dd');

  const scores = await scoreRepository.findByDateRange(userId, start, end);
  const scoreMap = new Map(scores.map((s) => [s.data, s.score]));

  let streak = 0;

  // If today's score hasn't been calculated yet, start from yesterday
  const todayStr = format(today, 'yyyy-MM-dd');
  const startFrom = scoreMap.has(todayStr) ? 0 : 1;

  for (let i = startFrom; i <= 60; i++) {
    const dateStr = format(subDays(today, i), 'yyyy-MM-dd');
    const score = scoreMap.get(dateStr) ?? 0;
    if (score >= 60) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export async function calcularScoreDiario(userId: string) {
  const today = format(new Date(), 'yyyy-MM-dd');

  // Treino: 50 pts if any sessao concluida today
  const sessoes = await sessaoRepository.findByUserAndDateRange(userId, today, today);
  const treinoConcluido = sessoes.some((s) => s.concluido);
  const pts_treino = treinoConcluido ? 50 : 0;

  // Habitos: 50 pts if >= 80% done
  const percentualHabitos = await habitoService.calcularPercentualDia(userId);
  const pts_habitos = percentualHabitos.percentual >= 80 ? 50 : 0;

  const score = pts_treino + pts_habitos;

  return {
    data: today,
    score,
    pts_treino,
    pts_habitos,
    pts_agua: 0,
    pts_calorias: 0,
    pts_medicamentos: 0,
  };
}

export async function salvarScore(userId: string) {
  const breakdown = await calcularScoreDiario(userId);
  return scoreRepository.upsert(userId, breakdown);
}

export async function obterConquistas(userId: string) {
  return scoreRepository.findConquistas(userId);
}

export async function verificarConquistas(userId: string) {
  const [conquistas, streak, historico] = await Promise.all([
    scoreRepository.findConquistas(userId),
    calcularStreak(userId),
    obterHistorico(userId, 30),
  ]);

  const tiposExistentes = new Set(conquistas.map((c) => c.tipo));
  const novas: { tipo: string; titulo: string; descricao: string; icone: string }[] = [];

  if (streak >= 7 && !tiposExistentes.has('streak_7')) {
    novas.push({
      tipo: 'streak_7',
      titulo: 'Uma semana firme!',
      descricao: '7 dias consecutivos com score acima de 60',
      icone: '🔥',
    });
  }

  if (streak >= 30 && !tiposExistentes.has('streak_30')) {
    novas.push({
      tipo: 'streak_30',
      titulo: 'Um mês imbatível!',
      descricao: '30 dias consecutivos com score acima de 60',
      icone: '🏆',
    });
  }

  const temTreino = historico.some((s) => s.pts_treino > 0);
  if (temTreino && !tiposExistentes.has('primeiro_treino')) {
    novas.push({
      tipo: 'primeiro_treino',
      titulo: 'Primeira sessão!',
      descricao: 'Completou seu primeiro treino',
      icone: '💪',
    });
  }

  // Badge: habitos perfeitos (pts_habitos = 50 means >= 80%)
  const habitoPerfeito = historico.some((s) => s.pts_habitos >= 50);
  if (habitoPerfeito && !tiposExistentes.has('habitos_perfeito')) {
    novas.push({
      tipo: 'habitos_perfeito',
      titulo: 'Dia perfeito de hábitos!',
      descricao: 'Completou todos os hábitos do dia',
      icone: '⭐',
    });
  }

  const diaPerfeito = historico.some((s) => s.score >= 100);
  if (diaPerfeito && !tiposExistentes.has('dia_perfeito')) {
    novas.push({
      tipo: 'dia_perfeito',
      titulo: 'Dia perfeito!',
      descricao: 'Alcançou 100 pontos em um dia',
      icone: '💯',
    });
  }

  const criadas = await Promise.all(
    novas.map((c) => scoreRepository.createConquista(userId, c)),
  );

  return criadas;
}
