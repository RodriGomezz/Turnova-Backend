/**
 * Utilidades de color compartidas entre componentes públicos.
 * Algoritmo basado en luminancia relativa WCAG 2.1.
 */

export function expandirHex(hex: string): string {
  if (!hex) return '#000000';
  const h = hex.replace('#', '');
  if (h.length === 3)
    return (
      '#' +
      h
        .split('')
        .map((c) => c + c)
        .join('')
    );
  if (h.length === 6) return '#' + h;
  return '#000000';
}

function getLuminancia(hex: string): number {
  const expanded = expandirHex(hex);
  const r = parseInt(expanded.slice(1, 3), 16) / 255;
  const g = parseInt(expanded.slice(3, 5), 16) / 255;
  const b = parseInt(expanded.slice(5, 7), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function esOscuro(hex: string): boolean {
  if (!hex) return true;
  return getLuminancia(hex) < 0.179;
}

export function getRatioContraste(hex1: string, hex2: string): number {
  const l1 = getLuminancia(hex1);
  const l2 = getLuminancia(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 10) / 10;
}

export function colorTextoSobre(hex: string): '#F5F2EC' | '#0A0A0A' {
  return esOscuro(hex) ? '#F5F2EC' : '#0A0A0A';
}
