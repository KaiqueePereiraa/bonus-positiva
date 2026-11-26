// Folgas, atestados e faltas (pedido de 23/11/2026) — cartão da tela Escala.
//  • Coordenador marca um dia (ou um período) para uma consultora dele; super admin, para todas.
//  • Nesse dia ela não tem mínimo: o que falta é dividido pelos outros dias úteis até o prazo.
//  • O coordenador escolhe se o dia quebra ou não a sequência 🔥 (padrão: falta quebra; folga/atestado não).
//  • A consultora só vê as próprias.
import * as dados from '../dados.js?v=20261126182118';
import { somarDias } from '../regras.js?v=20261126182118';
import { esc, dataCurta, diaSemana, toast, erro, modal, confirmar } from '../ui.js?v=20261126182118';

export const MOTIVOS = { folga: '🏖️ Folga', atestado: '🩺 Atestado', falta: '❌ Falta', outro: '📌 Outro' };
const seqTxt = (a) => (a.protege_sequencia === false ? '<span class="selo vermelho">quebra a sequência</span>' : '<span class="selo verde">não quebra a sequência</span>');

export async function cartaoAusencias(alvo, ctx, aoMudar) {
  if (!alvo) return;
  const hoje = ctx.hoje();
  const lista = await dados.ausencias(somarDias(hoje, -7), somarDias(hoje, 90)).catch(() => []);
  const consultoras = ctx.equipe.filter((p) => p.papel_tarefas === 'consultora' && p.ativo !== false);
  const minhas = ctx.ehAdmin ? lista : lista.filter((a) => a.consultora_id === ctx.perfil.id);
  if (!ctx.ehAdmin && !minhas.length) { alvo.innerHTML = ''; return; }

  const linha = (a) => `<div class="linha-info" data-pessoa="${a.consultora_id}" data-data="${a.data}">
      <span style="color:var(--dark)">${a.data === hoje ? '<b>Hoje</b>' : `${diaSemana(a.data)} ${dataCurta(a.data)}`}${a.data < hoje ? ' <span class="dica">(passou)</span>' : ''} ·
        ${ctx.ehAdmin ? `<b>${esc(ctx.nomeDe(a.consultora_id))}</b> · ` : ''}${MOTIVOS[a.motivo] || esc(a.motivo)}${a.obs ? ` <span class="dica">— ${esc(a.obs)}</span>` : ''} ${seqTxt(a)}</span>
      ${ctx.ehAdmin ? '<span class="acoes"><button class="btn sec peq" data-acao="aus-tirar">Tirar</button></span>' : ''}</div>`;

  alvo.innerHTML = `<div class="cartao"><h2>Folgas, atestados e faltas</h2>
    <p class="dica" style="margin-bottom:12px">${ctx.ehAdmin
      ? 'No dia marcado a consultora fica <b>sem mínimo</b>: o que falta das listas dela é dividido pelos outros dias úteis até o prazo. Ela também não recebe a mensagem da manhã nem a cobrança das 15h. Você escolhe se o dia <b>quebra ou não a sequência 🔥</b>. O prazo das listas não muda.'
      : 'Dias marcados pelo coordenador: neles você não tem mínimo.'}</p>
    ${minhas.length ? minhas.map(linha).join('') : '<p class="dica">Nenhuma marcada.</p>'}
    ${ctx.ehAdmin ? '<div class="linha-acoes" style="margin-top:12px"><button class="btn verde" data-acao="aus-marcar">+ Marcar folga/atestado</button></div>' : ''}</div>`;

  alvo.querySelector('[data-acao="aus-marcar"]')?.addEventListener('click', async () => {
    if (!consultoras.length) { toast('Nenhuma consultora para marcar.'); return; }
    const aberto = modal('Marcar folga, atestado ou falta', `<div style="display:flex;flex-direction:column;gap:12px">
        <label class="campo">Consultora<select class="ctrl" id="aus-pessoa">${consultoras.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></label>
        <label class="campo">Motivo<select class="ctrl" id="aus-motivo">${Object.entries(MOTIVOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <label class="campo">De<input type="date" id="aus-de" value="${hoje}" min="${somarDias(hoje, -7)}"></label>
          <label class="campo">Até<input type="date" id="aus-ate" value="${hoje}" min="${somarDias(hoje, -7)}"></label></div>
        <label class="campo">Sequência 🔥<select class="ctrl" id="aus-seq">
          <option value="protege">Não quebra (o dia não conta)</option>
          <option value="quebra">Quebra (conta como dia sem o mínimo)</option></select></label>
        <p class="dica" style="margin-top:-6px">"Quebra": funciona como um dia em que ela não bateu o mínimo — se tiver escudo 🛡️, o escudo é gasto; e entra no Desempenho. Não pede justificativa.</p>
        <label class="campo">Observação (opcional)<input id="aus-obs" maxlength="300" placeholder="Ex.: day off, atestado de 2 dias…"></label>
        <p class="dica">Só os dias úteis entram (fim de semana e feriado já não têm mínimo). Dá para marcar até 7 dias para trás.</p></div>`,
      { ler: true, acoes: [{ rotulo: 'Cancelar', classe: 'sec', valor: false }, { rotulo: 'Marcar', valor: true }] });
    // padrão: falta quebra a sequência; folga/atestado/outro não (o coordenador pode trocar)
    const motivo = document.querySelector('#aus-motivo');
    motivo?.addEventListener('change', () => { document.querySelector('#aus-seq').value = motivo.value === 'falta' ? 'quebra' : 'protege'; });
    const r = await aberto;
    if (!r?.valor) return;
    const de = r.campos['aus-de'], ate = r.campos['aus-ate'] || de;
    if (!de) { toast('Escolha a data.'); return; }
    try {
      const n = await dados.marcarAusencia(r.campos['aus-pessoa'], de, ate, r.campos['aus-motivo'], r.campos['aus-obs'], r.campos['aus-seq'] !== 'quebra');
      toast(`Marcado: ${n} dia(s) útil(eis) de ${ctx.nomeDe(r.campos['aus-pessoa'])}.`);
      aoMudar?.();
    } catch (e) { erro(e); }
  });

  alvo.querySelectorAll('[data-acao="aus-tirar"]').forEach((b) => b.addEventListener('click', async () => {
    const l = b.closest('[data-pessoa]');
    const { pessoa, data } = l.dataset;
    if (!(await confirmar('Tirar a marcação?', `${ctx.nomeDe(pessoa)} volta a ter mínimo em ${dataCurta(data)}.`, 'Tirar'))) return;
    try { await dados.desmarcarAusencia(pessoa, data); toast('Marcação tirada.'); aoMudar?.(); } catch (e) { erro(e); }
  }));
}
