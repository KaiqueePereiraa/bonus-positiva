// Formulário de motivos: "Por que não fechou?" (etapas "fez experimental" e "não fez experimental"), "Renovação: venceu
// e não renovou" e "Cancelou". Usado pela tela do "Por que não fechou?" e pelas telas de grupo (_grupo.js).
import * as dados from '../dados.js?v=20261126192356';
import { normalizarTelefone, montarMensagem, linkWhatsApp } from '../regras.js?v=20261126192356';
import { esc, dataLonga, toast, erro, vazio, confirmar, ehCelular } from '../ui.js?v=20261126192356';
import { atualizarCabecalho, organizarLista, pendentesPrimeiro } from './_comum.js?v=20261126192356';

// Excluir interessado (só coordenador): para cadastro duplicado. Pede confirmação; o banco registra quem excluiu.
async function confirmarExclusao(nome) {
  return confirmar('Excluir interessado', `Excluir "${nome}" desta lista? Use para cadastro duplicado. A exclusão fica registrada, mas não dá para desfazer por aqui.`, 'Excluir');
}

export const ETAPAS = {
  fez_experimental: { titulo: 'Fez aula experimental e não fechou', selo: 'Fez experimental', cor: 'azul', pergunta: 'Por que não fechou depois da experimental?' },
  sem_experimental: { titulo: 'Cadastrou e não fez aula experimental', selo: 'Sem experimental', cor: 'laranja', pergunta: 'Por que não agendou a experimental?' },
};
// cada etapa tem os seus motivos (motivo sem etapa vale para as duas)
export const motivoServe = (m, etapa) => !m.etapa || !etapa || m.etapa === etapa;
// mensagem do WhatsApp: quem não fez experimental recebe o convite para a aula; os demais, a mensagem da lista
const modeloDe = (ctx, i) => {
  const cfg = ctx.controles?.[i.controle_id]?.config || {};
  return (i.dados?.etapa === 'sem_experimental' && cfg.mensagem_sem_experimental) || cfg.mensagem_whatsapp || '';
};

