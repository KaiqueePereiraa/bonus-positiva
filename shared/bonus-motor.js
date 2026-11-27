// Bônus configurável por academia (fase 5, 27/11/2026): as regras saem da tabela bonus_config (uma versão por mês de
// início, "vale_de") em vez de ficarem no código. Puro (sem banco nem tela): usado pela página do Bônus (site/bonus/),
// pelo "Meu dia" da Central (site/tarefas/js/bonus-meta.js) e pela trilha do 1º acesso. Testado em tests/bonus-config*.test.js.
// Meses sem versão (antes de novembro/2026 na Positiva) continuam com as regras antigas do código, sem mudança.
//
// Versão: { vale_de: 'AAAA-MM-01', especiais: ['gympass', …], equipes: [Equipe] }
// Equipe (as unidades que formam UMA meta e UM bônus de equipe):
//   id, nome, unidades: ['laranjeiras', 'republica']
//   divisao: { cadastro: 70 }                        → % de quem cadastrou; quem converteu fica com o resto
//   meta: { modo: 'fixa', faixas: [{ nome, vendas, pct }], abaixo }               → faixas semanais fixas (n vendas)
//       | { modo: 'saidas', faixas: [{ nome, chave, delta, pct }], abaixo,        → automática pelas saídas: Básico =
//           semanas: 4, base_padrao, consultoras_padrao }                            média das saídas ÷ consultoras ÷ semanas
//   planos: [{ texto, modo: 'igual'|'contem', venda (null = não conta), revisar, renovacao, upgrade, meta: 1|0.5|0,
//              degrau, renda_extra }]
//   plano_sem_regra: 'positiva' (regras antigas do código) | 'nao_conta' | 'revisar'
//   renovacao: { paga, upgrade: { valor } }        rematricula: { paga, dias }
//   bonus_equipe: { modo: 'fixo', faixas: [{ vendas, valor }], quem, trava_saidas }
//               | { modo: 'regua', faixas: [{ chave, valor }], quem, trava_saidas }  (vendas = faixa × consultoras × semanas)
//     quem: 'quem_vendeu' (qualquer venda na equipe) | 'quem_vendeu_meta' (só vendas que contam) | 'equipe' (consultoras da régua)
//   premio: { nome, faixas: [{ semanas, valor }], piso_todas }   (semanas em Super meta = faixa de 100%)
//   renda_extra: { faixas: [{ min, pct }] }        central: { bom, otimo }   (% extra da comissão da semana)

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const semAcentoMin = (s) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// 'Novembro/2026' ou 'AAAA-MM-DD' → 'AAAA-MM-01'
export function mesISO(m) {
  if (/^\d{4}-\d{2}/.test(String(m || ''))) return `${String(m).slice(0, 7)}-01`;
  const [nome, ano] = String(m || '').split('/');
  const i = MESES.indexOf(nome);
  return i < 0 || !Number(ano) ? null : `${ano}-${String(i + 1).padStart(2, '0')}-01`;
}

// Versão em vigor no mês (a de maior vale_de que já começou) ou null
export function versaoDoMes(versoes, mes) {
  const m = mesISO(mes);
  if (!m || !Array.isArray(versoes)) return null;
  return versoes.filter((v) => v && v.vale_de && String(v.vale_de).slice(0, 10) <= m)
    .sort((a, b) => String(b.vale_de).localeCompare(String(a.vale_de)))[0] || null;
}
export const equipeDaUnidade = (versao, unidade) => versao?.equipes?.find((e) => (e.unidades || []).includes(unidade)) || null;
export const equipePorId = (versao, id) => versao?.equipes?.find((e) => e.id === id) || null;

