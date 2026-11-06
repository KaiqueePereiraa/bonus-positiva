// Gráficos (Chart.js 4.4.0, carregado no index.html). Uma série por gráfico, cor da marca,
// marcas finas, grade discreta e tooltip no passar do mouse.

const COR = '#34425C';
const TINTA = '#212B37';
const MUDA = '#788192';
const GRADE = '#E8EBEF';
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
      backgroundColor: TINTA, padding: 10, cornerRadius: 8, displayColors: false,
      titleFont: { family: 'Montserrat', weight: '700' }, bodyFont: { family: 'Montserrat' },
      callbacks: { label: (c) => `${c.formattedValue}${sufixo}` },
    },
  },
});

const eixo = (sufixo, max) => ({
  beginAtZero: true, max, grid: { color: GRADE }, border: { display: false },
  ticks: { color: MUDA, font: { family: 'Montserrat', size: 11 }, callback: (v) => `${v}${sufixo}` },
});
const eixoRotulo = { grid: { display: false }, border: { color: GRADE }, ticks: { color: TINTA, font: { family: 'Montserrat', size: 12, weight: '600' } } };

export function barras(canvas, rotulos, valores, { sufixo = '', horizontal = false, max } = {}) {
  return criar(canvas, {
    type: 'bar',
    data: { labels: rotulos, datasets: [{ data: valores, backgroundColor: COR, hoverBackgroundColor: '#7FB85A', borderRadius: 4, borderSkipped: 'start', maxBarThickness: horizontal ? 22 : 44 }] },
    options: {
      ...base(sufixo),
      indexAxis: horizontal ? 'y' : 'x',
      scales: horizontal ? { x: eixo(sufixo, max), y: eixoRotulo } : { y: eixo(sufixo, max), x: eixoRotulo },
    },
  });
}

export function linha(canvas, rotulos, valores, { sufixo = '', max } = {}) {
  return criar(canvas, {
    type: 'line',
    data: { labels: rotulos, datasets: [{ data: valores, borderColor: COR, backgroundColor: COR, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0 }] },
    options: { ...base(sufixo), interaction: { mode: 'index', intersect: false }, scales: { y: eixo(sufixo, max), x: eixoRotulo } },
  });
}

// Imagem do gráfico para o PDF.
export const imagem = (canvas) => (canvas ? canvas.toDataURL('image/png') : '');
