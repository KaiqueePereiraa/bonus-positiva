// Avisos do sino, calculados na hora a partir do estado das tarefas (nada fica "velho").
// As mesmas regras alimentam o resumo diário do WhatsApp (supabase/migrations/008_whatsapp.sql).
import { diaDaSemana, semanaDe, mesReferenciaSugerido } from './regras.js?v=20261106194830';
import { dataCurta, nomeMes, ROTA_CONTROLE } from './ui.js?v=20261106194830';

const ABERTA = (t) => t.status !== 'concluida' && t.status !== 'concluida_atraso';
const faltam = (t) => t.total - t.feitos;

// desde: dia (AAAA-MM-DD) em que o aviso passou a valer — usado para "novo" no sino.
const aviso = (id, nivel, texto, rota, desde) => ({ id, nivel, texto, rota, desde });

export function avisosConsultora({ tarefas, semResponsavel = 0, hoje }) {
  const lista = [];
  for (const t of tarefas.filter(ABERTA)) {
    const rota = `#/${ROTA_CONTROLE[t.controle_id]}/${t.id}`;
    if (t.controle_id === 'inadimplencia') {
      if (t.status === 'atrasada') lista.push(aviso(`ina-atr-${t.id}`, 'urgente', `Inadimplência de ${dataCurta(t.prazo)} está atrasada. Suba a planilha e marque os contatos.`, rota, t.prazo));
      else if (t.prazo === hoje) lista.push(aviso(`ina-hoje-${t.id}`, 'urgente', 'Hoje é sua vez do controle de inadimplência! Suba a planilha de inadimplentes e marque quem recebeu mensagem.', rota, hoje));
      else if (t.prazo <= semanaDe(hoje).fim) lista.push(aviso(`ina-sem-${t.id}`, 'info', `Sua vez na inadimplência: ${dataCurta(t.prazo)}.`, rota, semanaDe(hoje).inicio));
    } else if (t.controle_id === 'risco') {
      if (t.status === 'atrasada') lista.push(aviso(`ris-atr-${t.id}`, 'urgente', `Risco de abandono (semana de ${dataCurta(t.periodo_inicio)}) atrasado: faltam ${faltam(t)} mensagens.`, rota, t.prazo));
      else if (t.prazo === hoje) lista.push(aviso(`ris-hoje-${t.id}`, 'urgente', `Último dia do risco de abandono: faltam ${faltam(t)} de ${t.total} mensagens.`, rota, hoje));
      else if (diaDaSemana(hoje) >= 3 && t.feitos < t.total) lista.push(aviso(`ris-qua-${t.id}`, 'alerta', `Risco de abandono: faltam ${faltam(t)} mensagens até ${dataCurta(t.prazo)}.`, rota, hoje));
      else lista.push(aviso(`ris-novo-${t.id}`, 'info', `Você tem ${t.total} alunos no risco de abandono desta semana (prazo ${dataCurta(t.prazo)}).`, rota, t.criada_em?.slice(0, 10) || hoje));
    } else if (t.controle_id === 'nao_fechou') {
      const mes = nomeMes(+t.periodo_inicio.slice(0, 4), +t.periodo_inicio.slice(5, 7));
      if (t.status === 'atrasada') lista.push(aviso(`nf-atr-${t.id}`, 'urgente', `"Por que não fechou?" de ${mes} está atrasado: faltam ${faltam(t)} motivos.`, rota, t.prazo));
      else if (t.prazo === hoje) lista.push(aviso(`nf-hoje-${t.id}`, 'urgente', `Último dia do "Por que não fechou?" de ${mes}: faltam ${faltam(t)} motivos.`, rota, hoje));
      else if (+hoje.slice(8, 10) >= 5) lista.push(aviso(`nf-5-${t.id}`, 'alerta', `"Por que não fechou?" de ${mes}: faltam ${faltam(t)} motivos até ${dataCurta(t.prazo)}.`, rota, hoje));
      else lista.push(aviso(`nf-novo-${t.id}`, 'info', `Lista de ${mes} disponível: ${t.total} interessados para justificar.`, rota, t.criada_em?.slice(0, 10) || hoje));
    }
  }
  if (semResponsavel > 0) {
    lista.push(aviso('nf-pool', +hoje.slice(8, 10) >= 5 ? 'alerta' : 'info', `${semResponsavel} interessado(s) sem responsável no "Por que não fechou?". Assuma os que você atendeu.`, '#/nao-fechou', hoje));
  }
  return ordenar(lista);
}

export function avisosAdmin({ tarefas, nomeDe, nomeUnidade, riscoPendente = [], naoFechouPendente = [], semResponsavel = 0, hoje, horaSP }) {
  const lista = [];
  const atrasadas = tarefas.filter((t) => t.status === 'atrasada');
  const porPessoa = {};
  for (const t of atrasadas) porPessoa[t.responsavel_id] = { n: (porPessoa[t.responsavel_id]?.n || 0) + 1, unidade: t.unidade };
  for (const [id, { n, unidade }] of Object.entries(porPessoa)) {
    lista.push(aviso(`adm-atr-${id}`, 'urgente', `${nomeDe(id)} (${nomeUnidade(unidade).replace('Positiva ', '')}) tem ${n} tarefa(s) atrasada(s).`, '#/visao-geral', hoje));
  }
  const dow = diaDaSemana(hoje);
  if (riscoPendente.length && dow >= 1 && dow <= 5 && (dow > 1 || horaSP >= 12)) {
    lista.push(aviso('adm-risco', 'alerta', `Lista de risco de abandono desta semana ainda não importada: ${riscoPendente.join(', ')}.`, '#/risco', semanaDe(hoje).inicio));
  }
  if (naoFechouPendente.length) {
    const { ano, mes } = mesReferenciaSugerido(hoje);
    lista.push(aviso('adm-nf', +hoje.slice(8, 10) >= 3 ? 'alerta' : 'info', `"Por que não fechou?" de ${nomeMes(ano, mes)} ainda não importado: ${naoFechouPendente.join(', ')}.`, '#/nao-fechou', `${hoje.slice(0, 8)}01`));
  }
  if (semResponsavel > 0) {
    lista.push(aviso('adm-pool', 'info', `${semResponsavel} interessado(s) sem responsável no "Por que não fechou?".`, '#/nao-fechou', hoje));
  }
  return ordenar(lista);
}

const PESO = { urgente: 0, alerta: 1, info: 2 };
const ordenar = (l) => l.sort((a, b) => PESO[a.nivel] - PESO[b.nivel]);
