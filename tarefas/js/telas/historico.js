// Histórico — tudo o que as pessoas fizeram na plataforma (Central e Bônus): quem, quando, o quê e em qual unidade.
// O banco já devolve só as unidades que o coordenador pode ver; o administrador geral vê tudo.
import * as dados from '../dados.js?v=20261127195325';
import { esc, dataHora, vazio, NOMES_CONTROLE } from '../ui.js?v=20261127195325';

const TABELAS = {
  profiles: 'Cadastro', config_central: 'Configuração', controles: 'Configuração das listas', motivos: 'Motivo',
  unidades: 'Unidade', feriados: 'Feriado', listas_fazer: 'Lista a fazer', escala_trocas: 'Troca de escala',
  dias_consultora: 'Dia da consultora', ausencias: 'Folga/atestado', palmas: 'Palmas', evo_unidades: 'Conexão EVO', escala: 'Escala',
  disputes: 'Bônus · contestação', deductions: 'Bônus · desconto', manual_sales: 'Bônus · venda manual',
  unassigned_sales: 'Bônus · venda sem dono', app_settings: 'Bônus · configuração',
};
const BONUS = ['disputes', 'deductions', 'manual_sales', 'unassigned_sales', 'app_settings'];
const ACOES_ITEM = {
  marcar: 'Marcou o contato', desmarcar: 'Desmarcou o contato', salvar_motivo: 'Registrou o motivo', editar_motivo: 'Mudou o motivo',
  editar_observacao: 'Editou a observação', assumir: 'Assumiu o interessado', excluir_interessado: 'Excluiu o interessado',
  mover: 'Passou para outra consultora', trocar_plantao: 'Trocou o plantão',
};
const ACOES = {
  importar: 'Subiu uma lista', desfazer_importacao: 'Desfez uma lista', dividir_sem_responsavel: 'Dividiu interessados sem responsável',
  trocada_pela_automatica: 'Lista trocada pela automática da EVO', definir_dia: 'Mudou um dia da escala', salvar_ciclo: 'Salvou o ciclo da escala',
  substituir_nome: 'Trocou um nome na escala', convidar: 'Convidou uma pessoa', tirado_recorrente: 'Saiu da renovação (contrato recorrente)', criar: 'Criou', editar: 'Alterou', apagar: 'Apagou',
};
// campos que mudam sozinhos ou não dizem nada para quem lê
const IGNORAR = new Set(['inserted_at', 'updated_at', 'criado_em', 'criada_em', 'atualizado_em', 'em', 'id', 'local_id']);
const ROTULO_CAMPO = {
  nome: 'nome', nome_evo: 'nome no EVO', whatsapp: 'WhatsApp', unidade: 'unidade', papel_tarefas: 'Central', papel_bonus: 'Bônus',
  ordem_rodizio: 'rodízio', ativo: 'ativo', unidades_coord: 'unidades que coordena', nome_bonus: 'nome no bônus', valor: 'valor',
  justificativa: 'justificativa', trabalhou: 'trabalhou', status: 'situação', resolution: 'decisão', amount: 'valor', reason: 'motivo',
  inadimplencia_inicio: 'início da inadimplência', grupo: 'grupo de unidades', automacao_ativa: 'rotinas da EVO', value: 'valor',
};

const curto = (v) => {
  if (v == null || v === '') return '—';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
};
// valores com nome amigável (grupo 'A' = Grupo 1…)
const valor = (k, v) => (k === 'grupo' && v ? `Grupo ${v.charCodeAt(0) - 64}` : curto(v));

function oQue(e) {
  if (e.tabela === 'itens') return ACOES_ITEM[e.acao] || ACOES[e.acao] || e.acao;
  if (e.tabela === 'importacoes') return ACOES[e.acao] || e.acao;
  const area = TABELAS[e.tabela] || e.tabela;
  return ['criar', 'editar', 'apagar'].includes(e.acao) ? `${ACOES[e.acao]} · ${area}` : `${ACOES[e.acao] || e.acao}`;
}

function detalhe(e) {
  const a = e.antes || {}, d = e.depois || {}, ref = e.depois || e.antes || {};
  if (e.tabela === 'itens') return [e.aluno || ref.nome, NOMES_CONTROLE[ref.controle_id]].filter(Boolean).join(' · ');
  if (e.tabela === 'importacoes') {
    return [NOMES_CONTROLE[ref.controle] || NOMES_CONTROLE[ref.controle_id], ref.linhas != null ? `${ref.linhas} linha(s)` : null].filter(Boolean).join(' · ');
  }
  const quem = ref.nome || ref.titulo || ref.student || ref.consultant || ref.chave || ref.key || ref.data || '';
  if (e.acao !== 'editar') return curto(quem);
  const mudou = Object.keys({ ...a, ...d }).filter((k) => !IGNORAR.has(k) && JSON.stringify(a[k]) !== JSON.stringify(d[k]))
    .filter((k) => k in d)   // campo que não veio no "depois" não mudou de verdade
    .map((k) => `${ROTULO_CAMPO[k] || k}: ${valor(k, a[k])} → ${valor(k, d[k])}`);
  return [quem, ...mudou].filter(Boolean).join(' · ');
}

