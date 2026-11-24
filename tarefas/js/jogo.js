// Gamificação da Central (visual): sequência de dias com o mínimo batido, trilha da semana, anel do dia e conquistas.
// Usa só números que já existem — dias fechados (dias_consultora) + o dia de hoje (meu_dia). Não cria pontos nem regra
// nova: o mínimo continua sendo o piso do dia; depois dele vêm os círculos extras.
// Puro: testado em tests/jogo.test.js.

import { hojeSP } from './regras.js?v=20261124195352';

const DIA = 864e5;
const t = (s) => Date.parse(`${s}T12:00:00Z`);
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const somar = (s, n) => iso(t(s) + n * DIA);
const segundaDe = (s) => { const d = new Date(t(s)).getUTCDay(); return somar(s, d === 0 ? -6 : 1 - d); };

// ── Sequência 🔥, escudos 🛡️ e chama que evolui (pedido de 18/11/2026) ──
// Dia útil com o mínimo batido soma 1. Folga/falta/atestado (trabalhou=false) e dia sem mínimo não contam nem quebram.
// A cada 13 dias seguidos ela ganha um ESCUDO (guarda no máximo 2). Num dia sem o mínimo, um escudo é gasto sozinho e a
// sequência continua (o dia não soma). Sem escudo, a sequência volta a zero. O escudo protege SÓ a sequência do jogo:
// o dia sem mínimo continua pedindo justificativa normalmente.
export const ESCUDO_A_CADA = 13;   // 19/11: separado do Imparável (12) e da chama azul (11) — um prêmio por dia
export const ESCUDOS_MAX = 2;
export const CHAMAS = [
  { min: 0, id: 'apagada', nome: 'Chama apagada' }, { min: 1, id: 'acesa', nome: 'Chama acesa' },
  { min: 6, id: 'forte', nome: 'Chama forte' }, { min: 11, id: 'azul', nome: 'Chama azul' },
  { min: 25, id: 'roxa', nome: 'Chama roxa' }, { min: 40, id: 'lendaria', nome: 'Chama lendária' },
];
export const chamaDe = (n) => [...CHAMAS].reverse().find((c) => n >= c.min);

// Dia que conta no jogo: trabalhou e tinha mínimo — ou ficou sem mínimo porque ela ADIANTOU tudo (adiantou = true, desde
// 24/11/2026: conta como dia cumprido, soma na sequência e no "4 de 5"). Dia sem lista nenhuma continua neutro.
export const contaNoJogo = (d) => !!d.trabalhou && (d.minimo > 0 || !!d.adiantou);
const cumpriu = (d) => !!d.bateu || !!d.adiantou;

// dias: [{ data, minimo, feitos, bateu, trabalhou, adiantou }] fechados (hoje nunca está aqui — fecha às 23h55); hojeInfo { feitos, minimo }.
// Devolve o estado de cada dia (bateu | protegido | quebrou), os eventos (ganhou/usou escudo) e os próximos prêmios.
export function caminhoSequencia(dias, hojeInfo = null) {
  const validos = [...dias].filter(contaNoJogo).map((d) => ({ ...d, bateu: cumpriu(d) })).sort((a, b) => a.data.localeCompare(b.data));
  const bateuHoje = !!hojeInfo && hojeInfo.minimo > 0 && hojeInfo.feitos >= hojeInfo.minimo;
  if (bateuHoje) validos.push({ data: '9999-12-31', hoje: true, bateu: true });
  let atual = 0, escudos = 0, recorde = 0;
  const estados = {}, eventos = [];
  for (const d of validos) {
    if (d.bateu) {
      atual++;
      if (atual % ESCUDO_A_CADA === 0 && escudos < ESCUDOS_MAX) { escudos++; eventos.push({ data: d.data, tipo: 'ganhou', seq: atual, hoje: !!d.hoje }); }
      estados[d.data] = 'bateu';
    } else if (escudos > 0) {
      escudos--; estados[d.data] = 'protegido'; eventos.push({ data: d.data, tipo: 'usou', seq: atual });
    } else {
      if (atual >= 3) eventos.push({ data: d.data, tipo: 'quebrou', seq: atual });
      atual = 0; estados[d.data] = 'quebrou';
    }
    recorde = Math.max(recorde, atual);
  }
  // próximos prêmios do caminho: escudo (a cada 13) e cada cor nova de chama
  const proximos = [];
  const proxEscudo = (Math.floor(atual / ESCUDO_A_CADA) + 1) * ESCUDO_A_CADA;
  proximos.push({ dias: proxEscudo, falta: proxEscudo - atual, icone: '🛡️',
    premio: escudos >= ESCUDOS_MAX ? 'escudo (você já guarda o máximo de 2)' : 'um escudo para a sequência' });
  for (const c of CHAMAS) if (c.min > atual) proximos.push({ dias: c.min, falta: c.min - atual, icone: '🔥', premio: c.nome.toLowerCase(), chama: c.id });
  proximos.sort((a, b) => a.falta - b.falta);
  return {
    atual, recorde, escudos, estados, eventos, bateuHoje,
    emJogo: !!hojeInfo && hojeInfo.minimo > 0 && !bateuHoje && atual > 0,
    chama: chamaDe(atual), proximos: proximos.slice(0, 3),
  };
}

