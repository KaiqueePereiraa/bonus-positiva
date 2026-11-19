// Gamificação da Central (visual): sequência de dias com o mínimo batido, trilha da semana, anel do dia e conquistas.
// Usa só números que já existem — dias fechados (dias_consultora) + o dia de hoje (meu_dia). Não cria pontos nem regra
// nova: o mínimo continua sendo o piso do dia, e o que passar dele aparece como "volta extra".
// Puro: testado em tests/jogo.test.js.

import { hojeSP } from './regras.js?v=20261118214522';

const DIA = 864e5;
const t = (s) => Date.parse(`${s}T12:00:00Z`);
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const somar = (s, n) => iso(t(s) + n * DIA);
const segundaDe = (s) => { const d = new Date(t(s)).getUTCDay(); return somar(s, d === 0 ? -6 : 1 - d); };

// dias: [{ data, minimo, feitos, bateu, trabalhou }] (qualquer ordem; hoje nunca está aqui — fecha às 23h55)
// hojeInfo: { feitos, minimo } de meu_dia. Dia de folga/falta/atestado (trabalhou=false) não quebra a sequência;
// dia sem mínimo (minimo=0) também não. Hoje só soma quando o mínimo já foi batido; enquanto não, não quebra.
export function sequencia(dias, hojeInfo = null) {
  const ord = [...dias].sort((a, b) => b.data.localeCompare(a.data));
  let atual = 0;
  for (const d of ord) {
    if (!d.trabalhou || d.minimo === 0) continue;
    if (!d.bateu) break;
    atual++;
  }
  const bateuHoje = !!hojeInfo && hojeInfo.minimo > 0 && hojeInfo.feitos >= hojeInfo.minimo;
  if (bateuHoje) atual++;
  return { atual, bateuHoje, emJogo: !!hojeInfo && hojeInfo.minimo > 0 && !bateuHoje && atual > 0, recorde: Math.max(recorde(dias), atual) };
}

export function recorde(dias) {
  let melhor = 0, corrida = 0;
  for (const d of [...dias].sort((a, b) => a.data.localeCompare(b.data))) {
    if (!d.trabalhou || d.minimo === 0) continue;
    corrida = d.bateu ? corrida + 1 : 0;
    melhor = Math.max(melhor, corrida);
  }
  return melhor;
}

// Segunda a sexta da semana de hoje: estado de cada dia para a trilha (bolinhas).
// 'bateu' | 'nao' | 'folga' | 'hoje' | 'hoje-ok' | 'futuro' | 'livre' (passado sem fechamento: feriado ou sem lista)
export function trilhaSemana(dias, hoje, hojeInfo = null) {
  const seg = segundaDe(hoje);
  const porData = Object.fromEntries(dias.map((d) => [d.data, d]));
  const NOMES = ['seg', 'ter', 'qua', 'qui', 'sex'];
  return NOMES.map((nome, k) => {
    const data = somar(seg, k);
    let estado;
    if (data > hoje) estado = 'futuro';
    else if (data === hoje) estado = hojeInfo && hojeInfo.minimo > 0 && hojeInfo.feitos >= hojeInfo.minimo ? 'hoje-ok' : 'hoje';
    else {
      const d = porData[data];
      estado = !d || d.minimo === 0 ? 'livre' : !d.trabalhou ? 'folga' : d.bateu ? 'bateu' : 'nao';
    }
    return { nome, data, estado };
  });
}

// Anel do dia: 1ª volta = o mínimo; o que passar vira volta extra (o mínimo é piso, não teto).
export function anel(feitos, minimo) {
  if (!minimo) return { pct: feitos > 0 ? 100 : 0, voltas: 0, extraPct: 0, extra: 0, falta: 0, bateu: feitos > 0 };
  const bateu = feitos >= minimo;
  const extra = Math.max(0, feitos - minimo);
  return {
    pct: Math.min(100, Math.round((100 * feitos) / minimo)),
    voltas: Math.floor(extra / minimo),
    extraPct: bateu ? Math.round((100 * (extra % minimo)) / minimo) : 0,
    extra,
    falta: Math.max(0, minimo - feitos),
    bateu,
  };
}

// Conquistas: tudo calculado do histórico de dias fechados + hoje. Cada uma diz quanto falta quando ainda está trancada.
const MARCOS_SEQ = [[3, 'Embalada', 'dias seguidos com o mínimo'], [5, 'Semana em chamas', 'dias seguidos com o mínimo'],
  [10, 'Imparável', 'dias seguidos com o mínimo'], [20, 'Lenda da Positiva', 'dias seguidos com o mínimo']];
const MARCOS_CONTATOS = [[50, 'Aquecimento', 'contatos feitos'], [200, 'Ritmo forte', 'contatos feitos'],
  [500, 'Maratonista', 'contatos feitos'], [1000, 'Mil contatos', 'contatos feitos']];

