// Peças reaproveitadas pelas telas dos controles.
import * as dados from '../dados.js?v=20261106191808';
import { lerXlsx, lerCsv, matrizParaRegistros } from '../importar.js?v=20261106191808';
import { normalizarTelefone, montarMensagem, linkWhatsApp, statusTarefa } from '../regras.js?v=20261106191808';
import { esc, dataCurta, dataLonga, dataHora, diaSemana, seloStatus, barra, toast, erro, confirmar, vazio, ehCelular, STATUS } from '../ui.js?v=20261106191808';

// ── Leitura de planilha escolhida pelo usuário ──
export async function lerPlanilha(arquivo, controle) {
  const nome = arquivo.name.toLowerCase();
  let matriz;
  if (nome.endsWith('.csv')) matriz = lerCsv(await arquivo.text());
  else if (nome.endsWith('.xlsx')) matriz = await lerXlsx(await arquivo.arrayBuffer(), window.ExcelJS);
  else return { registros: [], avisos: [], erro: 'Envie um arquivo .xlsx ou .csv exportado do EVO.' };
  return matrizParaRegistros(matriz, controle);
}

// Área de upload (clique ou arrastar). aoEscolher(file)
export function areaUpload(el, texto, aoEscolher) {
  el.innerHTML = `<label class="upload"><input type="file" accept=".xlsx,.csv"><b>${esc(texto)}</b><br>Clique para escolher ou arraste o arquivo aqui (.xlsx ou .csv do EVO)</label>`;
  const rotulo = el.querySelector('.upload');
  const input = el.querySelector('input');
  input.addEventListener('change', () => input.files[0] && aoEscolher(input.files[0]));
  rotulo.addEventListener('dragover', (e) => { e.preventDefault(); rotulo.classList.add('arrastando'); });
  rotulo.addEventListener('dragleave', () => rotulo.classList.remove('arrastando'));
  rotulo.addEventListener('drop', (e) => {
    e.preventDefault(); rotulo.classList.remove('arrastando');
    if (e.dataTransfer.files[0]) aoEscolher(e.dataTransfer.files[0]);
  });
}

export const listaAvisos = (avisos) => (avisos.length
  ? `<div class="aviso-lista"><b>${avisos.length} linha(s) ignorada(s):</b><ul>${avisos.slice(0, 8).map((a) => `<li>${esc(a)}</li>`).join('')}${avisos.length > 8 ? `<li>…e mais ${avisos.length - 8}</li>` : ''}</ul></div>` : '');

// ── Cabeçalho de uma tarefa ──
// Os números ficam marcados com data-cab para atualizarCabecalho() mexer sem recarregar a página.
export function cabecalhoTarefa(t, ctx, { titulo, extra = '' }) {
  return `<div class="cartao" data-cab="${t.id}">
    <h2>${esc(titulo)} <span data-c="selo">${seloStatus(t.status, t.prazo_proximo)}</span></h2>
    <div class="numeros" style="margin-bottom:16px">
      <div class="numero escuro"><small>Total</small><b data-c="total">${t.total}</b></div>
      <div class="numero verde"><small>${t.controle_id === 'nao_fechou' ? 'Preenchidos' : 'Enviadas'}</small><b data-c="feitos">${t.feitos}</b></div>
      <div class="numero ${t.total - t.feitos > 0 && t.status === 'atrasada' ? 'vermelho' : 'azul'}"><small>Pendentes</small><b data-c="pendentes">${t.total - t.feitos}</b></div>
      <div class="numero"><small>Prazo</small><b style="font-size:22px">${dataCurta(t.prazo)}</b><span>${diaSemana(t.prazo)}<span data-c="concluida">${t.concluida_em ? ` · concluída ${dataHora(t.concluida_em)}` : ''}</span></span></div>
    </div>
    <div class="progresso" data-c="barra">${barra(t.feitos, t.total)}</div>
    ${ctx.ehAdmin ? `<p class="dica" style="margin-top:12px">Responsável: <b>${esc(ctx.nomeDe(t.responsavel_id))}</b>${t.trocada_em ? ` · plantão trocado em ${dataHora(t.trocada_em)}` : ''}</p>` : ''}
    ${extra}
  </div>`;
}

