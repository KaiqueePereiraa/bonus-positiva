// Meta da semana do Bônus (resumo do "Meu dia"). Mesmas regras da página do Bônus (site/bonus/index.html):
// o mês é dividido em exatamente 4 semanas — dias soltos do começo entram na 1ª e os do fim na 4ª — e as faixas são
// Club 6/9/12 (4/7/10 a partir de novembro/2026) e Acqua 2/3/4 contratos "de meta" (cadastro, rematrícula ou venda completa) na semana.
// Dezembro/2026 em diante (comissão aprovada em 24/11/2026): Laranjeiras + República são uma equipe só — contam as vendas
// dela nas duas unidades e as faixas vêm da régua do mês (minha_meta_semana → regua): Entrada, Básico e Meta real.
// Bônus configurável (27/11/2026): quando minha_meta_semana traz a configuração da equipe dela (config_equipe), as faixas e as
// unidades que contam vêm dela (site/shared/bonus-motor.js); sem configuração, as regras antigas abaixo.
// Puro: testado em tests/bonus-meta.test.js e tests/bonus-config-meta.test.js.
import { faixasSemana, versaoDoMes, equipeDaUnidade } from '../../shared/bonus-motor.js?v=20261127024402';

// Equipe da consultora no dia, pela configuração que veio junto com minha_meta_semana (dados.minhaMetaSemana)
export const equipeDoDia = (meta, hoje, unidade) => equipeDaUnidade(versaoDoMes(meta?.config_versoes, hoje), unidade);

export const FAIXAS = {
  club: [[12, 'Super meta'], [9, 'Meta real'], [6, 'Básico']],
  laranjeiras: [[4, 'Super meta'], [3, 'Meta real'], [2, 'Básico']],
  republica: [[4, 'Super meta'], [3, 'Meta real'], [2, 'Básico']],
};

// Club, novembro/2026 em diante (Política de Bonificações): Básico 4, Meta real 7, Super meta 10; cada Black vale meio contrato
export const FAIXAS_CLUB_V3 = [[10, 'Super meta'], [7, 'Meta real'], [4, 'Básico']];
const clubV3 = (unidade, hoje) => unidade === 'club' && !!hoje && hoje >= '2026-11-01';

export const ACQUA = ['laranjeiras', 'republica'];
const ehV3 = (unidade, regua) => !!regua?.v3 && ACQUA.includes(unidade);
// Faixas da unidade, da maior para a menor: [[contratos, nome], …]
export function faixasDe(unidade, regua = null, hoje = null, equipe = null) {
  if (equipe) return faixasSemana(equipe, regua).slice(0, -1).map(([min, , nome]) => [min, nome]);
  if (ehV3(unidade, regua)) return [[regua.meta_real, 'Meta real'], [regua.basico, 'Básico'], [regua.entrada, 'Entrada']];
  if (clubV3(unidade, hoje)) return FAIXAS_CLUB_V3;
  return FAIXAS[unidade] || FAIXAS.club;
}