// resultados = contatos dela que deram certo (aluno voltou, pagou, matriculou, renovou), conferidos pela EVO
const MARCOS_RESULTADOS = [[1, '🌱', 'Primeiro resultado', 'Um contato seu deu certo'], [10, '🌟', 'Fez a diferença', '10 contatos que deram certo'],
  [50, '💎', 'Transformadora', '50 contatos que deram certo']];

export function conquistas(dias, hojeInfo = null, hoje = null, resultados = 0) {
  const seq = sequencia(dias, hojeInfo);
  const comHoje = hojeInfo ? [...dias, { data: '9999-12-31', minimo: hojeInfo.minimo, feitos: hojeInfo.feitos, bateu: hojeInfo.feitos >= hojeInfo.minimo, trabalhou: true }] : dias;
  const validos = comHoje.filter((d) => d.trabalhou && d.minimo > 0);
  const contatos = comHoje.reduce((s, d) => s + (d.feitos || 0), 0);
  const algumBateu = validos.some((d) => d.bateu);
  const dobrou = validos.some((d) => d.feitos >= 2 * d.minimo);
  // semana perfeita: uma semana (já fechada) com 3+ dias trabalhados e o mínimo batido em todos
  const semanas = {};
  const semanaAtual = hoje ? segundaDe(hoje) : null;   // a semana em andamento não conta (não dá para ganhar e perder)
  for (const d of dias.filter((x) => x.trabalhou && x.minimo > 0 && segundaDe(x.data) !== semanaAtual)) (semanas[segundaDe(d.data)] ||= []).push(d);
  const perfeita = Object.values(semanas).some((ds) => ds.length >= 3 && ds.every((d) => d.bateu));

  const lista = [
    { id: 'primeiro', icone: '⚡', nome: 'Primeiro mínimo', desc: 'Bateu o mínimo do dia pela 1ª vez', ok: algumBateu, falta: algumBateu ? '' : 'Bata o mínimo de hoje' },
    ...MARCOS_SEQ.map(([n, nome, txt]) => ({ id: `seq${n}`, icone: '🔥', nome, desc: `${n} ${txt}`, ok: seq.recorde >= n,
      progresso: Math.min(1, seq.atual / n), falta: `Faltam ${n - Math.min(n, seq.atual)} dia(s) seguidos` })),
    { id: 'perfeita', icone: '🏅', nome: 'Semana perfeita', desc: 'Mínimo batido em todos os dias de uma semana', ok: perfeita, falta: 'Bata o mínimo todos os dias da semana' },
    { id: 'dobro', icone: '🚀', nome: 'Dobrou o mínimo', desc: 'Fez o dobro do mínimo num dia', ok: dobrou,
      falta: hojeInfo?.minimo ? `Hoje: ${hojeInfo.feitos} de ${2 * hojeInfo.minimo}` : 'Faça o dobro do mínimo num dia',
      progresso: hojeInfo?.minimo ? Math.min(1, hojeInfo.feitos / (2 * hojeInfo.minimo)) : 0 },
    ...MARCOS_RESULTADOS.map(([n, icone, nome, desc]) => ({ id: `r${n}`, icone, nome, desc, ok: resultados >= n,
      progresso: Math.min(1, resultados / n), falta: `Faltam ${Math.max(0, n - resultados)} resultado(s)` })),
    ...MARCOS_CONTATOS.map(([n, nome, txt]) => ({ id: `c${n}`, icone: '💬', nome, desc: `${n} ${txt}`, ok: contatos >= n,
      progresso: Math.min(1, contatos / n), falta: `Faltam ${Math.max(0, n - contatos)} contatos` })),
  ];
  // a próxima a destravar: a trancada com mais progresso
  const proxima = lista.filter((c) => !c.ok).sort((a, b) => (b.progresso || 0) - (a.progresso || 0))[0] || null;
  return { lista, ganhas: lista.filter((c) => c.ok).length, proxima, contatos, sequencia: seq };
}

// Frase do placar do dia, conforme o andamento (troca de texto a cada dia para não ficar repetitiva).
export function fraseDoDia(a, seq, hoje) {
  const n = Math.round(t(hoje) / DIA);
  const pick = (xs) => xs[((n % xs.length) + xs.length) % xs.length];
  if (a.bateu && a.extra > 0) return pick([`+${a.extra} além do mínimo. Cada contato extra é aluno a mais na academia.`, `Volta extra: +${a.extra}. Quem passa do piso faz a diferença no mês.`]);
  if (a.bateu) return pick(['Agora é volta extra — o mínimo é só o piso.', 'Piso garantido ✅ Bora para a volta extra?']);
  if (seq.emJogo) return `Sua sequência de ${seq.atual} ${seq.atual === 1 ? 'dia' : 'dias'} 🔥 está em jogo: faltam ${a.falta} para mantê-la.`;
  if (a.pct === 0) return pick(['Primeiro contato do dia é o mais difícil. Depois embala!', 'Bora começar? Um toque no WhatsApp e o dia anda.']);
  if (a.pct >= 70) return `Reta final: só ${a.falta} para o mínimo!`;
  return pick([`Faltam ${a.falta} para o mínimo. Um de cada vez!`, `Você já fez ${a.pct}% do mínimo. Segue o ritmo!`]);
}

