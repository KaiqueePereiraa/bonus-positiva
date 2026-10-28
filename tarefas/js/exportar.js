// Exportação de relatórios: CSV, Excel (ExcelJS) e PDF (impressão do navegador).

function baixar(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// CSV com ";" e BOM — abre direto no Excel em português.
export function csv(nome, linhas) {
  const campo = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const texto = '﻿' + linhas.map((l) => l.map(campo).join(';')).join('\r\n');
  baixar(new Blob([texto], { type: 'text/csv;charset=utf-8' }), nome);
}

// abas: [{ nome, linhas: [[cabeçalho...], [valores...]] }]
export async function excel(nome, abas) {
  const wb = new window.ExcelJS.Workbook();
  wb.creator = 'Central de Tarefas Positiva';
  for (const aba of abas) {
    const ws = wb.addWorksheet(aba.nome.slice(0, 31));
    aba.linhas.forEach((l) => ws.addRow(l));
    const cab = ws.getRow(1);
    cab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF212B37' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.columns.forEach((c) => {
      let max = 10;
      c.eachCell({ includeEmpty: false }, (cel) => { max = Math.max(max, String(cel.value ?? '').length + 2); });
      c.width = Math.min(max, 60);
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  baixar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nome);
}

// Abre o relatório numa janela própria (A4, marca Positiva) e chama a impressão — "Salvar como PDF".
export function pdf(titulo, corpoHtml) {
  const w = window.open('', '_blank');
  if (!w) { alert('Permita pop-ups para gerar o PDF.'); return; }
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,600;0,800;0,900;1,900&display=swap" rel="stylesheet">
  <style>
    @page{size:A4;margin:14mm}
    *{box-sizing:border-box}
    body{font-family:'Montserrat',sans-serif;color:#212B37;font-size:11px;margin:0}
    header{display:flex;align-items:center;gap:12px;border-bottom:4px solid #BEF575;padding-bottom:10px;margin-bottom:16px}
    header img{height:38px}
    header h1{font-size:18px;font-weight:900;font-style:italic;text-transform:uppercase;margin:0}
    header p{margin:2px 0 0;color:#788192}
    h2{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;margin:18px 0 8px;break-after:avoid}
    .numeros{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
    .numero{border:1px solid #E3E7EC;border-top:3px solid #34425C;border-radius:8px;padding:8px}
    .numero small{display:block;font-size:9px;text-transform:uppercase;color:#788192;font-weight:800}
    .numero b{font-size:18px}
    table{width:100%;border-collapse:collapse;margin-bottom:8px}
    th{text-align:left;font-size:9px;text-transform:uppercase;color:#788192;border-bottom:2px solid #E3E7EC;padding:5px 6px}
    td{border-bottom:1px solid #E3E7EC;padding:5px 6px}
    tr{break-inside:avoid}
    img.grafico{width:100%;max-height:260px;object-fit:contain}
    .insight{border-left:4px solid #7FB85A;padding:6px 10px;margin-bottom:6px;background:#F7F9FB}
    .insight small{display:block;color:#788192}
    footer{margin-top:20px;color:#788192;font-size:9px}
  </style></head><body>${corpoHtml}
  <footer>Gerado pela Central de Tarefas Positiva em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.</footer>
  <script>document.fonts.ready.then(()=>setTimeout(()=>print(),300))<\/script></body></html>`);
  w.document.close();
}