const iso = (d) => d.toISOString().slice(0, 10);
const dataISO = (br) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(br || '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

// As 4 semanas do mês de `hoje` (AAAA-MM-DD): [{ ini, fim }] em AAAA-MM-DD
export function semanasDoMes(hoje) {
  const ano = +hoje.slice(0, 4), mes = +hoje.slice(5, 7) - 1;
  const primeiro = new Date(Date.UTC(ano, mes, 1)), ultimo = new Date(Date.UTC(ano, mes + 1, 0));
  const segundas = [];
  for (let d = new Date(primeiro); d <= ultimo; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() === 1) segundas.push(new Date(d));
  const antes = (d) => { const r = new Date(d); r.setUTCDate(r.getUTCDate() - 1); return iso(r); };
  const [, s2, s3, s4] = segundas;
  return [{ ini: iso(primeiro), fim: antes(s2) }, { ini: iso(s2), fim: antes(s3) }, { ini: iso(s3), fim: antes(s4) }, { ini: iso(s4), fim: iso(ultimo) }];
}

// vendas: [{ data: 'DD/MM/AAAA', unit, peso? }] (já só as "de meta" da consultora, vindas de minha_meta_semana; peso 0,5 = Black do Club)
export function resumoSemana(vendas, hoje, unidade, regua = null, equipe = null) {
  const semanas = semanasDoMes(hoje);
  const n = semanas.findIndex((s) => hoje >= s.ini && hoje <= s.fim);
  const s = semanas[n];
  const v3 = ehV3(unidade, regua);
  const faixas = faixasDe(unidade, regua, hoje, equipe);
  const daUnidade = (v) => (equipe ? (equipe.unidades || [unidade]).includes(v.unit) : v3 ? ACQUA.includes(v.unit) : v.unit === unidade);
  const naSemana = vendas.filter(daUnidade).filter((v) => { const d = dataISO(v.data); return d && d >= s.ini && d <= s.fim; });
  const feitos = Math.floor(naSemana.reduce((a, v) => a + (Number(v.peso) || 1), 0) + 1e-9);
  const atual = faixas.find(([min]) => feitos >= min);
  const proxima = [...faixas].reverse().find(([min]) => feitos < min);
  const abaixo = equipe ? (equipe.meta?.abaixo || 'Abaixo do básico') : v3 ? 'Abaixo da entrada' : 'Abaixo do básico';
  return { semana: n + 1, ini: s.ini, fim: s.fim, feitos, faixa: atual ? atual[1] : abaixo, abaixo: !atual, faixas, topo: faixas[0][1],
    proxima: proxima ? { nome: proxima[1], faltam: proxima[0] - feitos } : null, basico: faixas[faixas.length - 1][0] };
}

// Quadro da meta no topo do "Meu dia": marcos das faixas na barra, quantos dias faltam e uma frase de incentivo.
// r = resumoSemana(...). A barra vai até a Super meta; cada faixa vira um marco (✓ quando atingida).
export function painelMeta(r, hoje, unidade) {
  const faixas = [...(r.faixas || FAIXAS[unidade] || FAIXAS.club)].reverse();   // da menor para a maior
  const topo = faixas[faixas.length - 1][0];
  const dia = (s) => Date.parse(`${s}T12:00:00Z`);
  const dias = Math.max(1, Math.round((dia(r.fim) - dia(hoje)) / 864e5) + 1);   // hoje incluído
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const marcos = faixas.map(([n, nome]) => ({ n, nome, atingido: r.feitos >= n, pos: Math.round((100 * n) / topo) }));
  let frase;
  if (!r.proxima) frase = `${r.topo || 'Super meta'} batida! 🏆 Semana de referência — tudo o que vier agora é extra.`;
  else {
    const alvo = ['Básico', 'Entrada'].includes(r.proxima.nome) ? `${r.proxima.nome === 'Básico' ? 'o' : 'a'} ${r.proxima.nome}` : `a ${r.proxima.nome}`;
    // dias DEPOIS de hoje, com a data: "5 dias contando hoje" confundia à noite (pedido de 18/11/2026)
    const depois = dias - 1;
    const quando = depois === 0 ? 'hoje é o último dia da semana'
      : `a semana fecha domingo (${r.fim.slice(8, 10)}/${r.fim.slice(5, 7)}), ${depois === 1 ? 'amanhã' : `daqui a ${depois} dias`}`;
    frase = `${r.feitos === 0 ? 'Bora começar!' : (r.abaixo ?? r.faixa === 'Abaixo do básico') ? `Já ${r.feitos === 1 ? 'tem 1 contrato' : `são ${r.feitos} contratos`} na semana.` : `${r.faixa} garantid${r.faixa === 'Básico' ? 'o' : 'a'}!`} `
      + `${r.proxima.faltam === 1 ? 'Falta' : 'Faltam'} ${plural(r.proxima.faltam, 'contrato', 'contratos')} para ${alvo} — ${quando}.`;
  }
  return { marcos, pct: Math.min(100, Math.round((100 * r.feitos) / topo)), dias, frase, topo };
}