const hojeMenos = (hoje, dias) => { const d = new Date(`${hoje}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - dias); return d.toISOString().slice(0, 10); };
let filtro = null;
let cache = { chave: '', lista: [] };   // só busca de novo no banco quando muda o período ou a unidade

export async function render(el, ctx, _params, { focarBusca = false } = {}) {
  const hoje = ctx.hoje();
  filtro ||= { de: hojeMenos(hoje, 6), ate: hoje, quem: '', area: '', busca: '' };
  const chave = `${filtro.de}|${filtro.ate}|${ctx.unidade || ''}`;
  if (cache.chave !== chave) cache = { chave, lista: await dados.historico(filtro.de, filtro.ate, ctx.unidade) };
  const lista = cache.lista;
  const pessoas = [...new Map(lista.map((e) => [e.por || 'auto', e.quem])).entries()].sort((x, y) => x[1].localeCompare(y[1]));
  const area = (e) => (BONUS.includes(e.tabela) ? 'bonus' : ['itens', 'importacoes'].includes(e.tabela) ? 'listas' : 'ajustes');
  const busca = filtro.busca.trim().toLowerCase();
  const vis = lista.filter((e) => (!filtro.quem || (e.por || 'auto') === filtro.quem) && (!filtro.area || area(e) === filtro.area)
    && (!busca || `${e.quem} ${oQue(e)} ${detalhe(e)}`.toLowerCase().includes(busca)));

  el.innerHTML = `<div class="cartao"><div class="filtros">
      <label class="campo">De<input class="ctrl" type="date" id="h-de" value="${filtro.de}" max="${hoje}"></label>
      <label class="campo">Até<input class="ctrl" type="date" id="h-ate" value="${filtro.ate}" max="${hoje}"></label>
      <label class="campo">Quem<select class="ctrl" id="h-quem"><option value="">Todo mundo</option>${pessoas.map(([id, n]) => `<option value="${id}" ${id === filtro.quem ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="campo">Onde<select class="ctrl" id="h-area"><option value="">Tudo</option>
        <option value="listas" ${filtro.area === 'listas' ? 'selected' : ''}>Listas e contatos</option>
        <option value="ajustes" ${filtro.area === 'ajustes' ? 'selected' : ''}>Cadastros, escala e ajustes</option>
        <option value="bonus" ${filtro.area === 'bonus' ? 'selected' : ''}>Controle de Bônus</option></select></label>
      <label class="campo">Buscar<input class="ctrl" id="h-busca" value="${esc(filtro.busca)}" placeholder="aluno, campo, palavra…"></label>
    </div>
    <p class="dica" style="margin-top:8px">${vis.length} registro(s)${lista.length >= 1000 ? ' — mostrando os 1.000 mais recentes; diminua o período para ver o resto' : ''}.
      ${ctx.ehSuper ? '' : 'Você vê o que aconteceu nas suas unidades.'}</p></div>
    <div class="cartao">${vis.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Quando</th><th>Quem</th><th>O que</th><th>Detalhe</th><th>Unidade</th></tr></thead><tbody>
      ${vis.map((e) => `<tr><td>${esc(dataHora(e.em))}</td><td class="nome">${esc(e.quem)}</td><td>${esc(oQue(e))}</td>
        <td class="dica">${esc(detalhe(e))}</td><td>${e.unidade ? esc(ctx.nomeUnidade(e.unidade).replace('Positiva ', '')) : '—'}</td></tr>`).join('')}
      </tbody></table></div>` : vazio('Nada registrado nesse período.')}</div>`;

  const ler = () => {
    filtro = { de: el.querySelector('#h-de').value || filtro.de, ate: el.querySelector('#h-ate').value || filtro.ate,
      quem: el.querySelector('#h-quem').value, area: el.querySelector('#h-area').value, busca: el.querySelector('#h-busca').value };
  };
  el.querySelectorAll('#h-de, #h-ate, #h-quem, #h-area').forEach((x) => x.addEventListener('change', () => { ler(); render(el, ctx); }));
  let t;
  const campoBusca = el.querySelector('#h-busca');
  campoBusca.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { ler(); render(el, ctx, null, { focarBusca: true }); }, 300); });
  if (focarBusca) { campoBusca.focus(); campoBusca.setSelectionRange(campoBusca.value.length, campoBusca.value.length); }
}
