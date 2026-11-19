// Regras do Painel do gestor (puras; testadas em tests/painel.test.js). Recebem os números prontos do banco
// (painel_gestor) e devolvem frases simples com cor e "o que fazer".

export const reais = (v) => `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function mediana(lista) {
  const v = [...lista].map(Number).sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const soma = (unidades, f) => unidades.reduce((s, u) => s + (Number(f(u)) || 0), 0);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// Os 4 sinais do topo: Cobrança, Retenção, Vendas, Equipe
export function sinais(unidades) {
  const ativas = unidades.filter((u) => u.consultoras?.length);
  const pend = (c) => soma(ativas, (u) => u.pendentes?.[c]);
  const sem = (k) => soma(ativas, (u) => u.semana?.[k]);
  const mes = (k) => soma(ativas, (u) => u.mes?.[k]);
  const cons = ativas.flatMap((u) => u.consultoras);
  const vermelhas = cons.filter((c) => c.minimo >= 3 && c.feitos_hoje * 2 < c.minimo);
  const atrasadas = cons.filter((c) => c.atrasados > 0);

  const inad = pend('inadimplencia');
  const risco = pend('risco');
  const nf = pend('nao_fechou');
  const novos = pend('lead_novo') + pend('experimental_confirmar') + pend('experimental_pos') + pend('ex_alunos');
  const relac = pend('renovacao_vencer') + pend('renovacao_venceu') + pend('primeiros_90') + pend('cancelou');
  const rc = mes('risco_contato'), rcv = mes('risco_contato_voltou'), rs = mes('risco_sem_contato'), rsv = mes('risco_sem_contato_voltou');
  const efeito = rc >= 10 && rs >= 10 ? ` Com contato, ${Math.round(100 * rcv / rc)}% voltaram; sem contato, ${Math.round(100 * rsv / rs)}%.` : '';

  return [
    { area: 'Cobrança', cor: inad ? 'amarelo' : 'verde',
      titulo: sem('pagou') ? `${plural(sem('pagou'), 'pagou', 'pagaram')} nesta semana` : 'Cobrança da semana',
      texto: `${sem('valor') ? `${reais(sem('valor'))} recebidos depois da cobrança. ` : ''}${inad ? `${plural(inad, 'inadimplente aguarda', 'inadimplentes aguardam')} contato.` : 'Nenhum inadimplente esperando contato.'}`,
      acao: inad ? 'Garanta que a lista de hoje seja feita até o fim do dia.' : '' },
    { area: 'Retenção', cor: risco || relac ? 'amarelo' : 'verde',
      titulo: sem('voltou') ? `${plural(sem('voltou'), 'aluno voltou', 'alunos voltaram')} a treinar` : 'Alunos em risco',
      texto: `${risco ? `${plural(risco, 'aluno em risco ainda sem contato', 'alunos em risco ainda sem contato')}.` : 'Todos os alunos em risco já receberam contato.'}${relac ? ` ${plural(relac, 'contato', 'contatos')} de renovação e relacionamento ${relac === 1 ? 'pendente' : 'pendentes'}.` : ''}${efeito}`,
      acao: risco ? 'Peça para perguntarem o motivo da falta, não só "sentimos sua falta".' : '' },
    { area: 'Vendas', cor: nf || novos ? 'amarelo' : 'verde',
      titulo: mes('matriculou') ? `${plural(mes('matriculou'), 'matrícula recuperada', 'matrículas recuperadas')} no mês` : 'Oportunidades não fechadas',
      texto: `${novos ? `${plural(novos, 'contato de venda esperando (interessado, experimental ou ex-aluno)', 'contatos de venda esperando (interessados, experimentais e ex-alunos)')}. ` : ''}${nf ? `${plural(nf, 'interessado ainda sem motivo registrado', 'interessados ainda sem motivo registrado')}.` : 'Todos os interessados do mês já têm motivo registrado.'}`,
      acao: novos ? 'Interessado esfria rápido: o contato precisa sair hoje.' : nf ? 'Ofereça um horário de experimental já na primeira mensagem.' : '' },
    { area: 'Equipe', cor: atrasadas.length || vermelhas.length ? 'vermelho' : 'verde',
      titulo: atrasadas.length ? `${plural(atrasadas.length, 'consultora com atraso', 'consultoras com atraso')}` : vermelhas.length ? 'Ritmo abaixo hoje' : 'Equipe em dia',
      texto: atrasadas.length ? atrasadas.map((c) => `${c.nome.split(' ')[0]} (${c.atrasados})`).join(', ') + ' com contatos atrasados.'
        : vermelhas.length ? vermelhas.map((c) => `${c.nome.split(' ')[0]} ${c.feitos_hoje}/${c.minimo}`).join(', ') + ' — abaixo da metade do mínimo de hoje.'
        : 'Ninguém com lista atrasada.',
      acao: atrasadas.length || vermelhas.length ? 'Converse hoje e veja se é falta de tempo (recepção, vendas) ou de organização.' : '' },
  ];
}

// "Precisa da sua atenção": só o que pede uma ação do gestor
// desligadas: rotinas automáticas da EVO ainda desligadas (nomes), para o gestor simular e ligar
export function atencao(p, unidades, hora = 12, desligadas = []) {
  const lista = [];
  if (desligadas.length) {
    lista.push({ texto: `${desligadas.length === 1 ? 'Uma lista automática ainda está desligada' : `${desligadas.length} listas automáticas ainda estão desligadas`}: ${desligadas.join(', ')}.`,
      acao: 'Em Configurações → EVO, clique em "Simular agora", confira os números e depois em "Ligar automático".', rota: '#/configuracoes' });
  }
  for (const u of unidades) {
    if (!u.consultoras?.length) {
      if (u.automacao_ativa === false) continue;   // unidade desligada de propósito: sem alerta
      lista.push({ texto: `${u.nome} está sem consultoras cadastradas: as listas não são distribuídas.`, acao: 'Cadastre as consultoras e coloque-as na divisão das listas.', rota: '#/configuracoes' });
      continue;
    }
    for (const c of u.consultoras) {
      if (c.atrasados > 0) lista.push({ texto: `${c.nome} tem ${plural(c.atrasados, 'contato atrasado', 'contatos atrasados')}.`, acao: 'Converse e combine quando ela coloca em dia.', rota: '#/desempenho' });
      else if (hora >= 14 && c.minimo >= 3 && c.feitos_hoje * 2 < c.minimo) lista.push({ texto: `${c.nome} fez ${c.feitos_hoje} de ${c.minimo} contatos do mínimo de hoje.`, acao: 'Veja se algo está travando o dia dela.' });
      if (c.pct_semana_passada != null && c.pct_semana_passada < 80) lista.push({ texto: `${c.nome} fez ${c.pct_semana_passada}% das listas da semana passada.` });
    }
    for (const t of u.erros_evo_hoje || []) lista.push({ texto: `A busca automática na EVO (${t}) falhou hoje em ${u.nome}.`, acao: 'Veja o histórico em Configurações → EVO.', rota: '#/configuracoes' });
  }
  if (p.whatsapp_falhas_hoje > 0) lista.push({ texto: `${plural(p.whatsapp_falhas_hoje, 'mensagem de WhatsApp não foi entregue', 'mensagens de WhatsApp não foram entregues')} hoje.`, acao: 'Confira os números de WhatsApp em Configurações → WhatsApp.', rota: '#/configuracoes' });
  const cfg = p.config || {};
  if (!(Number(cfg.mensalidade_media) > 0)) lista.push({ texto: 'Informe a mensalidade média do aluno para o Retorno do mês mostrar os alunos recuperados em R$.', rota: '#/retorno' });
  return lista;
}

// Quadrante esforço × resultado
export function quadrante(c, medContatos, medTaxa) {
  const muito = c.contatos_30d >= medContatos;
  const bom = c.decididos_30d ? c.positivos_30d / c.decididos_30d >= medTaxa : false;
  if (muito && bom) return { icone: '⭐', nome: 'Referência', acao: 'Peça para ela mostrar às colegas como aborda os alunos.' };
  if (muito && !bom) return { icone: '🎯', nome: 'Faz bastante, converte pouco', acao: 'Treinar a abordagem: revisar a mensagem e o que ela oferece.' };
  if (!muito && bom) return { icone: '⏰', nome: 'Converte bem, faz pouco', acao: 'Falta tempo ou organização: veja o que ocupa o dia dela.' };
  return { icone: '🚨', nome: 'Faz pouco e converte pouco', acao: 'Conversa individual: entender o motivo e combinar metas diárias.' };
}

// Retorno do mês: valor estimado e "cada R$ 1"
export function retornoTotais(r) {
  const cfg = r.config || {};
  const mensalidade = Number(cfg.mensalidade_media) || 0;
  const plataforma = Number(cfg.plataforma_mensalidade) || 0;
  const t = { pagou: 0, valor: 0, voltou: 0, matriculou: 0, renovou: 0, sozinhos: 0, contatos: 0, listas: 0, rc: 0, rcv: 0, rs: 0, rsv: 0 };
  for (const u of r.unidades) {
    const x = u.resultados || {};
    t.pagou += +x.pagou || 0; t.valor += +x.valor || 0; t.voltou += +x.voltou || 0; t.matriculou += +x.matriculou || 0; t.renovou += +x.renovou || 0;
    t.sozinhos += +x.sozinhos || 0; t.contatos += +u.contatos || 0; t.listas += +u.listas_automaticas || 0;
    t.rc += +x.risco_contato || 0; t.rcv += +x.risco_contato_voltou || 0; t.rs += +x.risco_sem_contato || 0; t.rsv += +x.risco_sem_contato_voltou || 0;
  }
  const mantido = mensalidade * (t.voltou + t.matriculou + t.renovou);
  const total = t.valor + mantido;
  return { ...t, mensalidade, plataforma, mantido, total, porReal: plataforma > 0 ? total / plataforma : null,
    efeito: t.rc >= 10 && t.rs >= 10 ? { com: Math.round(100 * t.rcv / t.rc), sem: Math.round(100 * t.rsv / t.rs) } : null };
}

// Diagnóstico da equipe no período (ranking): sobrecarga (a maioria abaixo de 80% do mínimo) x individual
export function diagnostico(lista, corte = 80) {
  const com = lista.filter((c) => c.pct != null);
  if (com.length === 0) return null;
  const abaixo = com.filter((c) => c.pct < corte);
  if (com.length >= 2 && abaixo.length * 2 > com.length) {
    return { cor: 'vermelho', titulo: 'Possível sobrecarga', texto: ` ${abaixo.length} de ${com.length} consultoras ficaram abaixo de ${corte}% do mínimo. Quando a maioria não dá conta, o problema costuma ser o volume — vale rever as listas.` };
  }
  if (abaixo.length) {
    return { cor: 'amarelo', titulo: 'Abaixo da equipe', texto: ` ${abaixo.map((c) => `${c.nome.split(' ')[0]} (${c.pct}%)`).join(', ')}. A equipe deu conta — veja as justificativas e converse.` };
  }
  return { cor: 'verde', titulo: 'Equipe no ritmo', texto: ` Todas cumpriram pelo menos ${corte}% do mínimo.` };
}

// Auditoria da justificativa: o que a consultora fez de fato no dia (vem de _atividade_do_dia no banco).
// a = { total, por_lista: [{ controle, titulo, n }], primeiro, ultimo, com_observacao, minutos_rajada }
export function resumoAtividade(a, nomes = {}) {
  if (!a || !a.total) return { texto: 'Nenhum contato marcado nesse dia.', alerta: '' };
  const listas = (a.por_lista || []).map((l) => `${l.titulo || nomes[l.controle] || l.controle} (${l.n})`).join(', ');
  const texto = `${a.total} ${a.total === 1 ? 'contato marcado' : 'contatos marcados'}: ${listas} · das ${a.primeiro} às ${a.ultimo}`
    + (a.com_observacao ? ` · ${a.com_observacao} com observação` : '');
  const alerta = a.minutos_rajada
    ? `${a.minutos_rajada} ${a.minutos_rajada === 1 ? 'minuto' : 'minutos'} com 5 ou mais contatos marcados de uma vez — confira se as mensagens foram enviadas de verdade.`
    : '';
  return { texto, alerta };
}
