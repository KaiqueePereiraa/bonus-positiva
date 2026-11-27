// Editor das regras do Bônus de uma academia (27/11/2026). Usado no Bônus → Configurações e no passo "Bônus" da trilha do
// 1º acesso (Central). Edita uma versão (bonus_config) que vale a partir de um mês — meses que já fecharam não mudam.
// Formato das regras: site/shared/bonus-motor.js. Salvar = função bonus_config_salvar (quem chama passa `salvar`).
import * as M from './bonus-motor.js?v=20261127195208';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (iso) => `${MESES[+iso.slice(5, 7) - 1]}/${iso.slice(0, 4)}`;
const mesMais = (iso, n) => { const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 10); };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reais = (v) => (Math.round(Number(v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(Math.round(Number(v || 0) * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 });
const clonar = (o) => JSON.parse(JSON.stringify(o));
const slug = (s) => M.semAcentoMin(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'equipe';

const ESTILO = `
.bce{display:grid;gap:14px;font-size:14px;color:var(--texto)}
.bce h4{font-size:15px;margin:0 0 6px}.bce .dica{color:var(--suave);font-size:12.5px;line-height:1.45}
.bce .caixa{border:1px solid var(--borda);border-radius:12px;padding:14px;background:var(--superficie)}
.bce .linha{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}
.bce label{display:grid;gap:4px;font-size:12.5px;font-weight:600;color:var(--suave)}
.bce label.chk{display:flex;align-items:center;gap:6px;font-weight:600;color:var(--texto)}
.bce input[type=text],.bce input[type=number],.bce select,.bce textarea{border:1px solid var(--borda);border-radius:8px;padding:7px 9px;font:inherit;font-size:14px;background:var(--superficie);color:var(--texto)}
.bce input[type=number]{width:90px}.bce textarea{width:100%;min-height:54px}
.bce table{width:100%;border-collapse:collapse}.bce td,.bce th{padding:5px 6px;border-bottom:1px solid var(--borda);text-align:left;font-size:13px;vertical-align:middle}
.bce th{color:var(--suave);font-weight:600}.bce td input[type=text]{width:100%}
.bce .abas{display:flex;flex-wrap:wrap;gap:6px}.bce .aba{border:1px solid var(--borda);background:var(--muted);border-radius:999px;padding:6px 12px;cursor:pointer;font:inherit;font-size:13px;color:var(--texto)}
.bce .aba.ativa{background:var(--primaria);border-color:var(--primaria);color:var(--primaria-texto);font-weight:700}
.bce .bt{border:1px solid var(--borda);background:var(--superficie);color:var(--texto);border-radius:8px;padding:6px 11px;cursor:pointer;font:inherit;font-size:13px}
.bce .bt.forte{background:var(--primaria);border-color:var(--primaria);color:var(--primaria-texto);font-weight:700}
.bce .bt.x{padding:3px 8px;color:var(--texto-perigo)}
.bce .exemplo{background:var(--muted);border-radius:10px;padding:10px 12px;font-size:14px}
.bce .erro{color:var(--texto-perigo);font-weight:600}.bce .ok{color:var(--texto-sucesso);font-weight:600}
`;

// el: onde desenhar · versoes: bonus_config_ler(true) · unidades: [{ id, nome, grupo }] da academia · hoje: 'AAAA-MM-DD'
// salvar(vale_de, regras) → Promise<versões novas>; podeSalvar: só o administrador geral
export function montarEditorBonus(el, { versoes = [], unidades = [], hoje, salvar, podeSalvar = true, aoSalvar } = {}) {
  if (!document.getElementById('bce-estilo')) {
    const st = document.createElement('style'); st.id = 'bce-estilo'; st.textContent = ESTILO; document.head.appendChild(st);
  }
  const atual = M.mesISO(hoje) || `${new Date().toISOString().slice(0, 7)}-01`;
  const meses = [atual, mesMais(atual, 1), mesMais(atual, 2)];
  let mes = atual, cfg, aba = 0, busca = '', todosPlanos = false, msg = '';

  // grupos de unidades (Configurações → Unidades e grupos) viram uma equipe; unidade sozinha = equipe dela
  function padrao() {
    const grupos = new Map();
    for (const u of unidades) { const k = u.grupo || `u:${u.id}`; (grupos.get(k) ?? grupos.set(k, []).get(k)).push(u); }
    const base = M.padraoNovo([]);
    const modelo = base.equipes[0];
    base.equipes = [...grupos.values()].map((us) => ({ ...clonar(modelo), id: slug(us.map((u) => u.nome).join(' ')).slice(0, 30), unidades: us.map((u) => u.id),
      nome: us.length > 1 ? us.map((u) => u.nome).join(' + ') : us[0].nome }));
    if (!base.equipes.length) base.equipes = [{ ...clonar(modelo), unidades: [] }];
    return base;
  }
  function carregar() {
    const v = M.versaoDoMes(versoes, mes);
    cfg = v ? clonar(v) : padrao();
    delete cfg.vale_de; delete cfg.atualizado_em;
    aba = Math.min(aba, cfg.equipes.length - 1);
  }
  carregar();

  const nomeUn = (id) => unidades.find((u) => u.id === id)?.nome || id;
  const get = (caminho) => caminho.split('.').reduce((o, k) => (o == null ? o : o[k]), cfg);
  function set(caminho, valor) {
    const ks = caminho.split('.'); let o = cfg;
    ks.slice(0, -1).forEach((k, i) => { if (o[k] == null) o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[k]; });
    o[ks.at(-1)] = valor;
  }
  const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));

  function htmlFaixasMeta(e, i) {
    const m = e.meta || {};
    const saidas = m.modo === 'saidas';
    const linhas = (m.faixas || []).map((f, j) => `<tr>
      <td><input type="text" data-k="equipes.${i}.meta.faixas.${j}.nome" value="${esc(f.nome)}"></td>
      <td>${saidas ? `<input type="number" step="1" data-t="n" data-k="equipes.${i}.meta.faixas.${j}.delta" value="${esc(f.delta ?? 0)}">`
        : `<input type="number" min="0" step="1" data-t="n" data-k="equipes.${i}.meta.faixas.${j}.vendas" value="${esc(f.vendas ?? '')}">`}</td>
      <td><input type="number" min="0" max="200" step="1" data-t="n" data-k="equipes.${i}.meta.faixas.${j}.pct" value="${esc(f.pct ?? '')}"> %</td>
      <td><button class="bt x" data-acao="tirar-faixa" data-j="${j}" title="Tirar esta faixa">✕</button></td></tr>`).join('');
    return `<div class="caixa"><h4>Meta da semana (por consultora)</h4>
      <div class="linha"><label>Como é a meta<select data-k="equipes.${i}.meta.modo" data-re="1">
        <option value="fixa" ${!saidas ? 'selected' : ''}>Fixa: número de vendas na semana</option>
        <option value="saidas" ${saidas ? 'selected' : ''}>Automática pelas saídas de alunos (EVO)</option></select></label>
        <label>Abaixo da 1ª faixa<input type="text" data-k="equipes.${i}.meta.abaixo" value="${esc(m.abaixo || 'Abaixo do básico')}"></label></div>
      ${saidas ? `<p class="dica" style="margin-top:8px">Básico = média das saídas dos 3 meses anteriores ÷ consultoras ÷ ${m.semanas || 4} semanas. Cada faixa é o Básico mais ou menos alguns contratos (ex.: −1, 0, +1).</p>` : ''}
      <table style="margin-top:8px"><thead><tr><th>Faixa</th><th>${saidas ? 'Diferença do Básico' : 'Vendas na semana'}</th><th>Paga da comissão</th><th></th></tr></thead><tbody>${linhas}</tbody></table>
      <button class="bt" data-acao="mais-faixa" style="margin-top:8px">+ Faixa</button></div>`;
  }

  function htmlPlanos(e, i) {
    const t = M.semAcentoMin(busca);
    const lista = (e.planos || []).map((p, j) => [p, j]).filter(([p]) => !t || M.semAcentoMin(p.texto).includes(t));
    const mostrar = todosPlanos ? lista : lista.slice(0, 30);
    const linhas = mostrar.map(([p, j]) => `<tr>
      <td><input type="text" data-k="equipes.${i}.planos.${j}.texto" value="${esc(p.texto)}" placeholder="Nome do contrato na EVO"></td>
      <td><select data-k="equipes.${i}.planos.${j}.modo"><option value="igual" ${p.modo !== 'contem' ? 'selected' : ''}>Nome igual</option><option value="contem" ${p.modo === 'contem' ? 'selected' : ''}>Contém</option></select></td>
      <td>R$ <input type="number" min="0" step="0.5" data-t="n" data-k="equipes.${i}.planos.${j}.venda" value="${esc(p.venda ?? '')}" placeholder="não conta"></td>
      ${e.renovacao?.paga ? `<td>R$ <input type="number" min="0" step="0.5" data-t="n" data-k="equipes.${i}.planos.${j}.renovacao" value="${esc(p.renovacao ?? '')}" placeholder="não paga"></td>
        <td><input type="number" min="1" max="9" step="1" data-t="n" data-k="equipes.${i}.planos.${j}.degrau" value="${esc(p.degrau ?? '')}" placeholder="—" title="Nível do plano: trocar para um nível maior é upgrade" style="width:64px"></td>` : ''}
      <td><select data-t="n" data-k="equipes.${i}.planos.${j}.meta"><option value="1" ${(p.meta ?? 1) === 1 ? 'selected' : ''}>Inteira</option><option value="0.5" ${p.meta === 0.5 ? 'selected' : ''}>Meia</option><option value="0" ${p.meta === 0 ? 'selected' : ''}>Não conta</option></select></td>
      <td><button class="bt x" data-acao="tirar-plano" data-j="${j}" title="Tirar este plano">✕</button></td></tr>`).join('');
    return `<div class="caixa"><h4>Valor por plano</h4>
      <p class="dica">Escreva o nome do contrato como está na EVO ("Nome igual") ou só um pedaço dele ("Contém", ex.: <i>Anual</i>). Valor vazio = o plano não conta. Meta: quanto a venda vale na meta da semana.${e.renovacao?.paga ? ' Renovação vazia = não paga. Nível (1, 2, 3…): trocar para um plano de nível maior paga o valor do upgrade.' : ''}</p>
      <div class="linha" style="margin:8px 0"><label>Procurar<input type="text" data-busca="1" value="${esc(busca)}" placeholder="nome do plano"></label>
        <label>Plano que não está na lista<select data-k="equipes.${i}.plano_sem_regra">
          ${e.plano_sem_regra === 'positiva' ? '<option value="positiva" selected>Regra antiga do sistema (como era antes)</option>' : ''}
          <option value="nao_conta" ${e.plano_sem_regra === 'nao_conta' || !e.plano_sem_regra ? 'selected' : ''}>Não conta</option>
          <option value="revisar" ${e.plano_sem_regra === 'revisar' ? 'selected' : ''}>Entra com R$ 0 para o gestor revisar</option></select></label></div>
      <table><thead><tr><th>Plano</th><th>Como achar</th><th>Venda</th>${e.renovacao?.paga ? '<th>Renovação</th><th title="Trocar para um plano de nível maior é upgrade">Nível</th>' : ''}<th>Meta</th><th></th></tr></thead><tbody>${linhas}</tbody></table>
      ${lista.length > mostrar.length ? `<button class="bt" data-acao="todos-planos" style="margin-top:8px">Mostrar os ${lista.length} planos</button>` : ''}
      <button class="bt" data-acao="mais-plano" style="margin-top:8px">+ Plano</button>
      <span class="dica" style="margin-left:8px">${(e.planos || []).length} plano(s)</span></div>`;
  }

  function htmlEquipe(e, i) {
    const be = e.bonus_equipe;
    const linhasBe = (be?.faixas || []).map((f, j) => `<tr>
      <td>${be.modo === 'regua'
        ? `<select data-k="equipes.${i}.bonus_equipe.faixas.${j}.chave">${(e.meta?.faixas || []).map((m) => `<option value="${esc(m.chave)}" ${m.chave === f.chave ? 'selected' : ''}>${esc(m.nome)} × consultoras × ${e.meta?.semanas || 4}</option>`).join('')}</select>`
        : `<input type="number" min="0" step="1" data-t="n" data-k="equipes.${i}.bonus_equipe.faixas.${j}.vendas" value="${esc(f.vendas ?? '')}"> vendas no mês`}</td>
      <td>R$ <input type="number" min="0" step="10" data-t="n" data-k="equipes.${i}.bonus_equipe.faixas.${j}.valor" value="${esc(f.valor ?? '')}"> por pessoa</td>
      <td><button class="bt x" data-acao="tirar-be" data-j="${j}">✕</button></td></tr>`).join('');
    const pr = e.premio;
    const linhasPr = (pr?.faixas || []).map((f, j) => `<tr>
      <td><input type="number" min="1" max="4" step="1" data-t="n" data-k="equipes.${i}.premio.faixas.${j}.semanas" value="${esc(f.semanas ?? '')}"> semanas na faixa de 100%</td>
      <td>R$ <input type="number" min="0" step="10" data-t="n" data-k="equipes.${i}.premio.faixas.${j}.valor" value="${esc(f.valor ?? '')}"></td>
      <td><button class="bt x" data-acao="tirar-premio" data-j="${j}">✕</button></td></tr>`).join('');
    const extras = [e.renda_extra?.faixas?.length ? `${esc(e.renda_extra.nome || 'Renda extra')} (${e.renda_extra.faixas.map((f) => `${f.pct}%`).join(' / ')})` : '',
      e.central ? `bônus da Central (+${e.central.bom}% Bom / +${e.central.otimo}% Ótimo)` : ''].filter(Boolean);
    const outras = new Set(cfg.equipes.filter((_, k) => k !== i).flatMap((x) => x.unidades || []));
    return `
      <div class="caixa"><div class="linha">
        <label>Nome da equipe<input type="text" data-k="equipes.${i}.nome" value="${esc(e.nome)}"></label>
        <label>Quem cadastrou fica com<span><input type="number" min="0" max="100" step="5" data-t="n" data-k="equipes.${i}.divisao.cadastro" value="${esc(e.divisao?.cadastro ?? 70)}"> % · quem converteu: <b data-conv="${i}">${100 - Number(e.divisao?.cadastro ?? 70)}%</b></span></label></div>
        <p class="dica" style="margin:10px 0 4px">Unidades desta equipe (meta e bônus de equipe juntos):</p>
        <div class="linha">${unidades.map((u) => `<label class="chk"><input type="checkbox" data-unid="${esc(u.id)}" ${(e.unidades || []).includes(u.id) ? 'checked' : ''} ${outras.has(u.id) ? 'disabled title="Já está em outra equipe"' : ''}> ${esc(u.nome)}</label>`).join('')}</div></div>
      ${htmlFaixasMeta(e, i)}
      <div class="caixa"><h4>Renovação e rematrícula</h4><div class="linha">
        <label class="chk"><input type="checkbox" data-t="b" data-k="equipes.${i}.renovacao.paga" data-re="1" ${e.renovacao?.paga ? 'checked' : ''}> Renovação e troca de plano pagam (valor por plano; não contam na meta)</label>
        ${e.renovacao?.paga ? `<label>Upgrade (troca para plano maior)<span>R$ <input type="number" min="0" step="1" data-t="n" data-k="equipes.${i}.renovacao.upgrade.valor" value="${esc(e.renovacao?.upgrade?.valor ?? '')}"></span></label>` : ''}</div>
        <div class="linha" style="margin-top:8px">
        <label class="chk"><input type="checkbox" data-t="b" data-k="equipes.${i}.rematricula.paga" ${e.rematricula?.paga !== false ? 'checked' : ''}> Rematrícula paga (100% para a consultora da ficha, valor da venda)</label>
        <label>Conta como rematrícula quem ficou mais de<span><input type="number" min="1" max="365" step="1" data-t="n" data-k="equipes.${i}.rematricula.dias" value="${esc(e.rematricula?.dias ?? 15)}"> dias sem contrato</span></label></div></div>
      ${htmlPlanos(e, i)}
      <div class="caixa"><h4>Bônus de equipe (no mês)</h4><div class="linha">
        <label>Tipo<select data-acao-sel="tipo-be" data-re="1"><option value="" ${!be ? 'selected' : ''}>Sem bônus de equipe</option>
          <option value="fixo" ${be?.modo === 'fixo' ? 'selected' : ''}>Por número de vendas da equipe</option>
          <option value="regua" ${be?.modo === 'regua' ? 'selected' : ''} ${e.meta?.modo !== 'saidas' ? 'disabled' : ''}>Pela meta automática (faixa × consultoras × semanas)</option></select></label>
        ${be ? `<label>Quem recebe<select data-k="equipes.${i}.bonus_equipe.quem"><option value="quem_vendeu" ${be.quem === 'quem_vendeu' ? 'selected' : ''}>Quem vendeu algo no mês</option>
          <option value="quem_vendeu_meta" ${be.quem === 'quem_vendeu_meta' ? 'selected' : ''}>Quem fez venda que conta na meta</option>
          <option value="equipe" ${be.quem === 'equipe' ? 'selected' : ''}>Só as consultoras da equipe</option></select></label>
          <label class="chk"><input type="checkbox" data-t="b" data-k="equipes.${i}.bonus_equipe.trava_saidas" ${be.trava_saidas ? 'checked' : ''}> Só paga se a equipe vender pelo menos as saídas do mês</label>` : ''}</div>
        ${be ? `<table style="margin-top:8px"><tbody>${linhasBe}</tbody></table><button class="bt" data-acao="mais-be" style="margin-top:8px">+ Faixa</button>` : ''}</div>
      <div class="caixa"><h4>Prêmio do mês</h4>
        <label class="chk"><input type="checkbox" data-acao-sel="premio" data-re="1" ${pr ? 'checked' : ''}> Tem prêmio pelas semanas na faixa mais alta</label>
        ${pr ? `<div class="linha" style="margin-top:8px"><label>Nome do prêmio<input type="text" data-k="equipes.${i}.premio.nome" value="${esc(pr.nome || '')}" placeholder="ex.: vale-compras"></label>
          <label class="chk"><input type="checkbox" data-t="b" data-k="equipes.${i}.premio.piso_todas" ${pr.piso_todas ? 'checked' : ''}> Perde se alguma semana ficar abaixo da 1ª faixa</label></div>
          <table style="margin-top:8px"><tbody>${linhasPr}</tbody></table><button class="bt" data-acao="mais-premio" style="margin-top:8px">+ Faixa</button>` : ''}</div>
      ${extras.length ? `<p class="dica">Esta equipe também tem ${extras.join(' e ')}. Para mudar, fale com a WasFit.</p>` : ''}
      ${cfg.equipes.length > 1 ? `<div><button class="bt x" data-acao="tirar-equipe">Tirar esta equipe</button></div>` : ''}`;
  }

  function htmlExemplo(e) {
    const planos = (e.planos || []).filter((p) => Number(p.venda) > 0);
    if (!planos.length) return '<div class="exemplo">Cadastre pelo menos um plano com valor para ver um exemplo.</div>';
    const sel = el.querySelector('[data-ex-plano]')?.value;
    const p = planos.find((x) => x.texto === sel) || planos.find((x) => (x.meta ?? 1) === 1) || planos[0];
    const n = Math.max(1, Math.min(30, Number(el.querySelector('[data-ex-n]')?.value) || 4));
    const r = M.exemplo(e, p, n, e.meta?.modo === 'saidas' ? { basico: 3 } : null);
    const [cad, conv] = M.divisao(e);
    return `<div class="exemplo"><div class="linha" style="margin-bottom:6px"><label>Exemplo: vendas na semana<input type="number" min="1" max="30" data-ex-n="1" value="${n}"></label>
      <label>do plano<select data-ex-plano="1">${planos.slice(0, 80).map((x) => `<option ${x === p ? 'selected' : ''}>${esc(x.texto)}</option>`).join('')}</select></label></div>
      <b>${n} venda${n > 1 ? 's' : ''} de ${esc(p.texto)} na semana = R$ ${reais(r.total)}</b> (${esc(r.faixa)}, ${Math.round(r.pct * 100)}% de R$ ${reais(r.valor * n)}) para quem cadastrou e converteu.
      Se forem pessoas diferentes: ${cad}% para quem cadastrou e ${conv}% para quem converteu, cada uma pela faixa dela.${e.meta?.modo === 'saidas' ? ' (Exemplo com Básico = 3.)' : ''}</div>`;
  }

  function render() {
    const e = cfg.equipes[aba];
    const temVersao = M.versaoDoMes(versoes, mes);
    const origem = temVersao ? (String(temVersao.vale_de).slice(0, 10) === mes ? `Editando as regras de ${nomeMes(mes)}.` : `Hoje vale a versão de ${nomeMes(String(temVersao.vale_de).slice(0, 10))}; ao salvar, as mudanças valem de ${nomeMes(mes)} em diante.`) : 'Ainda não há regras salvas: este é um ponto de partida.';
    el.innerHTML = `<div class="bce">
      <div class="linha"><label>Vale a partir de<select data-mes="1">${meses.map((m) => `<option value="${m}" ${m === mes ? 'selected' : ''}>${nomeMes(m)}</option>`).join('')}</select></label>
        <span class="dica">${origem} Meses que já fecharam não mudam.</span></div>
      <div class="abas">${cfg.equipes.map((x, k) => `<button class="aba ${k === aba ? 'ativa' : ''}" data-aba="${k}">${esc(x.nome || `Equipe ${k + 1}`)}</button>`).join('')}
        ${podeSalvar ? '<button class="bt" data-acao="mais-equipe">+ Equipe</button>' : ''}</div>
      ${htmlEquipe(e, aba)}
      <div data-exemplo="1">${htmlExemplo(e)}</div>
      <div class="caixa"><h4>Contratos que ficam fora do Bônus (todas as equipes)</h4>
        <p class="dica">Palavras separadas por vírgula. Contrato com qualquer uma delas no nome não conta (ex.: convênio, permuta, colaborador).</p>
        <textarea data-especiais="1">${esc((cfg.especiais || []).join(', '))}</textarea></div>
      <div class="linha">${podeSalvar ? '<button class="bt forte" data-acao="salvar">Salvar regras do Bônus</button>' : '<span class="dica">Só o administrador geral muda as regras.</span>'}
        <span data-msg="1">${msg}</span></div></div>`;
    if (!podeSalvar) el.querySelectorAll('input,select,textarea').forEach((x) => { if (!x.dataset.mes && !x.dataset.exN && !x.dataset.exPlano && !x.dataset.busca) x.disabled = true; });
  }

  function validar() {
    const vistas = new Map();
    for (const e of cfg.equipes) {
      if (!String(e.nome || '').trim()) return 'Dê um nome para cada equipe.';
      if (!(e.unidades || []).length) return `Marque pelo menos uma unidade na equipe "${e.nome}".`;
      for (const u of e.unidades) { if (vistas.has(u)) return `A unidade ${nomeUn(u)} está em duas equipes.`; vistas.set(u, e.nome); }
      if (!(e.meta?.faixas || []).length) return `Cadastre pelo menos uma faixa de meta na equipe "${e.nome}".`;
      if ((e.meta.faixas || []).some((f) => f.pct == null || (e.meta.modo !== 'saidas' && f.vendas == null))) return `Preencha vendas e % de todas as faixas da equipe "${e.nome}".`;
      const d = Number(e.divisao?.cadastro ?? 70);
      if (!(d >= 0 && d <= 100)) return 'A divisão cadastro × conversão precisa ficar entre 0% e 100%.';
      if ((e.planos || []).some((p) => !String(p.texto || '').trim())) return `Há plano sem nome na equipe "${e.nome}".`;
    }
    const semEquipe = unidades.filter((u) => !vistas.has(u.id));
    return semEquipe.length ? `Coloque em alguma equipe: ${semEquipe.map((u) => u.nome).join(', ')}.` : '';
  }

  function arrumar() {
    const ids = new Set();
    for (const e of cfg.equipes) {
      let id = e.id || slug(e.nome).slice(0, 30); let k = 2;
      while (ids.has(id)) id = `${(e.id || slug(e.nome)).slice(0, 27)}-${k++}`;
      e.id = id; ids.add(id);
      e.meta.faixas = (e.meta.faixas || []).slice().sort((a, b) => (e.meta.modo === 'saidas' ? (a.delta ?? 0) - (b.delta ?? 0) : a.vendas - b.vendas));
      if (e.meta.modo === 'saidas') e.meta.faixas.forEach((f) => { if (!f.chave) f.chave = slug(f.nome).replace(/-/g, '_'); });
      e.planos = (e.planos || []).map((p) => { const q = { ...p, texto: String(p.texto).trim() }; if (q.modo !== 'contem') delete q.modo; return q; });
    }
  }

  const atualizarExemplo = () => { const x = el.querySelector('[data-exemplo]'); if (x) x.innerHTML = htmlExemplo(cfg.equipes[aba]); };

  el.oninput = (ev) => {
    const t = ev.target;
    if (t.dataset.busca) { busca = t.value; const pos = t.selectionStart; render(); const b = el.querySelector('[data-busca]'); b.focus(); b.setSelectionRange(pos, pos); return; }
    if (t.dataset.exN || t.dataset.exPlano) { atualizarExemplo(); return; }
    if (t.dataset.especiais) { cfg.especiais = t.value.split(',').map((s) => s.trim()).filter(Boolean); return; }
    if (!t.dataset.k) return;
    const v = t.dataset.t === 'b' ? t.checked : t.dataset.t === 'n' ? num(t.value) : t.value;
    set(t.dataset.k, v);
    if (t.dataset.k.endsWith('divisao.cadastro')) { const c = el.querySelector(`[data-conv="${aba}"]`); if (c) c.textContent = `${100 - (Number(v) || 0)}%`; }
    if (t.dataset.k.endsWith('.nome') && t.dataset.k.split('.').length === 3) { const a = el.querySelector(`[data-aba="${aba}"]`); if (a) a.textContent = v || `Equipe ${aba + 1}`; }
    atualizarExemplo();
  };
  el.onchange = (ev) => {
    const t = ev.target;
    if (t.dataset.mes) { mes = t.value; carregar(); msg = ''; render(); return; }
    if (t.dataset.exPlano) { atualizarExemplo(); return; }
    const e = cfg.equipes[aba];
    if (t.dataset.unid) {
      e.unidades = t.checked ? [...new Set([...(e.unidades || []), t.dataset.unid])] : (e.unidades || []).filter((u) => u !== t.dataset.unid);
      return;
    }
    if (t.dataset.acaoSel === 'tipo-be') {
      e.bonus_equipe = !t.value ? null : t.value === 'regua'
        ? { modo: 'regua', quem: 'equipe', trava_saidas: true, faixas: (e.meta?.faixas || []).filter((f) => f.chave && f.chave !== 'entrada').map((f, k) => ({ chave: f.chave, valor: [200, 300, 500][k] ?? 300 })) }
        : { modo: 'fixo', quem: 'quem_vendeu', trava_saidas: false, faixas: [{ vendas: 40, valor: 200 }, { vendas: 50, valor: 300 }] };
      render(); return;
    }
    if (t.dataset.acaoSel === 'premio') { e.premio = t.checked ? { nome: '', piso_todas: true, faixas: [{ semanas: 2, valor: 100 }, { semanas: 4, valor: 200 }] } : null; render(); return; }
    if (t.dataset.k && t.dataset.k.endsWith('meta.modo')) {
      e.meta = t.value === 'saidas'
        ? { modo: 'saidas', abaixo: 'Abaixo da entrada', semanas: 4, base_padrao: 0, consultoras_padrao: 1, faixas: [{ nome: 'Entrada', chave: 'entrada', delta: -1, pct: 30 }, { nome: 'Básico', chave: 'basico', delta: 0, pct: 60 }, { nome: 'Meta real', chave: 'meta_real', delta: 1, pct: 100 }] }
        : { modo: 'fixa', abaixo: 'Abaixo do básico', faixas: [{ nome: 'Básico', vendas: 2, pct: 50 }, { nome: 'Meta real', vendas: 3, pct: 70 }, { nome: 'Super meta', vendas: 4, pct: 100 }] };
      if (t.value !== 'saidas' && e.bonus_equipe?.modo === 'regua') e.bonus_equipe = null;
    }
    if (t.dataset.re) render();
  };
  el.onclick = async (ev) => {
    const b = ev.target.closest('[data-acao],[data-aba]');
    if (!b) return;
    if (b.dataset.aba != null) { aba = +b.dataset.aba; busca = ''; todosPlanos = false; render(); return; }
    const e = cfg.equipes[aba], j = +b.dataset.j;
    switch (b.dataset.acao) {
      case 'mais-faixa': (e.meta.faixas ||= []).push(e.meta.modo === 'saidas' ? { nome: 'Nova faixa', chave: `faixa_${e.meta.faixas.length + 1}`, delta: 2, pct: 100 } : { nome: 'Nova faixa', vendas: null, pct: null }); break;
      case 'tirar-faixa': e.meta.faixas.splice(j, 1); break;
      case 'mais-plano': (e.planos ||= []).unshift({ texto: '', modo: 'contem', venda: null, meta: 1 }); busca = ''; break;
      case 'tirar-plano': e.planos.splice(j, 1); break;
      case 'todos-planos': todosPlanos = true; break;
      case 'mais-be': e.bonus_equipe.faixas.push(e.bonus_equipe.modo === 'regua' ? { chave: e.meta.faixas.at(-1)?.chave, valor: 0 } : { vendas: null, valor: null }); break;
      case 'tirar-be': e.bonus_equipe.faixas.splice(j, 1); break;
      case 'mais-premio': e.premio.faixas.push({ semanas: 3, valor: null }); break;
      case 'tirar-premio': e.premio.faixas.splice(j, 1); break;
      case 'mais-equipe': { const n = clonar(M.padraoNovo([]).equipes[0]); n.id = ''; n.nome = `Equipe ${cfg.equipes.length + 1}`; cfg.equipes.push(n); aba = cfg.equipes.length - 1; break; }
      case 'tirar-equipe': cfg.equipes.splice(aba, 1); aba = 0; break;
      case 'salvar': {
        const problema = validar();
        if (problema) { msg = `<span class="erro">${esc(problema)}</span>`; el.querySelector('[data-msg]').innerHTML = msg; return; }
        arrumar();
        b.disabled = true;
        try {
          const novas = await salvar(mes, clonar(cfg));
          if (Array.isArray(novas)) versoes = novas;
          msg = `<span class="ok">Regras salvas: valem de ${nomeMes(mes)} em diante.</span>`;
          carregar(); render();
          aoSalvar?.(versoes, mes);
        } catch (err) {
          b.disabled = false;
          msg = `<span class="erro">${esc(err?.message || 'Não foi possível salvar.')}</span>`;
          el.querySelector('[data-msg]').innerHTML = msg;
        }
        return;
      }
      default: return;
    }
    render();
  };
  render();
  return { regras: () => clonar(cfg), mes: () => mes };
}
