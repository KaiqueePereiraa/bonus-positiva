// Análises — as telas de acompanhamento juntas, em abas (pedido de 26/11/2026: menos abas no menu, tudo num lugar só):
// Comercial (conversão, unidades, canais, IA), Kanban (WasFit), Contatos da equipe (mínimo, ranking), Resultados e Retorno em R$ (gestor).
// Cada aba é a tela de sempre, desenhada aqui dentro; os endereços antigos (#/comercial, #/kanban...) continuam valendo.
const ABAS = [
  ['comercial', 'Comercial', 'comercial', 'todos'],
  ['kanban', 'Kanban da WasFit', 'kanban', 'todos'],
  ['equipe', 'Contatos da equipe', 'desempenho', 'todos'],
  ['resultados', 'Resultados das listas', 'indicadores', 'admin'],
  ['professores', 'Professores', 'professores', 'admin'],
  ['retorno', 'Retorno em R$', 'retorno', 'admin'],
];

export async function render(el, ctx, [aba = 'comercial']) {
  const abas = ABAS.filter(([, , , quem]) => quem === 'todos' || ctx.ehAdmin);
  if (!abas.some(([id]) => id === aba)) aba = abas[0][0];
  el.innerHTML = `<div class="cartao" style="padding-bottom:0"><div class="abas">${abas.map(([id, r]) => `<button data-aba="${id}" class="${id === aba ? 'ativo' : ''}">${r}</button>`).join('')}</div></div>
    <div id="aba-conteudo" style="display:flex;flex-direction:column;gap:22px"></div>`;
  el.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/analises/${b.dataset.aba}`; }));
  const modulo = abas.find(([id]) => id === aba)[2];
  const tela = await import(`./${modulo}.js`);
  await tela.render(el.querySelector('#aba-conteudo'), ctx, []);
}
