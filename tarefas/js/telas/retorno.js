// Retorno do mês — quanto a Central trouxe de volta: alunos que voltaram, cobranças recebidas, matrículas.
// Conta só o que aconteceu DEPOIS do contato da equipe (quem resolveu sozinho fica à parte, como comparação).
import * as dados from '../dados.js?v=20261118140655';
import { esc, toast, erro, nomeMesCap } from '../ui.js?v=20261118140655';
import { retornoTotais, reais } from '../painel-regras.js?v=20261118140655';
import { abasRelatorios } from './_comum.js?v=20261118140655';

let escolhido = null;

export async function render(el, ctx) {
  const hoje = ctx.hoje();
  const meses = [];
  for (let k = 0; k < 36; k++) {   // 3 anos: dá para comparar o mesmo mês do ano passado (os dados escritos não são apagados)
    const d = new Date(`${hoje.slice(0, 7)}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - k);
    meses.push({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 });
  }
  escolhido ||= +hoje.slice(8, 10) <= 5 ? meses[1] : meses[0];   // começo do mês: mostra o mês que fechou
  const r = await dados.retornoMes(escolhido.ano, escolhido.mes);
  const unidades = ctx.unidade ? r.unidades.filter((u) => u.id === ctx.unidade) : r.unidades;
  const t = retornoTotais({ ...r, unidades });
  const fechado = r.fim < hoje && r.fim.slice(0, 7) !== hoje.slice(0, 7);

  el.innerHTML = `${abasRelatorios('retorno')}
    <div class="cartao nao-imprimir"><div class="linha-acoes">
      <label class="campo">Mês<select class="ctrl" id="mes">${meses.map((m) => `<option value="${m.ano}-${m.mes}" ${m.ano === escolhido.ano && m.mes === escolhido.mes ? 'selected' : ''}>${nomeMesCap(m.ano, m.mes)}</option>`).join('')}</select></label>
      <button class="btn sec" id="imprimir">Baixar PDF / imprimir</button></div></div>

    <div class="cartao retorno">
      <h2 style="font-size:20px">💰 Retorno de ${nomeMesCap(escolhido.ano, escolhido.mes)}${fechado ? '' : ' (até hoje)'} · ${esc(ctx.unidade ? ctx.nomeUnidade(ctx.unidade) : 'todas as unidades')}</h2>
      <div class="numeros" style="margin:14px 0">
        <div class="numero verde"><small>Trazido pela equipe com a Central</small><b>${reais(t.total)}</b><span>${t.mensalidade ? 'cobranças + alunos mantidos (estimativa)' : 'cobranças recebidas'}</span></div>
        <div class="numero azul"><small>Alunos que voltaram a treinar</small><b>${t.voltou}</b><span>depois do contato do risco</span></div>
        <div class="numero escuro"><small>Inadimplentes que pagaram</small><b>${t.pagou}</b><span>${reais(t.valor)} recebidos</span></div>
        <div class="numero"><small>Matrículas recuperadas</small><b>${t.matriculou}</b><span>interessados, experimentais e ex-alunos</span></div>
        <div class="numero"><small>Renovações</small><b>${t.renovou}</b><span>depois do contato da renovação</span></div>
      </div>
      ${t.porReal ? `<p style="font-size:17px;margin:6px 0"><b>📈 Para cada R$ 1 pago na plataforma, voltaram ${reais(t.porReal).replace('R$ ', 'R$ ')}.</b></p>` : ''}
      ${t.efeito ? `<p style="margin:6px 0">🔎 <b>Prova do efeito:</b> dos alunos em risco que receberam contato, <b>${t.efeito.com}%</b> voltaram; dos que ficaram sem contato, <b>${t.efeito.sem}%</b>.</p>` : ''}
      <p style="margin:6px 0">⏱️ ${t.listas} listas montadas sozinhas a partir da EVO e ${t.contatos} contatos feitos pela equipe. 🤖 ${t.sozinhos} pessoas resolveram sozinhas e saíram das listas antes do contato (não contam como resultado da equipe).</p>
      ${t.mensalidade ? `<p class="dica">Alunos mantidos, renovações e matrículas valem ${reais(t.mensalidade)} cada (mensalidade média informada), ou seja, uma mensalidade só: o valor é conservador.</p>` : ''}

      ${unidades.map((u) => {
        const x = u.resultados || {};
        return `<h3 style="margin:22px 0 8px">${esc(u.nome)}</h3>
          <p style="margin:0 0 8px">🏊 ${x.voltou || 0} voltaram · 💳 ${x.pagou || 0} pagaram (${reais(x.valor)}) · ✍️ ${x.matriculou || 0} matrículas · ${u.contatos} contatos feitos</p>
          ${u.consultoras.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Consultora</th><th>Contatos</th><th>Voltaram</th><th>Pagaram</th><th>R$ recebido</th><th>Matrículas</th></tr></thead><tbody>
            ${u.consultoras.map((c) => `<tr><td class="nome">${esc(c.nome)}</td><td>${c.contatos}</td><td>${c.voltou}</td><td>${c.pagou}</td><td>${reais(c.valor)}</td><td>${c.matriculou}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="dica">Sem consultoras cadastradas.</p>'}`;
      }).join('')}
    </div>

    <div class="cartao nao-imprimir"><h2>Valores para o cálculo</h2>
      <div class="filtros"><label class="campo">Mensalidade média do aluno (R$)<input class="ctrl" id="mensalidade" type="number" min="0" step="0.01" value="${t.mensalidade || ''}" placeholder="ex.: 289,90"></label>
        <label class="campo">Quanto vocês pagam pela plataforma por mês (R$)<input class="ctrl" id="plataforma" type="number" min="0" step="0.01" value="${t.plataforma || ''}" placeholder="ex.: 300"></label></div>
      <div class="linha-acoes" style="margin-top:10px"><button class="btn sec peq" id="salvar-valores">Salvar valores</button></div>
      <p class="dica" style="margin-top:6px">A mensalidade média transforma "alunos que voltaram" e "matrículas" em R$. O valor da plataforma mostra quanto voltou para cada R$ 1 investido.</p></div>`;

  el.querySelector('#mes').onchange = (e) => { const [a, m] = e.target.value.split('-').map(Number); escolhido = { ano: a, mes: m }; render(el, ctx); };
  el.querySelector('#imprimir').onclick = () => window.print();
  el.querySelector('#salvar-valores').onclick = async () => {
    const num = (id) => { const v = parseFloat(String(el.querySelector(id).value).replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : null; };
    try {
      await dados.salvarConfig('mensalidade_media', num('#mensalidade'));
      await dados.salvarConfig('plataforma_mensalidade', num('#plataforma'));
      toast('Valores salvos.');
      render(el, ctx);
    } catch (err) { erro(err); }
  };
}