// ── Resultados: o que dá sentido ao trabalho é o contato que deu certo (não o toque no WhatsApp) ──
export const TIPOS_RESULTADO = {
  voltou: { icone: '🏋️', um: 'voltou a treinar', varios: 'voltaram a treinar' },
  pagou: { icone: '💳', um: 'pagou a mensalidade', varios: 'pagaram' },
  matriculou: { icone: '🎉', um: 'se matriculou', varios: 'se matricularam' },
  renovou: { icone: '🔁', um: 'renovou o contrato', varios: 'renovaram' },
};

// itens: [{ nome, resultado, quando (data/hora em que a EVO confirmou) }] — só os contatos DELA que deram certo.
// vistoAte: até quando ela já viu (para comemorar só os novos). Últimos 7 dias contando hoje.
export function resumoResultados(itens, hoje, vistoAte = null) {
  const desde = somar(hoje, -6);
  const validos = itens.filter((i) => TIPOS_RESULTADO[i.resultado] && i.quando);
  const semana = validos.filter((i) => hojeSP(new Date(i.quando)) >= desde).sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
  const porTipo = {};
  for (const i of semana) porTipo[i.resultado] = (porTipo[i.resultado] || 0) + 1;
  const novos = vistoAte ? validos.filter((i) => Date.parse(i.quando) > Date.parse(vistoAte)) : validos;
  const ultimo = validos.reduce((m, i) => (!m || Date.parse(i.quando) > Date.parse(m) ? i.quando : m), null);
  return { total: validos.length, semana: semana.length, porTipo, recentes: semana.slice(0, 6), novos, ultimo };
}

// Texto da comemoração de resultado novo
export function fraseResultado(novos) {
  if (!novos.length) return null;
  if (novos.length === 1) {
    const i = novos[0];
    return { titulo: 'Seu contato deu resultado!', texto: `${String(i.nome || '').split(' ')[0]} ${TIPOS_RESULTADO[i.resultado].um} depois da sua mensagem.` };
  }
  return { titulo: `${novos.length} contatos seus deram resultado!`, texto: 'Alunos voltaram, pagaram ou se matricularam depois da sua mensagem.' };
}

// ── Destaques do Desempenho: categorias diferentes para pessoas diferentes poderem brilhar (no lugar de pódio) ──
// lista/anterior: linhas de desempenho() do período e do período anterior de mesmo tamanho. Empate: todas aparecem.
export function destaques(lista, anterior = []) {
  const ant = Object.fromEntries(anterior.map((c) => [c.id, c]));
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const cats = [
    { id: 'constante', icone: '🎯', titulo: 'Mais constante', cand: lista.filter((c) => c.dias >= 2 && c.dias_bateu > 0)
      .map((c) => ({ c, v: c.dias_bateu / c.dias, v2: c.dias_bateu, texto: `${c.dias_bateu} de ${c.dias} dias com o mínimo` })) },
    { id: 'evoluiu', icone: '📈', titulo: 'Quem mais evoluiu', cand: lista.filter((c) => c.pct != null && ant[c.id]?.pct != null && c.pct > ant[c.id].pct)
      .map((c) => ({ c, v: c.pct - ant[c.id].pct, v2: c.pct, texto: `de ${ant[c.id].pct}% para ${c.pct}% do mínimo` })) },
    { id: 'resultados', icone: '🌟', titulo: 'Mais resultados', cand: lista.filter((c) => c.resultados > 0)
      .map((c) => ({ c, v: c.resultados, v2: 0, texto: `${plural(c.resultados, 'contato deu', 'contatos deram')} certo` })) },
  ];
  return cats.filter((k) => k.cand.length).map((k) => {
    k.cand.sort((a, b) => b.v - a.v || b.v2 - a.v2);
    const top = k.cand[0];
    const ganhadoras = k.cand.filter((x) => x.v === top.v && x.v2 === top.v2).slice(0, 3);
    return { id: k.id, icone: k.icone, titulo: k.titulo, quem: ganhadoras.map((x) => x.c), texto: top.texto };
  });
}

// Você contra você mesma (consultora): o período atual comparado com o anterior de mesmo tamanho.
export function voceVsVoce(eu, antes) {
  if (!eu) return null;
  const linha = (rotulo, agora, antes_, sufixo = '') => ({ rotulo, agora, antes: antes_, delta: agora != null && antes_ != null ? agora - antes_ : null, sufixo });
  return [
    linha('Mínimo cumprido', eu.pct, antes?.pct ?? null, '%'),
    linha('Dias com o mínimo', eu.dias_bateu, antes ? antes.dias_bateu : null),
    linha('Deram resultado', eu.resultados, antes ? antes.resultados : null),
  ];
}
