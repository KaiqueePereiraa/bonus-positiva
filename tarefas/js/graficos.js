// Gráficos (Chart.js 4.4.0, carregado no index.html). Uma série por gráfico, cor da marca,
// marcas finas, grade discreta e tooltip no passar do mouse.

// Cores da WasFit, claras ou escuras conforme o tema na hora de desenhar
const escuro = () => document.documentElement.dataset.tema === 'escuro';
const C = () => (escuro()
  ? { cor: '#3B82F6', destaque: '#2EE6A0', tinta: '#EDEDED', muda: '#9A9A9A', grade: '#2E2E2E', dica: '#262626' }
  : { cor: '#2563EB', destaque: '#16B981', tinta: '#1A1D23', muda: '#6B7080', grade: '#EBEBEB', dica: '#1A1D23' });
const FONTE = 'Geist';
const ativos = new WeakMap();

function criar(canvas, config) {
  ativos.get(canvas)?.destroy();
  const g = new window.Chart(canvas, config);
  ativos.set(canvas, g);
  return g;
}

const base = (sufixo) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: C().dica, padding: 10, cornerRadius: 8, displayColors: false,
      titleFont: { family: FONTE, weight: '600' }, bodyFont: { family: FONTE },
      callbacks: { label: (c) => `${c.formattedValue}${sufixo}` },
    },
  },
});

const eixo = (sufixo, max) => ({
  beginAtZero: true, max, grid: { color: C().grade }, border: { display: false },
  ticks: { color: C().muda, font: { family: FONTE, size: 11 }, callback: (v) => `${v}${sufixo}` },
});
const eixoRotulo = () => ({ grid: { display: false }, border: { color: C().grade }, ticks: { color: C().tinta, font: { family: FONTE, size: 12, weight: '500' } } });

export function barras(canvas, rotulos, valores, { sufixo = '', horizontal = false, max } = {}) {
  return criar(canvas, {
    type: 'bar',
    data: { labels: rotulos, datasets: [{ data: valores, backgroundColor: C().cor, hoverBackgroundColor: C().destaque, borderRadius: 4, borderSkipped: 'start', maxBarThickness: horizontal ? 22 : 44 }] },
    options: {
      ...base(sufixo),
      indexAxis: horizontal ? 'y' : 'x',
      scales: horizontal ? { x: eixo(sufixo, max), y: eixoRotulo() } : { y: eixo(sufixo, max), x: eixoRotulo() },
    },
  });
}

export function linha(canvas, rotulos, valores, { sufixo = '', max } = {}) {
  return criar(canvas, {
    type: 'line',
    data: { labels: rotulos, datasets: [{ data: valores, borderColor: C().cor, backgroundColor: C().cor, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0 }] },
    options: { ...base(sufixo), interaction: { mode: 'index', intersect: false }, scales: { y: eixo(sufixo, max), x: eixoRotulo() } },
  });
}

// Imagem do gráfico para o PDF.
export const imagem = (canvas) => (canvas ? canvas.toDataURL('image/png') : '');