// Recalcula os números do cabeçalho a partir da lista de itens (sem ir ao servidor).
export function atualizarCabecalho(tarefa, itens) {
  const cab = document.querySelector(`[data-cab="${tarefa.id}"]`);
  if (!cab) return;
  const total = itens.length;
  const feitos = itens.filter((i) => i.feito_em).length;
  const concluidaEm = total && feitos === total ? itens.map((i) => i.feito_em).sort().at(-1) : null;
  const { status, prazoProximo } = statusTarefa({ total, feitos, prazo: tarefa.prazo, concluidaEm });
  const c = (n) => cab.querySelector(`[data-c="${n}"]`);
  c('selo').innerHTML = seloStatus(status, prazoProximo);
  c('total').textContent = total;
  c('feitos').textContent = feitos;
  c('pendentes').textContent = total - feitos;
  c('barra').innerHTML = barra(feitos, total);
  c('concluida').textContent = concluidaEm ? ` · concluída ${dataHora(concluidaEm)}` : '';
}

// Recarrega a tela inteira mantendo a rolagem (para ações que mudam a estrutura da página).
export async function recarregarNoLugar(fn) {
  const y = window.scrollY;
  await fn();
  window.scrollTo(0, y);
}

// ── Lista de contatos (inadimplência e risco) ──
// Marcar/desmarcar/mover atualizam só a linha e o cabeçalho — a página não pula para o topo.
export async function listaContatos(el, ctx, tarefa) {
  const itens = await dados.itensDaTarefa(tarefa.id);
  if (!itens.length) { el.innerHTML = vazio('Nenhum contato nesta tarefa.'); return; }
  const podeMexer = ctx.ehAdmin || tarefa.responsavel_id === ctx.perfil.id;
  const modelo = ctx.controles[tarefa.controle_id]?.config?.mensagem_whatsapp || '';
  const ehRisco = tarefa.controle_id === 'risco';
  const outras = ctx.consultorasDa(tarefa.unidade).filter((c) => c.id !== tarefa.responsavel_id);

  const linha = (i) => {
    const tel = normalizarTelefone(i.celular);
    const ultima = i.dados?.ultima_presenca ? dataLonga(i.dados.ultima_presenca.slice(0, 10)) : 'sem registro';
    return `<tr class="${i.feito_em ? 'feito' : ''}" data-id="${i.id}">
      <td class="nome">${esc(i.nome)}<span class="sub">ID ${esc(i.evo_id)}${i.repetido_semana_anterior ? ' · <span class="etiqueta">também na semana anterior</span>' : ''}</span></td>
      <td class="oculta-cel">${tel ? esc(`(${tel.slice(2, 4)}) ${tel.slice(4, -4)}-${tel.slice(-4)}`) : '<span class="dica">sem celular</span>'}</td>
      ${ehRisco ? `<td class="oculta-cel">${esc(ultima)}</td>` : ''}
      <td>${i.feito_em ? `<span class="selo verde">Enviada</span><span class="sub">${dataHora(i.feito_em)}${ctx.ehAdmin && i.feito_por && i.feito_por !== tarefa.responsavel_id ? ` por ${esc(ctx.nomeDe(i.feito_por))}` : ''}</span>` : '<span class="selo cinza">Pendente</span>'}</td>
      <td class="acoes">${!podeMexer ? '' : i.feito_em
        ? '<button class="btn sec peq" data-acao="desmarcar">Desmarcar</button>'
        : `${tel ? '<button class="btn wa peq" data-acao="wa">WhatsApp</button> ' : ''}<button class="btn peq" data-acao="marcar">Marcar enviada</button>`}
        ${ctx.ehAdmin && ehRisco && !i.feito_em && outras.length ? `<select class="ctrl" data-acao="mover" aria-label="Mover para"><option value="">Mover…</option>${outras.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select>` : ''}
      </td></tr>`;
  };

  el.innerHTML = `<div class="tabela-wrap"><table class="tabela responsiva">
    <thead><tr><th>Nome</th><th>Celular</th>${ehRisco ? '<th>Última presença</th>' : ''}<th>Status</th><th></th></tr></thead>
    <tbody>${itens.map(linha).join('')}</tbody></table></div>`;

  // troca só a linha do item e atualiza o cabeçalho
  const atualizarLinha = (id, novo) => {
    const idx = itens.findIndex((i) => i.id === id);
    const tr = el.querySelector(`tr[data-id="${id}"]`);
    if (novo) { itens[idx] = novo; tr.outerHTML = linha(novo); } else { itens.splice(idx, 1); tr.remove(); }
    atualizarCabecalho(tarefa, itens);
    ctx.atualizarSino();
  };
  const agir = async (alvo, id, fn, okMsg) => {
    alvo.disabled = true;
    try {
      await fn();
      if (okMsg) toast(okMsg);
      atualizarLinha(id, await dados.item(id).then((i) => (i?.tarefa_id === tarefa.id ? i : null)));
    } catch (e) { erro(e); alvo.disabled = false; }
  };

  el.onclick = (e) => {
    const b = e.target.closest('button[data-acao]');
    if (!b) return;
    const id = b.closest('tr').dataset.id;
    if (b.dataset.acao === 'wa') {
      const i = itens.find((x) => x.id === id);
      const url = linkWhatsApp(normalizarTelefone(i.celular), montarMensagem(modelo, { nome: i.nome }), { celular: ehCelular() });
      window.open(url, 'whatsapp');
      agir(b, id, () => dados.marcar(id));
    } else if (b.dataset.acao === 'marcar') agir(b, id, () => dados.marcar(id));
    else if (b.dataset.acao === 'desmarcar') agir(b, id, () => dados.desmarcar(id), 'Marcação desfeita.');
  };
  el.onchange = (e) => {
    const s = e.target.closest('select[data-acao="mover"]');
    if (!s || !s.value) return;
    const id = s.closest('tr').dataset.id;
    agir(s, id, () => dados.moverItem(id, s.value), `Aluno movido para ${ctx.nomeDe(s.value)}.`);
  };
}

// Link temporário para baixar o arquivo original.
export async function baixarArquivo(caminho) {
  try { window.open(await dados.linkArquivo(caminho), '_blank', 'noopener'); } catch (e) { erro(e); }
}

export async function confirmarDesfazer(imp) {
  return confirmar('Desfazer importação', `Remover a lista "${imp.arquivo_nome || 'sem nome'}" (${imp.linhas} linhas)? Só é possível enquanto ninguém marcou nada.`, 'Desfazer');
}

// Linha de progresso por consultora (blocos do admin).
export const linhaProgresso = (nome, feitos, total, status) =>
  `<div class="progresso" style="margin-bottom:10px"><span class="quem">${esc(nome)}</span>${barra(feitos, total)}${status ? ` ${seloStatus(status)}` : ''}</div>`;

export { STATUS };

// Telas do admin que trabalham numa unidade só: com "Todas as unidades" no topo, pede para escolher.
export function escolherUnidade(el, ctx, texto) {
  const lista = ctx.unidadesAtivas().length ? ctx.unidadesAtivas() : ctx.unidades;
  el.innerHTML = `<div class="cartao"><h2>${esc(texto)}</h2><p class="dica" style="margin-bottom:14px">Cada unidade tem as próprias listas e consultoras. Escolha qual unidade:</p>
    <div class="linha-acoes">${lista.map((u) => `<button class="btn sec" data-u="${u.id}">${esc(u.nome)}</button>`).join('')}</div></div>`;
  el.onclick = (e) => {
    const b = e.target.closest('[data-u]');
    if (!b) return;
    const sel = document.getElementById('sel-unidade');
    sel.value = b.dataset.u;
    sel.dispatchEvent(new Event('change'));
  };
}