// ── Planos ──
export function acharPlano(equipe, contrato) {
  const t = semAcentoMin(contrato);
  const planos = equipe?.planos || [];
  return planos.find((p) => p.modo !== 'contem' && semAcentoMin(p.texto) === t)
    || planos.find((p) => p.modo === 'contem' && p.texto && t.includes(semAcentoMin(p.texto)));
}
export const ehEspecial = (versao, contrato) => {
  const t = semAcentoMin(contrato);
  return (versao?.especiais || []).some((x) => x && t.includes(semAcentoMin(x)));
};

// ── Meta semanal ──
const pct = (x) => Number(x) / 100;
// Faixas da semana, da maior para a menor, com a faixa zero no fim: [[mínimo, %, nome]]
export function faixasSemana(equipe, regua = null) {
  const m = equipe?.meta || {};
  let asc;
  if (m.modo === 'saidas') {
    const r = regua || {};
    const basico = Number(r.basico) || 1;
    asc = (m.faixas || []).map((f) => [r[f.chave] != null ? Number(r[f.chave]) : Math.max(basico + (Number(f.delta) || 0), 1), pct(f.pct), f.nome]);
  } else {
    asc = (m.faixas || []).map((f) => [Number(f.vendas), pct(f.pct), f.nome]);
  }
  const desc = asc.slice().reverse().sort((a, b) => b[0] - a[0]);   // sort estável: empate fica na ordem da configuração
  return [...desc, [0, 0, m.abaixo || 'Abaixo do básico']];
}
export function faixaDe(equipe, regua, n) {
  for (const f of faixasSemana(equipe, regua)) if (n >= f[0]) return f;
  return [0, 0, equipe?.meta?.abaixo || 'Abaixo do básico'];
}
export function faltaProxima(equipe, regua, n) {
  for (const [min] of faixasSemana(equipe, regua).slice().reverse()) if (n < min) return min - n;
  return 0;
}

// Renda extra (ex.: plano CLT): % pela quantidade de contratos desse tipo da pessoa na semana
export function pctRendaExtra(equipe, n) {
  const f = (equipe?.renda_extra?.faixas || []).slice().sort((a, b) => b.min - a.min).find((x) => n >= x.min);
  return f ? pct(f.pct) : 0;
}
export const divisao = (equipe) => {
  const cad = Number(equipe?.divisao?.cadastro ?? 70);
  return [cad, 100 - cad];
};

// ── Bônus de equipe ──
// linhas: vendas com dona do mês, só das unidades da equipe. Conta cada venda uma vez (unidade + tipo + id), com o peso na meta.
export function bonusEquipe(equipe, linhas, { regua = null, semDona = 'SUPORTEEVO - IA' } = {}) {
  const b = equipe?.bonus_equipe;
  const doGrupo = linhas.filter((s) => (equipe.unidades || []).includes(s.unit) && s.consultant);
  const metaLines = doGrupo.filter((s) => s.counts_goal !== false);
  const porVenda = new Map();
  metaLines.forEach((s) => porVenda.set(`${s.unit}:${s.type}:${s.id}`, Number(s.goal_weight) || 1));
  const count = Math.floor([...porVenda.values()].reduce((a, v) => a + v, 0) + 1e-9);
  if (!b) return { v2: true, count, perPerson: 0, previsto: 0, people: 0, total: 0, nextGoal: 0, byPerson: {}, trava: null, steps: [] };
  const semanas = Number(equipe?.meta?.semanas) || 4;
  const r = regua || {};
  const steps = (b.faixas || []).map((f) => [b.modo === 'regua' ? Number(r[f.chave] ?? 0) * Number(r.consultoras ?? 0) * semanas : Number(f.vendas), Number(f.valor)]);
  let previsto = 0;
  steps.forEach(([min, v]) => { if (count >= min) previsto = v; });
  const saidas = b.trava_saidas ? (r.saidas_mes ?? null) : null;
  const trava = !b.trava_saidas ? null : saidas == null ? 'pendente' : count >= saidas ? 'aberta' : 'fechada';
  const perPerson = !b.trava_saidas || trava === 'aberta' ? previsto : 0;
  const base = b.quem === 'quem_vendeu_meta' ? metaLines : doGrupo;
  const nomes = new Set(b.quem === 'equipe' ? (r.nomes || []) : []);
  const people = [...new Set(base.map((s) => s.consultant))].filter((n) => n !== semDona && (!nomes.size || nomes.has(n)));
  const byPerson = {};
  if (perPerson > 0) people.forEach((n) => { byPerson[n] = perPerson; });
  const prox = steps.map(([min]) => min).find((min) => count < min);
  // previsto/trava só existem quando há trava das saídas (o valor que fica esperando as saídas do mês)
  return { v2: true, count, perPerson, ...(b.trava_saidas ? { previsto } : {}), people: people.length, total: perPerson * people.length,
    nextGoal: prox != null ? prox - count : 0, byPerson, trava, saidas, saidasBase: r.saidas_base, regua: r, steps };
}

