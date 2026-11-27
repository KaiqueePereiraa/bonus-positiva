// Modo claro/escuro da página de venda. Mesma chave do resto da plataforma (wasfit_tema), então a escolha vale nos dois.
(function () {
  const raiz = document.documentElement;
  const cor = document.querySelector('meta[name="theme-color"]');
  const pintar = () => {
    const escuro = raiz.dataset.tema === 'escuro';
    if (cor) cor.setAttribute('content', escuro ? '#0b0b0b' : '#ffffff');
    document.querySelectorAll('[data-tema-botao]').forEach((b) => {
      b.setAttribute('aria-label', escuro ? 'Mudar para o modo claro' : 'Mudar para o modo escuro');
      b.setAttribute('aria-pressed', String(escuro));
    });
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tema-botao]');
    if (!b) return;
    const escuro = raiz.dataset.tema !== 'escuro';
    if (escuro) raiz.dataset.tema = 'escuro'; else delete raiz.dataset.tema;
    try { localStorage.setItem('wasfit_tema', escuro ? 'escuro' : 'claro'); } catch (_) { /* sem armazenamento */ }
    pintar();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintar); else pintar();
})();
