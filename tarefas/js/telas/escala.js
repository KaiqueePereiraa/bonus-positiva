// Escala de fim de semana e feriados.
//  • Todos veem os próximos fins de semana e feriados escalados (o nome de quem está olhando aparece em destaque).
//  • A consultora escalada pode pedir troca a uma colega, que aceita ou recusa (sem aprovação do coordenador).
//  • O coordenador monta o ciclo (que se repete para sempre), define quem trabalha em cada feriado,
//    edita um dia específico e acompanha o histórico de trocas.
import * as dados from '../dados.js?v=20261118140655';
import { somarDias } from '../regras.js?v=20261118140655';
import { esc, dataCurta, dataHora, toast, erro, vazio, modal, confirmar } from '../ui.js?v=20261118140655';
import { agendaEscala, opcoesTroca, lerOpcaoTroca, rotuloData } from '../escala.js?v=20261118140655';
import { calendarioHtml, chipsDoDia, legendaHtml } from '../escala-visual.js?v=20261118140655';

const SEMANAS_A_FRENTE = 10;
const ehSabado = (d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 6;
const proximoSabado = (hoje) => { let d = hoje; while (!ehSabado(d)) d = somarDias(d, 1); return d; };
const SELO = { pendente: ['laranja', 'Aguardando'], aceita: ['verde', 'Aceita'], recusada: ['vermelho', 'Recusada'], cancelada: ['cinza', 'Cancelada'] };
const seloTroca = (s) => `<span class="selo ${SELO[s]?.[0] || 'cinza'}">${SELO[s]?.[1] || esc(s)}</span>`;

// Janela "Escolher pessoas" (checkbox das consultoras + nomes livres). Devolve [{ id } | { nome }] ou null.
async function escolherPessoas(ctx, titulo, atuais) {
  const consultoras = ctx.equipe.filter((p) => p.papel_tarefas === 'consultora');
  const lista = [...consultoras, ...atuais.filter((p) => p.id && !consultoras.some((c) => c.id === p.id)).map((p) => ({ id: p.id, nome: ctx.nomeDe(p.id) }))];
  const marcadas = new Set(atuais.filter((p) => p.id).map((p) => p.id));
  const livres = atuais.filter((p) => !p.id).map((p) => p.nome).join(', ');
  const r = await modal(titulo, `<div style="display:flex;flex-direction:column;gap:10px">
      ${lista.map((c) => `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="p-${c.id}" ${marcadas.has(c.id) ? 'checked' : ''}> ${esc(c.nome)}</label>`).join('')}
      <label class="campo">Outras pessoas (sem login), separadas por vírgula<input id="livres" value="${esc(livres)}" placeholder="Ex.: Ana"></label>
      <p class="dica">Quem não tem login aparece na escala, mas não recebe lembrete no WhatsApp nem pede troca.</p></div>`,
    { ler: true, acoes: [{ rotulo: 'Cancelar', classe: 'sec', valor: false }, { rotulo: 'Salvar', valor: true }] });
  if (!r?.valor) return null;
  const pessoas = lista.filter((c) => r.campos[`p-${c.id}`]).map((c) => ({ id: c.id }));
  const vistos = new Set();
  for (const n of String(r.campos.livres || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!vistos.has(n.toLowerCase())) { vistos.add(n.toLowerCase()); pessoas.push({ nome: n }); }
  }
  return pessoas;
}

const paraBanco = (pessoas) => pessoas.map((p) => (p.id ? { pessoa_id: p.id } : { nome: p.nome }));

export async function render(el, ctx) {
  const hoje = ctx.hoje();
  const ini = somarDias(hoje, -1);
  const fim = somarDias(hoje, SEMANAS_A_FRENTE * 7);
  const eu = ctx.perfil.id;
  const [linhas, feriados, trocas] = await Promise.all([dados.escalaPeriodo(ini, fim), dados.feriados(), dados.trocasEscala()]);
  const blocos = agendaEscala({ ini, fim, linhas, feriados, incluirFeriadosVazios: ctx.ehAdmin });
  const consultoras = ctx.equipe.filter((p) => p.papel_tarefas === 'consultora');
  const nome = (id) => ctx.nomeDe(id);

  // ── pedidos de troca ──
  const vale = (t) => t.data_origem > hoje && (!t.data_troca || t.data_troca > hoje);
  const paraMim = trocas.filter((t) => t.destino_id === eu && t.status === 'pendente' && vale(t));
  const meusPedidos = trocas.filter((t) => t.solicitante_id === eu).slice(0, 8);
  const textoTroca = (t) => `<b>${esc(nome(t.solicitante_id))}</b> trabalha ${esc(rotuloData(t.data_origem))}`
    + (t.data_troca ? ` e fica com o dia ${esc(rotuloData(t.data_troca))} de <b>${esc(nome(t.destino_id))}</b>` : ` e pede que <b>${esc(nome(t.destino_id))}</b> cubra`);

  const cartaoPedidos = paraMim.length ? `<div class="cartao"><h2>Pedidos de troca para você</h2>
      ${paraMim.map((t) => `<div class="linha-info" data-troca="${t.id}"><span style="color:var(--dark)">${textoTroca(t)}.</span>
        <span class="acoes"><button class="btn peq" data-acao="aceitar">Aceitar</button> <button class="btn sec peq" data-acao="recusar">Recusar</button></span></div>`).join('')}
      <p class="dica" style="margin-top:10px">Se aceitar, a escala muda na hora e a colega é avisada.</p></div>` : '';

  const cartaoMeus = meusPedidos.length ? `<div class="cartao"><h2>Seus pedidos de troca</h2>
      ${meusPedidos.map((t) => `<div class="linha-info" data-troca="${t.id}"><span style="color:var(--dark)">${esc(rotuloData(t.data_origem))} → ${esc(nome(t.destino_id))}${t.data_troca ? ` (em troca de ${esc(rotuloData(t.data_troca))})` : ''}</span>
        <span class="acoes">${seloTroca(t.status)}${t.status === 'pendente' && vale(t) ? ' <button class="btn sec peq" data-acao="cancelar">Cancelar</button>' : ''}</span></div>`).join('')}</div>` : '';

  const semEscala = !linhas.length;
  const aviso = semEscala ? `<div class="cartao">${vazio(ctx.ehAdmin
    ? 'Ainda não há escala. Monte o ciclo dos fins de semana logo abaixo e escolha quem trabalha em cada feriado.'
    : 'O coordenador ainda não montou a escala.')}</div>` : '';

  el.innerHTML = `${cartaoPedidos}${cartaoMeus}${aviso}
    ${linhas.length ? `<div class="esc-barra"><div class="esc-legenda" aria-label="Cores de cada pessoa">${legendaHtml(blocos, { hoje, eu })}</div>
      ${!ctx.ehAdmin && blocos.some((b) => b.dias.some((d) => d.data >= hoje && d.pessoas.some((p) => p.id === eu))) ? '<button class="btn sec peq" data-acao="so-meus" aria-pressed="false">Só os meus dias</button>' : ''}</div>` : ''}
    <div class="esc-lista">${calendarioHtml(blocos, { hoje, eu, ehAdmin: ctx.ehAdmin })}</div>
    ${ctx.ehAdmin ? '<div id="ciclo-card"></div><div id="nomes-card"></div><div id="trocas-card"></div>' : ''}
    <p class="dica">Mostrando as próximas ${SEMANAS_A_FRENTE} semanas.${ctx.ehAdmin ? '' : ' Para trocar um dia, use "Pedir troca": a colega escolhida aceita ou recusa.'}</p>`;

  const recarregar = () => { ctx.atualizarSino(); return render(el, ctx); };
  const pessoasDoDia = (data) => blocos.flatMap((b) => b.dias).find((d) => d.data === data)?.pessoas.map((p) => (p.id ? { id: p.id } : { nome: p.nome })) || [];

  // ── ciclo (coordenador) ──
  let ciclo = null;
  const desenharCiclo = () => {
    const alvo = el.querySelector('#ciclo-card');
    if (!alvo || !ciclo) return;
    const quem = (lista) => `<div class="esc-chips">${chipsDoDia(lista.map((p) => ({ id: p.id || null, nome: p.id ? nome(p.id) : p.nome })))}</div>`;
    alvo.innerHTML = `<div class="cartao"><h2>Ciclo dos fins de semana</h2>
      <p class="dica" style="margin-bottom:14px">Monte quem fica no sábado e no domingo de cada fim de semana do ciclo. O ciclo se repete <b>sem fim</b>: depois do último volta para o 1º. Cada pessoa cai sempre no mesmo ponto.</p>
      <label class="campo" style="max-width:280px;margin-bottom:14px">Sábado do 1º fim de semana do ciclo<input type="date" id="ciclo-inicio" value="${esc(ciclo.inicio)}"></label>
      ${ciclo.semanas.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Fim de semana</th><th>Sábado</th><th>Domingo</th></tr></thead><tbody>
        ${ciclo.semanas.map((s, i) => `<tr><td class="nome">${i + 1}º <span class="dica">${ciclo.inicio ? `(${dataCurta(somarDias(ciclo.inicio, 7 * i))})` : ''}</span></td>
          <td>${quem(s.sabado)}<button class="btn sec peq" data-acao="ciclo-escolher" data-i="${i}" data-dia="sabado">Escolher</button></td>
          <td>${quem(s.domingo)}<button class="btn sec peq" data-acao="ciclo-escolher" data-i="${i}" data-dia="domingo">Escolher</button></td></tr>`).join('')}
        </tbody></table></div>` : '<p class="dica">Nenhum fim de semana no ciclo ainda. Adicione o primeiro.</p>'}
      <div class="linha-acoes" style="margin-top:14px"><button class="btn sec" data-acao="ciclo-add">+ Fim de semana</button>
        <button class="btn sec" data-acao="ciclo-rem" ${ciclo.semanas.length ? '' : 'disabled'}>Remover o último</button>
        <button class="btn verde" data-acao="ciclo-salvar">Salvar ciclo</button></div>
      <p class="dica" style="margin-top:10px">Salvar muda os fins de semana de hoje em diante. Trocas e edições de datas específicas já feitas continuam valendo sobre o novo ciclo: confira os próximos fins de semana depois de salvar.</p></div>`;
  };
  if (ctx.ehAdmin) {
    const [cfg, linhasCiclo] = await Promise.all([dados.escalaConfig(), dados.escalaCiclo()]);
    const n = cfg?.semanas || 0;
    ciclo = { inicio: cfg?.inicio || proximoSabado(hoje), semanas: Array.from({ length: n }, () => ({ sabado: [], domingo: [] })) };
    for (const c of linhasCiclo) if (c.semana < n) ciclo.semanas[c.semana][c.dia].push(c.pessoa_id ? { id: c.pessoa_id } : { nome: c.nome_livre });
    desenharCiclo();

    // pessoas que aparecem só pelo nome (sem cadastro): ciclo + próximas datas (feriados e trocas incluídos)
    const livres = new Map();
    for (const c of linhasCiclo) if (c.nome_livre) livres.set(c.nome_livre.trim().toLowerCase(), c.nome_livre.trim());
    for (const l of linhas) if (!l.pessoa_id && l.nome) livres.set(l.nome.trim().toLowerCase(), l.nome.trim());
    if (livres.size) {
      el.querySelector('#nomes-card').innerHTML = `<div class="cartao"><h2>Pessoas sem cadastro</h2>
        <p class="dica" style="margin-bottom:12px">Aparecem na escala só pelo nome. Quando o cadastro delas for criado, use <b>Vincular</b>: elas passam a valer em toda a escala (ciclo, feriados e trocas) e já recebem lembrete no WhatsApp e podem pedir troca. <b>Trocar nome</b> serve para substituir quem está fixo no ciclo por outra pessoa sem cadastro. Para alguém que vai só em um fim de semana, use <b>Editar</b> naquele dia e digite o nome em "Outras pessoas".</p>
        <div class="tabela-wrap"><table class="tabela"><tbody>${[...livres.values()].map((n) => `<tr><td class="nome">${esc(n)}</td>
          <td class="acoes"><button class="btn sec peq" data-acao="vincular" data-nome="${esc(n)}">Vincular a um cadastro</button>
          <button class="btn sec peq" data-acao="renomear" data-nome="${esc(n)}">Trocar nome</button></td></tr>`).join('')}</tbody></table></div></div>`;
    }

    const alvo = el.querySelector('#trocas-card');
    const recentes = trocas.slice(0, 20);
    alvo.innerHTML = `<div class="cartao"><h2>Trocas de escala</h2>${recentes.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Pedido</th><th>Quem pediu</th><th>Para</th><th>Dia</th><th>Em troca de</th><th>Situação</th></tr></thead><tbody>
      ${recentes.map((t) => `<tr><td>${dataHora(t.criada_em)}</td><td>${esc(nome(t.solicitante_id))}</td><td>${esc(nome(t.destino_id))}</td>
        <td>${esc(rotuloData(t.data_origem))}</td><td>${t.data_troca ? esc(rotuloData(t.data_troca)) : '—'}</td><td>${seloTroca(t.status)}</td></tr>`).join('')}
      </tbody></table></div>` : vazio('Nenhum pedido de troca até agora.')}</div>`;
  }

  // ── ações ──
  const rodar = async (fn, ok) => { try { await fn(); if (ok) toast(ok); await recarregar(); } catch (e) { erro(e); } };

  el.onclick = async (e) => {
    const b = e.target.closest('button[data-acao]');
    if (!b) return;
    const acao = b.dataset.acao;
    const idTroca = b.closest('[data-troca]')?.dataset.troca;

    if (acao === 'so-meus') {   // só mostra os cartões em que ela trabalha (nada é recarregado)
      const lista = el.querySelector('.esc-lista');
      const ligado = lista.classList.toggle('so-meus');
      b.setAttribute('aria-pressed', String(ligado));
      b.classList.toggle('ativo', ligado);
      lista.querySelectorAll('.esc-mes').forEach((m) => { m.hidden = ligado && !m.querySelector('.esc-card.meu'); });
      return;
    }
    if (acao === 'aceitar') return rodar(() => dados.responderTrocaEscala(idTroca, true), 'Troca aceita. A escala já mudou.');
    if (acao === 'recusar') {
      if (!(await confirmar('Recusar troca', 'A colega será avisada de que você não pode trocar.', 'Recusar'))) return;
      return rodar(() => dados.responderTrocaEscala(idTroca, false), 'Pedido recusado.');
    }
    if (acao === 'cancelar') return rodar(() => dados.cancelarTrocaEscala(idTroca), 'Pedido cancelado.');

    if (acao === 'pedir') {
      const data = b.dataset.data;
      const opc = opcoesTroca({ blocos, eu, origem: data, hoje, consultoras });
      if (!opc.length) return toast('Não há colegas disponíveis para trocar este dia.', 'erro');
      const r = await modal(`Pedir troca — ${rotuloData(data)}`, `<label class="campo">Quem pode ficar no seu lugar?
          <select id="opcao">${opc.map((o) => `<option value="${esc(o.valor)}">${esc(o.rotulo)}</option>`).join('')}</select></label>
        <p class="dica" style="margin-top:10px">A colega recebe um aviso e decide se aceita. A escala só muda se ela aceitar.</p>`,
        { ler: true, acoes: [{ rotulo: 'Cancelar', classe: 'sec', valor: false }, { rotulo: 'Enviar pedido', valor: true }] });
      if (!r?.valor) return;
      const { destino, dataTroca } = lerOpcaoTroca(r.campos.opcao);
      return rodar(() => dados.solicitarTrocaEscala(destino, data, dataTroca), 'Pedido enviado. Você será avisada quando ela responder.');
    }

    if (acao === 'editar') {
      const data = b.dataset.data;
      const pessoas = await escolherPessoas(ctx, `Quem trabalha — ${rotuloData(data)}`, pessoasDoDia(data));
      if (!pessoas) return;
      return rodar(() => dados.definirDiaEscala(data, paraBanco(pessoas)), 'Escala do dia atualizada.');
    }

    if (acao === 'vincular') {
      const livre = b.dataset.nome;
      if (!consultoras.length) return toast('Ainda não há cadastro de consultora para vincular. Crie o cadastro em Configurações → Usuários.', 'erro');
      const sugerida = consultoras.find((c) => c.nome.trim().toLowerCase().split(/\s+/)[0] === livre.trim().toLowerCase());
      const r = await modal(`Vincular "${livre}" a um cadastro`, `<label class="campo">Cadastro
          <select id="pessoa">${consultoras.map((c) => `<option value="${c.id}" ${c.id === sugerida?.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>
        <p class="dica" style="margin-top:10px">Em todas as datas da escala, "${esc(livre)}" passa a ser essa pessoa.</p>`,
        { ler: true, acoes: [{ rotulo: 'Cancelar', classe: 'sec', valor: false }, { rotulo: 'Vincular', valor: true }] });
      if (!r?.valor) return;
      return rodar(() => dados.substituirNomeEscala(livre, r.campos.pessoa, null), `${livre} agora está vinculada ao cadastro.`);
    }
    if (acao === 'renomear') {
      const livre = b.dataset.nome;
      const r = await modal(`Trocar o nome "${livre}"`, `<label class="campo">Novo nome<input id="novo" maxlength="60" placeholder="Ex.: Bia"></label>
        <p class="dica" style="margin-top:10px">O novo nome substitui "${esc(livre)}" em todas as datas da escala.</p>`,
        { ler: true, acoes: [{ rotulo: 'Cancelar', classe: 'sec', valor: false }, { rotulo: 'Trocar', valor: true }] });
      if (!r?.valor) return;
      if (!r.campos.novo.trim()) return toast('Digite o novo nome.', 'erro');
      return rodar(() => dados.substituirNomeEscala(livre, null, r.campos.novo.trim()), 'Nome trocado em toda a escala.');
    }

    // ciclo
    if (!ciclo) return;
    ciclo.inicio = el.querySelector('#ciclo-inicio')?.value || ciclo.inicio;
    if (acao === 'ciclo-add') { ciclo.semanas.push({ sabado: [], domingo: [] }); desenharCiclo(); return; }
    if (acao === 'ciclo-rem') { ciclo.semanas.pop(); desenharCiclo(); return; }
    if (acao === 'ciclo-escolher') {
      const s = ciclo.semanas[+b.dataset.i];
      const dia = b.dataset.dia;
      const pessoas = await escolherPessoas(ctx, `${+b.dataset.i + 1}º fim de semana — ${dia === 'sabado' ? 'sábado' : 'domingo'}`, s[dia]);
      if (pessoas) { s[dia] = pessoas; desenharCiclo(); }
      return;
    }
    if (acao === 'ciclo-salvar') {
      if (ciclo.semanas.length && !ehSabado(ciclo.inicio)) return toast('A data de início do ciclo precisa ser um sábado.', 'erro');
      const flat = ciclo.semanas.flatMap((s, i) => ['sabado', 'domingo'].flatMap((dia) => paraBanco(s[dia]).map((p) => ({ semana: i, dia, ...p }))));
      return rodar(() => dados.salvarCicloEscala(ciclo.semanas.length ? ciclo.inicio : null, ciclo.semanas.length, flat), 'Ciclo salvo.');
    }
  };
}
