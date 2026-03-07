// Convert number to Spanish words for Mexican currency
const UNITS = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const TEENS = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const TENS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const HUNDREDS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function convertGroup(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  
  let result = '';
  const h = Math.floor(n / 100);
  const remainder = n % 100;
  
  if (h > 0) result += HUNDREDS[h] + ' ';
  
  if (remainder >= 10 && remainder <= 19) {
    result += TEENS[remainder - 10];
  } else if (remainder >= 21 && remainder <= 29) {
    result += 'VEINTI' + UNITS[remainder - 20];
  } else {
    const t = Math.floor(remainder / 10);
    const u = remainder % 10;
    if (t > 0) result += TENS[t];
    if (t > 0 && u > 0) result += ' Y ';
    if (u > 0) result += UNITS[u];
  }
  
  return result.trim();
}

export function numberToWords(amount: number): string {
  if (amount === 0) return 'CERO PESOS 00/100 M.N.';
  
  const intPart = Math.floor(amount);
  const cents = Math.round((amount - intPart) * 100);
  
  const millions = Math.floor(intPart / 1000000);
  const thousands = Math.floor((intPart % 1000000) / 1000);
  const ones = intPart % 1000;
  
  let words = '';
  
  if (millions > 0) {
    if (millions === 1) words += 'UN MILLÓN ';
    else words += convertGroup(millions) + ' MILLONES ';
  }
  
  if (thousands > 0) {
    if (thousands === 1) words += 'MIL ';
    else words += convertGroup(thousands) + ' MIL ';
  }
  
  if (ones > 0) words += convertGroup(ones) + ' ';
  
  words += 'PESOS ' + cents.toString().padStart(2, '0') + '/100 M.N.';
  
  return words.trim();
}
