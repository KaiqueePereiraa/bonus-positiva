// Painel do gestor — o resumo do comercial e do kanban já pronto para agir (testado em tests/painel-comercial.test.js).
// Junta no "Precisa da sua atenção" o que antes estava espalhado em Desempenho comercial e Kanban; monta o quadro do mês
// por unidade e acha a carteira e o kanban de cada consultora para a tabela da equipe.
import { avaliarUnidades, avaliarTime, alertaCarteiras, pct } from './comercial-regras.js?v=20261127194357';

const br = (n) => String(n).replace('.', ',');
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const primeiro = (t) => semAcento(t).split(/\s+/)[0] || '';
const tempo = (m) => (m == null ? '' : m < 60 ? `${Math.round(m)} min` : m < 2880 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / 1440)} dias`);

// Times visíveis com a unidade escolhida no topo
export function timesDaUnidade(comercial, unidade) {
  const ts = comercial?.times || [];
  return unidade ? ts.filter((t) => (t.unidades || []).includes(unidade)) : ts;
}

// Linhas do mês por unidade (time de uma unidade só vira uma linha com os totais do time)
export function linhasMes(comercial, unidade) {
  const linhas = [];
  for (const t of timesDaUnidade(comercial, unidade)) {
    const us = t.por_unidade?.length > 1 ? t.por_unidade : [{ id: t.id, nome: t.nome, atual: t.atual, anterior: t.anterior }];
    linhas.push(...avaliarUnidades(us).map((u) => ({ ...u, nome: String(u.nome).replace('Positiva ', '').replace('Acqua ', '') })));
  }
  return unidade ? linhas.filter((l) => l.id === unidade || !(comercial?.times || []).some((t) => t.por_unidade?.some((u) => u.id === l.id))) : linhas;
}

// Itens para o "Precisa da sua atenção" (cada um com o que fazer e onde abrir)
export function itensComercial(comercial, kanban, unidade) {
  const itens = [];
  for (const u of linhasMes(comercial, unidade)) {
    if (u.situacao === 'atencao') itens.push({ texto: `${u.nome} precisa de atenção: ${u.diagnostico}`, acao: 'Veja onde travou: oportunidades, experimental e o retorno das consultoras.', rota: '#/analises/comercial' });
  }
  for (const t of timesDaUnidade(comercial, unidade)) {
    const a = alertaCarteiras(avaliarTime(t));
    if (a) itens.push({ texto: `${a.pior.nome} converte ${br(a.pior.taxa)}% da carteira e ${a.melhor.nome} ${br(a.melhor.taxa)}% (${br(a.gap)} pontos de diferença${(t.unidades || []).length > 1 ? `; equipe ${t.nome}` : ''}).`, acao: `Acompanhe o kanban de ${a.pior.nome} e veja o que ${a.melhor.nome} faz diferente.`, rota: '#/analises/comercial' });
    const pu = unidade ? (t.por_unidade || []).find((u) => u.id === unidade) : null;   // com unidade escolhida, o funil é o dela (146)
    const sd = (pu?.funil_ia ?? t.funil_ia)?.atual?.sem_dona || 0;
    if (sd > 0) itens.push({ texto: `${sd} cadastro${sd > 1 ? 's' : ''} da IA neste mês ainda sem dona — fora da carteira de todas (${pu ? String(pu.nome).replace('Positiva ', '').replace('Acqua ', '') : t.nome}).`, acao: 'Distribua no kanban da WasFit: quem assumir o contato passa a ser a dona. (O kanban mostra só quem está sem dona agora.)', rota: '#/analises/comercial' });
  }
  const cr = kanban?.niveis?.critico || 0;
  if (cr > 0) {
    const quem = (kanban.pessoas || []).filter((p) => p.critico).sort((a, b) => b.critico - a.critico).slice(0, 3).map((p) => `${p.dona} (${p.critico})`).join(', ');
    itens.push({ texto: `${cr} contato${cr > 1 ? 's' : ''} crítico${cr > 1 ? 's' : ''} no kanban da WasFit${quem ? `: ${quem}` : ''}.`, acao: 'Cobre um retorno hoje.', rota: '#/analises/kanban' });
  }
  const es = kanban?.espera;
  if (es?.aguardando && (es.mais_antigo_min || 0) >= 30) {
    const un = (es.por_unidade || []).filter((x) => x.aguardando).map((x) => `${x.nome} ${x.aguardando}`).join(' · ');
    itens.push({ texto: `${es.aguardando} contato${es.aguardando > 1 ? 's' : ''} esperando na fila "${es.tag || 'Em espera'}" — o mais antigo há ${tempo(es.mais_antigo_min)}${un ? ` (${un})` : ''}.`, acao: 'Alguém precisa assumir agora.', rota: '#/analises/kanban' });
  }
  return itens;
}

// Carteira do mês de uma consultora (pelo nome da Central) e o kanban dela (pelo primeiro nome, sem acento)
export function carteiraDe(comercial, nome) {
  for (const t of comercial?.times || []) {
    const p = avaliarTime(t).find((x) => x.nome === nome);
    if (p) return { contatos: p.atual.cadastros, vendas: p.atual.vendas, taxa: p.taxa ?? pct(p.atual.vendas, p.atual.cadastros), status: p.status };
  }
  return null;
}
export function kanbanDe(kanban, nome) {
  const pn = primeiro(nome);
  if (!pn) return null;
  const ps = (kanban?.pessoas || []).filter((p) => primeiro(p.dona) === pn);
  if (!ps.length) return null;
  return ps.reduce((a, p) => ({ contatos: a.contatos + (p.contatos || 0), critico: a.critico + (p.critico || 0), atrasado: a.atrasado + (p.urgente || 0) }), { contatos: 0, critico: 0, atrasado: 0 });
}

// Entradas × saídas de alunos por unidade (EVO, contando pessoas): o mês atual até hoje e o saldo dos 3 meses fechados.
// Saldo negativo = a "caixa d'água" está esvaziando (saiu mais gente do que entrou).
export function linhasSaldo(registros, unidade, mesAtual) {
  const por = new Map();
  for (const r of registros || []) {
    if (unidade && r.unidade !== unidade) continue;
    const x = por.get(r.unidade) || { unidade: r.unidade, atual: null, antes: [] };
    if (r.mes.slice(0, 7) === mesAtual.slice(0, 7)) x.atual = r; else if (r.fechado) x.antes.push(r);
    por.set(r.unidade, x);
  }
  return [...por.values()].filter((x) => x.atual || x.antes.length).map((x) => {
    const antes = x.antes.sort((a, b) => b.mes.localeCompare(a.mes)).slice(0, 3);
    const saldo = (r) => (r ? r.entradas - r.saidas : null);
    const media = antes.length ? Math.round(antes.reduce((t, r) => t + r.saidas, 0) / antes.length) : null;
    const s = saldo(x.atual);
    const aviso = s == null ? null : s < 0 ? `Saiu mais gente do que entrou neste mês (${-s} a menos).`
      : media != null && x.atual.saidas > media ? `Saídas acima da média dos últimos meses (${x.atual.saidas} × ${media}).` : null;
    return { unidade: x.unidade, atual: x.atual, saldo: s, antes: antes.map((r) => ({ mes: r.mes, saldo: saldo(r), saidas: r.saidas, entradas: r.entradas })), mediaSaidas: media, aviso };
  });
}
