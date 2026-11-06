// Regras de negócio puras da Central de Tarefas (sem DOM, sem Supabase).
// Roda no navegador e no Node (testes em tests/regras.test.js).
// Datas são sempre strings 'AAAA-MM-DD' no fuso America/Sao_Paulo.

export const FUSO = 'America/Sao_Paulo';

// ── Texto ────────────────────────────────────────────────────────────────

export function semAcento(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// "Nº do celular " -> "no do celular"
export function normalizarCabecalho(s) {
  return semAcento(s).toLowerCase().replace(/º|°/g, 'o').replace(/\s+/g, ' ').trim();
}

export function normalizarNome(s) {
  return semAcento(s).toUpperCase().replace(/\s+/g, ' ').trim();
}

export function primeiroNome(nome) {
  const p = String(nome ?? '').trim().split(/\s+/)[0] || '';
  return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : '';
}

// ── Telefone e WhatsApp ──────────────────────────────────────────────────

// Devolve só dígitos com DDI 55, ou null se não for um celular/fixo brasileiro plausível.
export function normalizarTelefone(bruto) {
  let d = String(bruto ?? '').replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) return '55' + d;
  return null;
}

export function montarMensagem(modelo, { nome } = {}) {
  return String(modelo ?? '').replaceAll('{nome}', primeiroNome(nome));
}

// No computador abre direto no WhatsApp Web; no celular, o app.
export function linkWhatsApp(telefone, texto, { celular = false } = {}) {
  if (!telefone) return null;
  const t = encodeURIComponent(texto ?? '');
  return celular
    ? `https://wa.me/${telefone}?text=${t}`
    : `https://web.whatsapp.com/send?phone=${telefone}&text=${t}`;
}

// ── Datas ────────────────────────────────────────────────────────────────

export function hojeSP(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora);
}

function partes(ymd) {
  const [a, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function ymd(dt) {
  return dt.toISOString().slice(0, 10);
}

export function somarDias(data, n) {
  const dt = partes(data);
  dt.setUTCDate(dt.getUTCDate() + n);
  return ymd(dt);
}

// 0 = domingo … 6 = sábado
export function diaDaSemana(data) {
  return partes(data).getUTCDay();
}

export function ehDiaUtil(data, feriados = new Set()) {
  const s = diaDaSemana(data);
  return s !== 0 && s !== 6 && !feriados.has(data);
}

// A própria data se for útil; senão o dia útil anterior mais próximo.
export function diaUtilAteh(data, feriados = new Set()) {
  let d = data;
  while (!ehDiaUtil(d, feriados)) d = somarDias(d, -1);
  return d;
}

// Segunda a sexta da semana que contém `data`.
export function semanaDe(data) {
  const s = diaDaSemana(data);
  const segunda = somarDias(data, s === 0 ? -6 : 1 - s);
  return { inicio: segunda, fim: somarDias(segunda, 4) };
}

// Prazo semanal (inadimplência e risco): sexta da semana, ou o dia útil anterior se for feriado.
export function prazoSemanal(data, feriados = new Set()) {
  return diaUtilAteh(semanaDe(data).fim, feriados);
}

// Mês de referência sugerido para o "Por que não fechou?": o mês anterior ao de hoje.
export function mesReferenciaSugerido(hoje) {
  const [a, m] = hoje.split('-').map(Number);
  return m === 1 ? { ano: a - 1, mes: 12 } : { ano: a, mes: m - 1 };
}

// Prazo do "Por que não fechou?": dia 7 do mês seguinte à referência (fixo).
export function prazoNaoFechou({ ano, mes }) {
  const [a, m] = mes === 12 ? [ano + 1, 1] : [ano, mes + 1];
  return `${a}-${String(m).padStart(2, '0')}-07`;
}

// ── Status ───────────────────────────────────────────────────────────────

// Espelha a view tarefas_status do banco (supabase/migrations/003_status.sql).
export function statusTarefa({ total, feitos, prazo, concluidaEm = null, agora = new Date() }) {
  const hoje = hojeSP(agora);
  const concluida = total > 0 && feitos >= total;
  let status;
  if (concluida) {
    const diaConclusao = concluidaEm ? hojeSP(new Date(concluidaEm)) : hoje;
    status = diaConclusao > prazo ? 'concluida_atraso' : 'concluida';
  } else if (hoje > prazo) {
    status = 'atrasada';
  } else {
    status = feitos === 0 ? 'nao_iniciada' : 'em_andamento';
  }
  return { status, prazoProximo: !concluida && hoje === prazo };
}

// Coluna do quadro "Minhas tarefas".
export function colunaQuadro(status) {
  return {
    nao_iniciada: 'para_fazer',
    em_andamento: 'em_andamento',
    concluida: 'concluidas',
    concluida_atraso: 'concluidas',
    atrasada: 'atrasadas',
  }[status];
}

// ── Divisão do risco de abandono ─────────────────────────────────────────

// alunos: [{ evo_id, consultorEvo }] na ordem da planilha
// consultoras: [{ id, nome_evo }] na ordem do rodízio
// ponteiro: posição da consultora que recebe a primeira vaga extra (sobra rotativa)
export function dividir(alunos, consultoras, ponteiro = 0) {
  const k = consultoras.length;
  if (k === 0) throw new Error('Nenhuma consultora ativa para dividir os alunos.');
  const n = alunos.length;
  const base = Math.floor(n / k);
  const extra = n % k;
  const p = ((ponteiro % k) + k) % k;

  const cota = consultoras.map((_, i) => base + (((i - p + k) % k) < extra ? 1 : 0));
  const recebidos = consultoras.map(() => 0);
  const daEvo = consultoras.map(() => 0);
  const indicePorNome = new Map(consultoras.map((c, i) => [normalizarNome(c.nome_evo), i]));
  const destino = new Array(n).fill(-1);

  // Fase 1: o aluno fica com a consultora do EVO até ela completar a cota.
  alunos.forEach((a, j) => {
    const i = indicePorNome.get(normalizarNome(a.consultorEvo));
    if (i !== undefined && recebidos[i] < cota[i]) {
      destino[j] = i;
      recebidos[i]++;
      daEvo[i]++;
    }
  });

  // Fase 2: o restante completa as vagas, em rodízio a partir do ponteiro.
  let cursor = p;
  alunos.forEach((_, j) => {
    if (destino[j] !== -1) return;
    while (recebidos[cursor] >= cota[cursor]) cursor = (cursor + 1) % k;
    destino[j] = cursor;
    recebidos[cursor]++;
    cursor = (cursor + 1) % k;
  });

  return {
    atribuicoes: alunos.map((a, j) => ({
      evo_id: a.evo_id,
      consultora_id: consultoras[destino[j]].id,
      origem: indicePorNome.get(normalizarNome(a.consultorEvo)) === destino[j] ? 'evo' : 'redistribuido',
    })),
    resumo: consultoras.map((c, i) => ({ consultora_id: c.id, total: recebidos[i], daEvo: daEvo[i], recebidos: recebidos[i] - daEvo[i] })),
    proximoPonteiro: (p + extra) % k,
  };
}