function linhaMotivo(i, ctx, editavel) {
  const d = i.dados || {};
  const info = d.info || [d.contrato, d.vencimento && `venceu/vence ${dataLonga(d.vencimento)}`, d.data_cadastro && `cadastro ${dataLonga(d.data_cadastro)}`, d.interesse, d.como_conheceu && `via ${d.como_conheceu}`, d.idade != null && `${d.idade} anos`].filter(Boolean).join(' · ');
  const motivo = ctx.motivos.find((m) => m.id === i.motivo_id);
  const etapa = d.etapa;
  const opcoes = ctx.motivos.filter((m) => (m.controle_id || 'nao_fechou') === i.controle_id
    && ((m.ativo && motivoServe(m, etapa)) || m.id === i.motivo_id));
  const alerta = d.aluno_mesmo_celular
    ? `<span class="selo laranja" title="Este celular está na ficha de um aluno ativo. Confira se é cadastro duplicado ou um novo aluno da mesma família.">Celular de aluno ativo: ${esc(d.aluno_mesmo_celular)}</span>` : '';
  if (i.resultado === 'matriculou_sem_contato') {
    return `<tr data-id="${i.id}" class="feito"><td class="nome">${esc(i.nome)}<span class="sub">${esc(info || `ID ${i.evo_id}`)}</span></td>
      <td colspan="2"><span class="selo azul" title="Conferido automaticamente na EVO">Já se matriculou</span><span class="sub">antes do contato · EVO</span></td><td class="acoes"></td></tr>`;
  }
  return `<tr data-id="${i.id}" class="${i.feito_em ? 'feito' : ''}">
    <td class="nome">${esc(i.nome)}<span class="sub">${esc(info || `ID ${i.evo_id}`)}</span>${alerta}</td>
    <td style="min-width:220px">${editavel ? `<select class="ctrl" data-campo="motivo" style="width:100%"><option value="">${esc(ETAPAS[etapa]?.pergunta || 'Escolha o motivo…')}</option>
        ${opcoes.map((m) => `<option value="${m.id}" ${m.id === i.motivo_id ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select>
        <input class="ctrl" data-campo="texto" placeholder="Qual foi o motivo?" value="${esc(i.motivo_texto || '')}" style="width:100%;margin-top:6px" ${motivo?.exige_texto ? '' : 'hidden'}>`
      : `${motivo ? esc(motivo.nome) : '<span class="dica">—</span>'}${i.motivo_texto ? `<span class="sub">${esc(i.motivo_texto)}</span>` : ''}`}</td>
    <td style="min-width:180px">${editavel ? `<textarea class="ctrl" data-campo="obs" rows="1" placeholder="Observação (opcional)">${esc(i.observacao || '')}</textarea>` : esc(i.observacao || '')}</td>
    <td class="acoes">${editavel && i.celular ? '<button class="btn wa peq" data-acao="wa">WhatsApp</button> ' : ''}${editavel ? `<button class="btn peq ${i.feito_em ? 'sec' : ''}" data-acao="salvar">${i.feito_em ? 'Atualizar' : 'Salvar'}</button>` : ''}
      ${i.feito_em ? '<span class="selo verde">Preenchido</span>' : ''}
      ${ctx.ehAdmin ? '<button class="btn perigo peq" data-acao="excluir" title="Excluir da lista (ex.: cadastro duplicado)">Excluir</button>' : ''}</td></tr>`;
}

// Salvar atualiza só a linha e o cabeçalho (a página não pula para o topo).
export async function formMotivos(el, ctx, tarefa, itens, { editavel, aoContar }) {
  if (!itens.length) { el.innerHTML = vazio('Nenhum interessado aqui.'); return; }
  itens.sort(pendentesPrimeiro);
  const comEtapa = itens.some((i) => i.dados?.etapa);
  const corpo = !comEtapa ? itens.map((i) => linhaMotivo(i, ctx, editavel)).join('')
    : Object.entries(ETAPAS).map(([k, e]) => {
      const doGrupo = itens.filter((i) => (i.dados?.etapa || 'sem_experimental') === k);
      return doGrupo.length ? `<tr class="grupo"><td colspan="4"><b>${esc(e.titulo)}</b> <span class="selo ${e.cor}">${doGrupo.length}</span> <span class="dica">${esc(e.pergunta)}</span></td></tr>${doGrupo.map((i) => linhaMotivo(i, ctx, editavel)).join('')}` : '';
    }).join('');
  el.innerHTML = `<div class="tabela-wrap"><table class="tabela responsiva"><thead><tr><th>Interessado</th><th>Motivo</th><th>Observação</th><th></th></tr></thead>
    <tbody>${corpo}</tbody></table></div>`;
  if (editavel) organizarLista(el, { comoMarcar: 'Toque em <b>WhatsApp</b> para conversar. Depois escolha o <b>motivo</b> e toque em <b>Salvar</b> — é o Salvar que marca o contato.' });
  el.onchange = (e) => {
    const s = e.target.closest('[data-campo="motivo"]');
    if (!s) return;
    const m = ctx.motivos.find((x) => x.id === +s.value);
    const texto = s.closest('td').querySelector('[data-campo="texto"]');
    texto.hidden = !m?.exige_texto;
    if (!texto.hidden) texto.focus();
  };
  el.onclick = async (e) => {
    const wa = e.target.closest('[data-acao="wa"]');
    if (wa) {
      if (dados.vendoComo()) { toast(dados.MSG_SO_OLHAR, 'erro'); return; }   // ver como consultora: não abre WhatsApp
      const alvo = itens.find((i) => i.id === wa.closest('tr').dataset.id);
      const url = alvo && linkWhatsApp(normalizarTelefone(alvo.celular), montarMensagem(modeloDe(ctx, alvo), { nome: alvo.nome }), { celular: ehCelular() });
      if (url) window.open(url, 'whatsapp');
      return;
    }
    const ex = e.target.closest('[data-acao="excluir"]');
    if (ex) {
      const trEx = ex.closest('tr');
      const id = trEx.dataset.id;
      const alvo = itens.find((i) => i.id === id);
      if (!(await confirmarExclusao(alvo?.nome || 'este interessado'))) return;
      ex.disabled = true;
      try {
        await dados.excluirInteressado(id);
        toast('Interessado excluído.');
        itens.splice(itens.findIndex((i) => i.id === id), 1);
        trEx.remove();
        atualizarCabecalho(tarefa, itens);
        aoContar?.(itens.filter((i) => !i.feito_em).length);
        if (!itens.length) el.innerHTML = vazio('Nenhum interessado aqui.');
        ctx.atualizarSino();
      } catch (err) { erro(err); ex.disabled = false; }
      return;
    }
    const b = e.target.closest('[data-acao="salvar"]');
    if (!b) return;
    const tr = b.closest('tr');
    const motivo = +tr.querySelector('[data-campo="motivo"]').value;
    if (!motivo) return toast('Escolha o motivo antes de salvar.', 'erro');
    b.disabled = true;
    try {
      const id = tr.dataset.id;
      await dados.salvarMotivo(id, motivo, tr.querySelector('[data-campo="texto"]').value, tr.querySelector('[data-campo="obs"]').value);
      toast('Motivo salvo.');
      const novo = await dados.item(id);
      itens[itens.findIndex((i) => i.id === id)] = novo;
      tr.outerHTML = linhaMotivo(novo, ctx, editavel);
      atualizarCabecalho(tarefa, itens);
      aoContar?.(itens.filter((i) => !i.feito_em).length);
      ctx.atualizarSino();
    } catch (err) { erro(err); b.disabled = false; }
  };
}
