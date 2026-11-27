// Resumo da semana (27/11/2026, aprovado pelo Kaique) — regras puras, testadas em tests/resumo-regras.test.js.
// Aparece no 1º acesso da semana (segunda, ou o 1º dia em que a pessoa entrar) com a semana ANTERIOR (seg a dom).
// No 1º acesso do mês (até o dia 7), a versão é a do mês anterior e vale também como a da semana (nunca aparecem as duas).
import { somarDias, semanaDe } from './regras.js?v=20261127195325';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ultimoDia = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();   // mes 1–12
const mesAnterior = (ini) => { const [a, m] = ini.split('-').map(Number); return m === 1 ? `${a - 1}-12-01` : `${a}-${String(m - 1).padStart(2, '0')}-01`; };
const fimDoMes = (ini) => `${ini.slice(0, 8)}${String(ultimoDia(+ini.slice(0, 4), +ini.slice(5, 7))).padStart(2, '0')}`;

// Qual resumo mostrar hoje. vistos: chaves já vistas ('semana:AAAA-MM-DD' = segunda da semana; 'mes:AAAA-MM').
// forcar: a pessoa pediu para rever (mostra o da semana mesmo já visto).
export function periodoResumo(hoje, vistos = [], forcar = false) {
  const visto = new Set(vistos);
  const seg = semanaDe(hoje).inicio;
  const chaveSemana = `semana:${seg}`;
  const chaveMes = `mes:${hoje.slice(0, 7)}`;
  if (!forcar && +hoje.slice(8, 10) <= 7 && !visto.has(chaveMes)) {
    const de = mesAnterior(`${hoje.slice(0, 7)}-01`), ate = fimDoMes(de);
    const deAnt = mesAnterior(de);
    return { tipo: 'mes', chaves: [chaveMes, chaveSemana], de, ate, deAnt, ateAnt: fimDoMes(deAnt), hoje,
      titulo: 'Resumo do mês', rotulo: `${MESES[+de.slice(5, 7) - 1]} de ${de.slice(0, 4)}`, comparado: 'o mês anterior' };
  }
  if (!forcar && visto.has(chaveSemana)) return null;
  const de = somarDias(seg, -7), ate = somarDias(seg, -1);
  return { tipo: 'semana', chaves: [chaveSemana], de, ate, deAnt: somarDias(de, -7), ateAnt: somarDias(ate, -7), hoje,
    titulo: 'Resumo da semana', rotulo: `semana de ${dm(de)} a ${dm(ate)}`, comparado: 'a semana anterior' };
}

// Números por unidade (gestor): soma das consultoras de cada unidade, agora × antes
export function unidadesPeriodo(lista, antes = []) {
  const soma = (l) => {
    const m = new Map();
    for (const c of l) {
      const u = m.get(c.unidade) || { contatos: 0, resultados: 0, pcts: [] };
      u.contatos += c.contatos || 0; u.resultados += c.resultados || 0;
      if (c.pct != null) u.pcts.push(c.pct);
      m.set(c.unidade, u);
    }
    return m;
  };
  const media = (v) => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null);
  const a = soma(lista), b = soma(antes);
  return [...a.entries()].map(([unidade, x]) => {
    const y = b.get(unidade);
    return { unidade, contatos: x.contatos, contatosAnt: y ? y.contatos : null, resultados: x.resultados, resultadosAnt: y ? y.resultados : null,
      pct: media(x.pcts), pctAnt: y ? media(y.pcts) : null };
  }).sort((p, q) => String(p.unidade).localeCompare(String(q.unidade)));
}

// Vitórias (já agrupadas por consultora + dia) dentro do período; de uma pessoa só, se `eu` vier
export function vitoriasPeriodo(grupos, de, ate, eu = null) {
  const doPeriodo = (grupos || []).filter((g) => g.dia >= de && g.dia <= ate && (!eu || g.consultora_id === eu));
  const porTipo = {};
  const palmas = new Map();
  for (const g of doPeriodo) {
    for (const [k, n] of Object.entries(g.porTipo || {})) porTipo[k] = (porTipo[k] || 0) + n;
    for (const p of g.palmas || []) if (p.de !== eu) palmas.set(p.de, p.nome);
  }
  return { grupos: doPeriodo, total: doPeriodo.reduce((t, g) => t + g.itens.length, 0), porTipo, palmas: [...palmas.values()] };
}

// Novidades da Central para este papel, publicadas depois do último resumo visto (sem resumo visto: últimos 14 dias)
export function novidadesPara(lista, papel, ultimoVisto, hoje) {
  const desde = ultimoVisto ? ultimoVisto.slice(0, 10) : somarDias(hoje, -14);
  return (lista || []).filter((n) => (n.para === 'todos' || n.para === papel) && n.em > desde && n.em <= hoje);
}

// Delta com sinal para "antes → agora"
export function delta(agora, antes, sufixo = '') {
  if (agora == null || antes == null) return null;
  const d = agora - antes;
  return { d, texto: `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}${sufixo}`, cor: d > 0 ? 'pos' : d < 0 ? 'neg' : 'igual' };
}

// Gestor: uma linha por consultora no período (soma dos dias); diasParaAplaudir = dias em que `eu` ainda não aplaudiu
export function vitoriasPorConsultora(grupos, eu) {
  const m = new Map();
  for (const g of grupos || []) {
    const x = m.get(g.consultora_id) || { consultora_id: g.consultora_id, consultora: g.consultora, total: 0, porTipo: {}, dias: [], diasParaAplaudir: [] };
    x.total += g.itens.length;
    for (const [k, n] of Object.entries(g.porTipo || {})) x.porTipo[k] = (x.porTipo[k] || 0) + n;
    x.dias.push(g.dia);
    if (!(g.palmas || []).some((p) => p.de === eu)) x.diasParaAplaudir.push(g.dia);
    m.set(g.consultora_id, x);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
