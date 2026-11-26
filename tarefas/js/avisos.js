// Avisos do sino, calculados na hora a partir do estado das tarefas (nada fica "velho").
// As mesmas regras alimentam o resumo diário do WhatsApp (supabase/migrations/008_whatsapp.sql).
import { diaDaSemana, semanaDe } from './regras.js?v=20261126154150';
import { dataCurta, ROTA_CONTROLE, NOMES_CONTROLE } from './ui.js?v=20261126154150';

const ABERTA = (t) => t.status !== 'concluida' && t.status !== 'concluida_atraso';
const faltam = (t) => t.total - t.feitos;

// desde: dia (AAAA-MM-DD) em que o aviso passou a valer — usado para "novo" no sino.
const aviso = (id, nivel, texto, rota, desde) => ({ id, nivel, texto, rota, desde });

export function avisosConsultora({ tarefas, semResponsavel = 0, hoje, titulos = {}, pedidosTroca = [] }) {
  const lista = [];
  // pedidos de troca de escala que esperam a resposta dela: { id, quem, data } (a tela de Escala responde)
  for (const p of pedidosTroca) {
    lista.push(aviso(`escala-troca-${p.id}`, 'urgente', `${p.quem} pediu para trocar a escala de ${dataCurta(p.data)}. Aceite ou recuse em Escala.`, '#/escala', hoje));
  }
  for (const t of tarefas.filter(ABERTA)) {
    const rota = `#/${ROTA_CONTROLE[t.controle_id]}/${t.id}`;
    if (t.controle_id === 'inadimplencia') {
      if (t.status === 'atrasada') lista.push(aviso(`ina-atr-${t.id}`, 'urgente', `Inadimplência de ${dataCurta(t.prazo)} está atrasada: faltam ${faltam(t)} contatos.`, rota, t.prazo));
      // a lista é dividida entre todas: só avisa quando a parte dela já chegou
      else if (t.prazo === hoje && t.total) lista.push(aviso(`ina-hoje-${t.id}`, 'urgente', `Inadimplência de hoje: ${faltam(t)} contatos para fazer.`, rota, hoje));
    } else if (t.controle_id === 'risco') {
      if (t.status === 'atrasada') lista.push(aviso(`ris-atr-${t.id}`, 'urgente', `Risco de abandono (semana de ${dataCurta(t.periodo_inicio)}) atrasado: faltam ${faltam(t)} mensagens.`, rota, t.prazo));
      else if (t.prazo === hoje) lista.push(aviso(`ris-hoje-${t.id}`, 'urgente', `Último dia do risco de abandono: faltam ${faltam(t)} de ${t.total} mensagens.`, rota, hoje));
      else if (diaDaSemana(hoje) >= 3 && t.feitos < t.total) lista.push(aviso(`ris-qua-${t.id}`, 'alerta', `Risco de abandono: faltam ${faltam(t)} mensagens até ${dataCurta(t.prazo)}.`, rota, hoje));
      else lista.push(aviso(`ris-novo-${t.id}`, 'info', `Você tem ${t.total} alunos no risco de abandono desta semana (prazo ${dataCurta(t.prazo)}).`, rota, t.criada_em?.slice(0, 10) || hoje));
    } else if (t.controle_id === 'lista_fazer') {
      const nome = titulos[t.importacao_id] ? `"${titulos[t.importacao_id]}"` : 'A lista a fazer';
      if (t.status === 'atrasada') lista.push(aviso(`lf-atr-${t.id}`, 'urgente', `${nome} está atrasada: faltam ${faltam(t)} de ${t.total} contatos.`, rota, t.prazo));
      else if (t.prazo === hoje) lista.push(aviso(`lf-hoje-${t.id}`, 'urgente', `Último dia da lista ${nome}: faltam ${faltam(t)} de ${t.total} contatos.`, rota, hoje));
      else lista.push(aviso(`lf-novo-${t.id}`, 'info', `Nova lista a fazer ${nome}: ${t.total} contatos até ${dataCurta(t.prazo)}.`, rota, t.criada_em?.slice(0, 10) || hoje));
    } else if (NOMES_CONTROLE[t.controle_id]) {   // não fechou, renovação, ex-alunos e relacionamento
      const nome = NOMES_CONTROLE[t.controle_id];
      if (t.status === 'atrasada') lista.push(aviso(`ls-atr-${t.id}`, 'urgente', `${nome} (${dataCurta(t.periodo_inicio)}) atrasada: faltam ${faltam(t)} de ${t.total}.`, rota, t.prazo));
      else if (t.prazo === hoje) lista.push(aviso(`ls-hoje-${t.id}`, t.periodo_inicio === hoje ? 'alerta' : 'urgente', `${nome}: faltam ${faltam(t)} de ${t.total} até hoje.`, rota, hoje));
      else lista.push(aviso(`ls-novo-${t.id}`, 'info', `${nome}: ${t.total} contatos até ${dataCurta(t.prazo)}.`, rota, t.criada_em?.slice(0, 10) || hoje));
    }
  }
  if (semResponsavel > 0) {
    lista.push(aviso('nf-pool', +hoje.slice(8, 10) >= 5 ? 'alerta' : 'info', `${semResponsavel} interessado(s) sem responsável no "Por que não fechou?". Assuma os que você atendeu.`, '#/nao-fechou', hoje));
  }
  return ordenar(lista);
}

// As listas chegam sozinhas da EVO: falhas da busca automática aparecem no Painel ("Precisa da sua atenção").
export function avisosAdmin({ tarefas, nomeDe, nomeUnidade, semResponsavel = 0, hoje }) {
  const lista = [];
  const atrasadas = tarefas.filter((t) => t.status === 'atrasada');
  const porPessoa = {};
  for (const t of atrasadas) porPessoa[t.responsavel_id] = { n: (porPessoa[t.responsavel_id]?.n || 0) + 1, unidade: t.unidade };
  for (const [id, { n, unidade }] of Object.entries(porPessoa)) {
    lista.push(aviso(`adm-atr-${id}`, 'urgente', `${nomeDe(id)} (${nomeUnidade(unidade).replace('Positiva ', '')}) tem ${n} tarefa(s) atrasada(s).`, '#/painel', hoje));
  }
  if (semResponsavel > 0) {
    lista.push(aviso('adm-pool', 'info', `${semResponsavel} interessado(s) sem responsável no "Por que não fechou?".`, '#/nao-fechou', hoje));
  }
  return ordenar(lista);
}

const PESO = { urgente: 0, alerta: 1, info: 2 };
const ordenar = (l) => l.sort((a, b) => PESO[a.nivel] - PESO[b.nivel]);
