function parseHex(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    return [
      parseInt(cleaned[0] + cleaned[0], 16) || 0,
      parseInt(cleaned[1] + cleaned[1], 16) || 0,
      parseInt(cleaned[2] + cleaned[2], 16) || 0,
    ];
  }
  if (cleaned.length === 6) {
    return [
      parseInt(cleaned.slice(0, 2), 16) || 0,
      parseInt(cleaned.slice(2, 4), 16) || 0,
      parseInt(cleaned.slice(4, 6), 16) || 0,
    ];
  }
  return [250, 247, 242];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const srgb = v / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isDarkColor(hex: string): boolean {
  return relativeLuminance(hex) < 0.25;
}

export function pickReadableText(bgHex: string): string {
  const darkInk = '#1A1612';
  const lightInk = '#FAF7F2';
  return contrastRatio(bgHex, darkInk) >= contrastRatio(bgHex, lightInk) ? darkInk : lightInk;
}

export function pickMutedText(bgHex: string): string {
  return isDarkColor(bgHex) ? '#C2BCB2' : '#5E554B';
}

export function pickSurfaceColor(bgHex: string): string {
  return isDarkColor(bgHex) ? '#1D2026' : '#FFFFFF';
}

export function pickBorderColor(bgHex: string): string {
  return isDarkColor(bgHex) ? 'rgba(255, 255, 255, 0.14)' : 'rgba(26, 22, 18, 0.12)';
}

export function evaluateThemeContrast(params: {
  backgroundColor: string;
  primaryColor: string;
  accentColor: string;
}) {
  const bodyText = pickReadableText(params.backgroundColor);
  const primaryBtnText = pickReadableText(params.primaryColor);
  const bgToBodyRatio = contrastRatio(params.backgroundColor, bodyText);
  const bgToPrimaryRatio = contrastRatio(params.backgroundColor, params.primaryColor);
  const btnRatio = contrastRatio(params.primaryColor, primaryBtnText);

  return {
    bodyText,
    primaryBtnText,
    bgToBodyRatio: Number(bgToBodyRatio.toFixed(2)),
    bgToPrimaryRatio: Number(bgToPrimaryRatio.toFixed(2)),
    btnRatio: Number(btnRatio.toFixed(2)),
    passesAA: bgToBodyRatio >= 4.5 && btnRatio >= 4.5,
    primaryVisibleOnBg: bgToPrimaryRatio >= 3.0,
  };
}
