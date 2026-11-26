// Selo da licença da conta no topo (como no app da WasFit) — testado em tests/conta-regras.test.js.
// Até 3 dias (ou vencida): vermelho; até 15 dias: laranja; mais que isso: discreto, com a data.
export function seloLicenca(dias, vence) {
  if (dias == null || !vence) return null;
  const dm = `${vence.slice(8, 10)}/${vence.slice(5, 7)}`;
  if (dias < 0) return { texto: 'Licença vencida', cor: 'vermelho', dica: `Venceu em ${dm}. Fale com a WasFit para renovar.` };
  if (dias === 0) return { texto: 'Vence hoje', cor: 'vermelho', dica: `A licença vence hoje (${dm}).` };
  if (dias <= 3) return { texto: `Vence em ${dias} dia${dias > 1 ? 's' : ''}`, cor: 'vermelho', dica: `A licença vence em ${dm}.` };
  if (dias <= 15) return { texto: `Vence em ${dias} dias`, cor: 'laranja', dica: `A licença vence em ${dm}.` };
  return { texto: `Licença até ${dm}`, cor: 'neutro', dica: `A licença vence em ${dm} (faltam ${dias} dias).` };
}