// Compatível com as telas antigas: { atual, bateuHoje, emJogo, recorde } (+ escudos e chama)
export const sequencia = (dias, hojeInfo = null) => caminhoSequencia(dias, hojeInfo);

export function recorde(dias) {
  let melhor = 0, corrida = 0;
  for (const d of [...dias].sort((a, b) => a.data.localeCompare(b.data))) {
    if (!contaNoJogo(d)) continue;
    corrida = cumpriu(d) ? corrida + 1 : 0;
    melhor = Math.max(melhor, corrida);
  }
  return melhor;
}

// Segunda a sexta da semana de hoje: estado de cada dia para a trilha (bolinhas).
// 'bateu' | 'nao' | 'folga' | 'hoje' | 'hoje-ok' | 'futuro' | 'livre' (passado sem fechamento: feriado ou sem lista)
export function trilhaSemana(dias, hoje, hojeInfo = null, estados = {}) {
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
      estado = !d ? 'livre' : !d.trabalhou ? 'folga' : !contaNoJogo(d) ? 'livre' : cumpriu(d) ? 'bateu' : estados[data] === 'protegido' ? 'protegido' : 'nao';
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

// ── Níveis do dia (opção D escolhida em 19/11/2026: nomes divertidos + barra + recorde) ──
// 1º nível = o mínimo (piso). Depois, cada nível soma metade do mínimo (pelo menos 3 contatos). O último é "Lista zerada":
// não dá para pedir mais contatos do que existem. disponivel = contatos ainda pendentes nas listas dela.
// Os nomes NÃO repetem os das medalhas (Embalada, Imparável…).
// Quantidades (19/11/2026): cada nível é uma fração de TUDO o que ela tem pendente hoje nas listas, para puxar a zerar
// a lista o quanto antes — 1/3, metade, 3/4 e tudo. Lista que vence hoje entra inteira em todos (nunca abaixo do mínimo).
export const NIVEIS_DIA = [
  { nome: 'Mínimo', icone: '✓', desc: 'para não atrasar nenhuma lista' },
  { nome: 'No pique', icone: '💪', fracao: 1 / 3, desc: '1/3 das suas listas' },
  { nome: 'Pegando fogo', icone: '🔥', fracao: 1 / 2, desc: 'metade das suas listas' },
  { nome: 'Voando', icone: '✈️', fracao: 3 / 4, desc: '3/4 das suas listas' },
];
const ZERADA = { nome: 'Lista zerada', icone: '🏁', desc: 'todas as suas listas' };
const nivelDia = (k) => NIVEIS_DIA[Math.min(k, NIVEIS_DIA.length - 1)];

// Maior número de contatos num dia fechado (o recorde pessoal; hoje ainda não conta — fecha às 23h55)
export const recordeDoDia = (dias) => dias.reduce((m, d) => Math.max(m, d.feitos || 0), 0);

// listas: as de meu_dia ({ faltam_inicio, minimo }). Sem listas (testes antigos), sobe de metade do mínimo em metade.
export function circulos(feitos, minimo, disponivel = Infinity, listas = null) {
  if (!minimo) return null;
  const passo = Math.max(3, Math.ceil(minimo / 2));
  const teto = feitos + Math.max(0, disponivel);
  let alvos, nomes;
  if (listas?.length) {
    const nivel = (f) => listas.reduce((s, l) => s + Math.max(l.minimo || 0, Math.ceil((l.faltam_inicio || 0) * f)), 0);
    const zerar = Math.max(teto, listas.reduce((s, l) => s + (l.faltam_inicio || 0), 0));
    const brutos = [[minimo, NIVEIS_DIA[0]], ...NIVEIS_DIA.slice(1).map((n) => [nivel(n.fracao), n]), [zerar, ZERADA]];
    alvos = []; nomes = [];
    for (const [a, n] of brutos) {   // nível que dá igual (ou menos) que o anterior não aparece; "Lista zerada" sempre fica
      if (alvos.length && a <= alvos[alvos.length - 1]) { if (n === ZERADA) { nomes[nomes.length - 1] = n; } continue; }
      alvos.push(Math.min(a, zerar)); nomes.push(n);
    }
  } else {
    alvos = [minimo];
    while (alvos[alvos.length - 1] < teto && alvos.length < 60) alvos.push(Math.min(alvos[alvos.length - 1] + passo, teto));
  }
  let k = alvos.findIndex((a) => feitos < a);
  const tudo = k === -1;
  if (tudo) k = alvos.length - 1;
  const alvo = alvos[k], ini = k ? alvos[k - 1] : 0;
  const finalZerar = Number.isFinite(disponivel) && teto > minimo;
  const niveis = alvos.map((a, j) => ({ alvo: a, ...(nomes ? nomes[j] : finalZerar && j === alvos.length - 1 ? ZERADA : nivelDia(j)) }));
  const completos = tudo ? alvos.length : k;
  return {
    niveis, proximo: tudo ? null : niveis[k], atingido: completos ? niveis[completos - 1] : null,
    nivel: k + 1, completos, alvo, ini, passo,
    pct: tudo ? 100 : Math.max(0, Math.round((100 * (feitos - ini)) / (alvo - ini))),
    falta: tudo ? 0 : alvo - feitos,
    bateuMinimo: feitos >= minimo,
    zerou: Number.isFinite(disponivel) && disponivel <= 0 && feitos >= minimo,
    ultimo: k === alvos.length - 1 && teto > minimo,   // o círculo em andamento é o de zerar as listas
  };
}

// Contatos ainda pendentes nas listas dela, a partir de meu_dia (a Lista a fazer entra pelo campo próprio se ainda não
// estiver entre as listas do mínimo — ela passou a contar no mínimo em 19/11/2026).
export function disponivelDe(d) {
  const nasListas = (d.listas || []).reduce((s, l) => s + (l.faltam_agora || 0), 0);
  return nasListas + ((d.listas || []).some((l) => l.controle_id === 'lista_fazer') ? 0 : d.lista_fazer || 0);
}

// ── Conquistas do mês (temporada) ──
// Valem só no mês: no mês seguinte a medalha do mês anterior fica "em defesa" e só continua se for conquistada de novo.
// Três níveis (Bronze, Prata, Ouro). Calibrado em 18/11/2026 com o histórico real (20 a 40 contatos nos dias com lista).
// Cada degrau é uma medalha com nome (pedido de 18/11/2026: "Embalada, Semana em chamas, Imparável, Lenda" motiva
// mais que Bronze/Prata/Ouro). A cor do degrau: 1 bronze, 2 prata, 3 ouro, 4 lendária.
export const FAMILIAS = [
  { id: 'seq', icone: '🔥', nome: 'Sequência', unid: 'dias úteis seguidos com o mínimo no mês', niveis: [3, 5, 12, 18],   // 18/11: ele definiu 3/5/12/18
    medalhas: [['🌀', 'Embalada'], ['🔥', 'Semana em chamas'], ['⚡', 'Imparável'], ['🏆', 'Lenda da Positiva']], medida: 'dias seguidos', medidaUm: 'dia seguido' },
  { id: 'contatos', icone: '💬', nome: 'Volume', unid: 'contatos no mês', niveis: [150, 300, 500],
    medalhas: [['💬', 'Aquecimento'], ['🥁', 'Ritmo forte'], ['🏃‍♀️', 'Maratonista']], medida: 'contatos', medidaUm: 'contato' },
  { id: 'resultados', icone: '🌟', nome: 'Resultados', unid: 'contatos que deram certo no mês', niveis: [20, 50, 100],
    medalhas: [['🌟', 'Fez a diferença'], ['🛟', 'Resgatadora'], ['💎', 'Transformadora']], medida: 'resultados', medidaUm: 'resultado' },
  { id: 'semanas', icone: '🏅', nome: 'Semanas perfeitas', unid: 'semanas com o mínimo em todos os dias', niveis: [1, 2, 3],
    medalhas: [['🏅', 'Semana perfeita'], ['✌️', 'Dose dupla'], ['🎖️', 'Trinca perfeita']], medida: 'semanas', medidaUm: 'semana' },
  { id: 'dobro', icone: '🚀', nome: 'Dobradinha', unid: 'dias com o dobro do mínimo (mínimo de 5 ou mais)', niveis: [2, 5, 8],
    medalhas: [['⏩', 'Dobradinha'], ['💨', 'Turbinada'], ['🚀', 'Foguete']], medida: 'dias', medidaUm: 'dia' },
  { id: 'impecavel', icone: '👑', nome: 'Mês impecável', unid: 'mínimo batido em todos os dias do mês (12 dias ou mais)', niveis: [1],
    medalhas: [['👑', 'Mês impecável']], medida: '', soOuro: true },
];
export const TOTAL_MEDALHAS = FAMILIAS.reduce((s, f) => s + f.niveis.length, 0);
const MESES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const nomeDoMes = (ym) => MESES_NOME[+ym.slice(5, 7) - 1];
const mesAnterior = (ym) => { const [a, m] = ym.split('-').map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`; };
const ultimoDiaDoMes = (ym) => iso(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0) + 12 * 3600e3);

// Números de um mês. dias: fechados (+ hoje, se for o mês atual); res: datas (AAAA-MM-DD) dos resultados; fechado: o mês acabou
function metricasDoMes(dias, res, fechado, hoje, estados = {}) {
  const validos = dias.filter(contaNoJogo).map((d) => ({ ...d, bateu: cumpriu(d) })).sort((a, b) => a.data.localeCompare(b.data));
  let seq = 0, corrida = 0;
  for (const d of validos) {
    if (d.data === hoje && !d.bateu) continue;   // hoje ainda em andamento não quebra
    if (!d.bateu && estados[d.data] === 'protegido') continue;   // o escudo segurou a sequência nesse dia
    corrida = d.bateu ? corrida + 1 : 0; seq = Math.max(seq, corrida);
  }
  const semanaAtual = hoje ? segundaDe(hoje) : null;
  const porSemana = {};
  for (const d of validos.filter((x) => x.data !== hoje)) (porSemana[segundaDe(d.data)] ||= []).push(d);
  const semanas = Object.entries(porSemana).filter(([seg, ds]) => seg !== semanaAtual && ds.length >= 4 && ds.every((d) => d.bateu)).length;
  const fechadosValidos = validos.filter((d) => d.data !== hoje);
  return {
    seq, semanas,
    contatos: dias.reduce((s, d) => s + (d.feitos || 0), 0),
    resultados: res.length,
    dobro: validos.filter((d) => d.minimo >= 5 && d.feitos >= 2 * d.minimo).length,
    impecavel: fechado && fechadosValidos.length >= 12 && fechadosValidos.every((d) => d.bateu) ? 1 : 0,
    semFalhar: fechadosValidos.every((d) => d.bateu), diasValidos: fechadosValidos.length,
  };
}
const nivelDe = (f, v) => f.niveis.filter((n) => v >= n).length;   // 0 = nenhum
const rotuloNivel = (f, n) => f.medalhas[n - 1][1];

// dias: dias fechados; hojeInfo { feitos, minimo }; resultados: [{ quando }]. Devolve o mês atual, com defesa do anterior.
export function conquistasDoMes(dias, hoje, hojeInfo = null, resultados = []) {
  const ym = hoje.slice(0, 7), antes = mesAnterior(ym);
  const comHoje = hojeInfo && hojeInfo.minimo > 0
    ? [...dias.filter((d) => d.data !== hoje), { data: hoje, minimo: hojeInfo.minimo, feitos: hojeInfo.feitos, bateu: hojeInfo.feitos >= hojeInfo.minimo, trabalhou: true }]
    : dias;
  const resDatas = resultados.filter((r) => r.quando).map((r) => hojeSP(new Date(r.quando)));
  const { estados } = caminhoSequencia(dias.filter((d) => d.data !== hoje), null);
  const doMes = (m) => metricasDoMes(comHoje.filter((d) => d.data.startsWith(m)), resDatas.filter((x) => x.startsWith(m)), m < ym, hoje, estados);
  const agora = doMes(ym), passado = doMes(antes);
  // histórico: em quantos meses fechados ganhou cada uma (melhor nível)
  const meses = [...new Set([...comHoje.map((d) => d.data.slice(0, 7)), ...resDatas.map((x) => x.slice(0, 7))])].filter((m) => m < ym);
  const hist = Object.fromEntries(FAMILIAS.map((f) => [f.id, meses.map((m) => nivelDe(f, doMes(m)[f.id])).filter((n) => n > 0)]));
  const fimDoMes = ultimoDiaDoMes(ym);
  const lista = FAMILIAS.map((f) => {
    const valor = agora[f.id], nivel = nivelDe(f, valor), nivelAntes = nivelDe(f, passado[f.id]);
    const prox = f.niveis[nivel];
    const n = prox != null ? prox - valor : 0;
    let falta = prox != null ? `${n === 1 ? 'Falta' : 'Faltam'} ${n} ${n === 1 ? f.medidaUm : f.medida} para ${rotuloNivel(f, nivel + 1)}` : 'Todas as deste tema! 🎉';
    if (f.id === 'impecavel') falta = !agora.semFalhar ? 'Neste mês não dá mais: teve dia sem o mínimo' : `Em jogo: ${agora.diasValidos} dia(s) sem falhar — vale no fim do mês`;
    return { ...f, valor, nivel, nivelAntes, rotulo: nivel ? rotuloNivel(f, nivel) : null, falta,
      progresso: prox != null ? Math.min(1, valor / prox) : 1,
      emDefesa: nivelAntes > nivel,   // ganhou mais no mês passado: precisa reconquistar até o fim do mês
      defesa: nivelAntes > nivel ? `Defenda "${rotuloNivel(f, nivelAntes)}" de ${nomeDoMes(antes)}: ${f.soOuro ? 'repita o mês sem falhas' : `chegue a ${f.niveis[nivelAntes - 1]} ${f.medida} até ${fimDoMes.slice(8, 10)}/${fimDoMes.slice(5, 7)}`}` : null,
      vezes: hist[f.id].length };
  });
  const proxima = lista.filter((c) => c.nivel < c.niveis.length && !(c.id === 'impecavel'))
    .sort((a, b) => b.progresso - a.progresso)[0] || null;
  return { mes: nomeDoMes(ym), mesAntes: nomeDoMes(antes), lista, ganhas: lista.reduce((s, c) => s + c.nivel, 0), total: TOTAL_MEDALHAS,
    emDefesa: lista.filter((c) => c.emDefesa), proxima, fimDoMes };
}

// Frase do placar do dia, conforme os círculos (troca de texto a cada dia para não ficar repetitiva).
export function fraseDoDia(c, seq, hoje) {
  const n = Math.round(t(hoje) / DIA);
  const pick = (xs) => xs[((n % xs.length) + xs.length) % xs.length];
  const contatos = (n) => `${n} ${n === 1 ? 'contato' : 'contatos'}`;
  if (c.zerou) return 'Não sobrou ninguém para chamar hoje. Dia completo! 🏁';
  if (c.bateuMinimo && c.proximo) return `Faltam ${contatos(c.falta)} para ${c.proximo.icone} ${c.proximo.nome}${c.proximo.desc ? ` (${c.proximo.desc} hoje)` : ''}.`;
  if (seq.emJogo && seq.escudos) return `Sua sequência de ${seq.atual} dias 🔥 está em jogo (você tem ${seq.escudos === 1 ? '1 escudo' : '2 escudos'} 🛡️ de reserva). Faltam ${contatos(c.falta)}.`;
  if (seq.emJogo) return `Sua sequência de ${seq.atual} ${seq.atual === 1 ? 'dia' : 'dias'} 🔥 está em jogo: faltam ${contatos(c.falta)} para mantê-la.`;
  if (c.pct === 0) return pick(['Primeiro contato do dia é o mais difícil. Depois embala!', 'Bora começar? Um toque no WhatsApp e o dia anda.']);
  if (c.pct >= 70) return `Reta final: só ${contatos(c.falta)} para o mínimo!`;
  return pick(['Um de cada vez: cada contato conta.', `Você já fez ${c.pct}% do mínimo. Segue o ritmo!`]);   // o título já diz quanto falta
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
  return { total: validos.length, semana: semana.length, porTipo, recentes: semana, novos, ultimo };
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