// Prêmio do mês: semanas em Super meta (faixa de 100%); com piso_todas, perde se alguma semana já fechada ficou em 0%.
// weeks: [{ pct, status: 'closed'|'current'|'upcoming' }]
export function premio(equipe, weeks) {
  const p = equipe?.premio;
  const supers = weeks.filter((w) => w.pct >= 1).length;
  if (!p) return { supers, perdeu: false, valor: 0, aberto: weeks.some((w) => w.status !== 'closed') };
  const perdeu = !!p.piso_todas && weeks.some((w) => w.status === 'closed' && w.pct === 0);
  const faixa = (p.faixas || []).slice().sort((a, b) => b.semanas - a.semanas).find((f) => supers >= f.semanas);
  return { supers, perdeu, valor: !perdeu && faixa ? Number(faixa.valor) : 0, aberto: weeks.some((w) => w.status !== 'closed') };
}

// Bônus da Central: % extra da comissão da semana por nível ('bom' | 'otimo' | 'normal')
export function nivelCentral(equipe, nivel) {
  const c = equipe?.central || {};
  return { otimo: { nome: 'Ótimo', pct: pct(c.otimo ?? 0) }, bom: { nome: 'Bom', pct: pct(c.bom ?? 0) }, normal: { nome: 'Normal', pct: 0 } }[nivel]
    || { nome: 'Normal', pct: 0 };
}

// Exemplo da trilha / Configurações: "4 vendas de X na semana = R$ Y" (para quem cadastra e converte a venda inteira)
export function exemplo(equipe, plano, n, regua = null) {
  const valor = Number(plano?.venda) || 0;
  const [, pctFaixa, nome] = faixaDe(equipe, regua, Math.floor(n * (plano?.meta ?? 1) + 1e-9));   // meia meta: 2 vendas valem 1
  const total = Math.round(valor * n * pctFaixa * 100) / 100;
  return { valor, n, faixa: nome, pct: pctFaixa, total };
}

// Configuração de partida para uma academia nova (a trilha do 1º acesso parte daqui)
export function padraoNovo(unidades, nomeEquipe = 'Equipe') {
  return {
    especiais: ['gympass', 'wellhub', 'totalpass', 'permuta', 'bolsa', 'colaborador', 'cortesia', 'convidado', 'diaria'],
    equipes: [{
      id: 'equipe', nome: nomeEquipe, unidades,
      divisao: { cadastro: 70 },
      meta: { modo: 'fixa', abaixo: 'Abaixo do básico', faixas: [{ nome: 'Básico', vendas: 2, pct: 50 }, { nome: 'Meta real', vendas: 3, pct: 70 }, { nome: 'Super meta', vendas: 4, pct: 100 }] },
      planos: [], plano_sem_regra: 'nao_conta',
      renovacao: { paga: false }, rematricula: { paga: true, dias: 15 },
      bonus_equipe: null, premio: null, renda_extra: null, central: null,
    }],
  };
}
