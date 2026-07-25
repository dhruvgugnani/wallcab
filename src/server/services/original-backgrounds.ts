import {
  themeLabels,
  type BackgroundAsset,
  type OriginalTheme,
} from "@/features/wallpaper/types";

const WIDTH = 1320;
const HEIGHT = 2868;

type Study = {
  x: number;
  y: number;
  x2: number;
  y2: number;
  rotation: number;
  step: number;
};

const studies: readonly Study[] = [
  { x: 186, y: 760, x2: 1030, y2: 1710, rotation: -14, step: 116 },
  { x: 330, y: 930, x2: 1140, y2: 1980, rotation: 9, step: 132 },
  { x: 116, y: 1080, x2: 920, y2: 2260, rotation: -7, step: 104 },
  { x: 440, y: 690, x2: 1070, y2: 2140, rotation: 17, step: 144 },
  { x: 250, y: 1260, x2: 1160, y2: 1840, rotation: -20, step: 124 },
  { x: 92, y: 850, x2: 980, y2: 2380, rotation: 12, step: 110 },
] as const;

const studyByTheme: Record<OriginalTheme, number> = {
  amoled: 0,
  minimal: 1,
  abstract: 2,
  gradient: 3,
  monochrome: 4,
  grid: 5,
};

const abstractPalettes = [
  ["#090a0b", "#b9593f", "#446b68", "#d9bd87"],
  ["#08090b", "#6b4f8a", "#bf6d55", "#56807e"],
  ["#080b0d", "#2e7180", "#c78a55", "#784c62"],
  ["#090908", "#9a713b", "#395d55", "#b95045"],
  ["#08080a", "#4d5d91", "#a55352", "#c09c62"],
  ["#070908", "#4e7560", "#b86542", "#6a4e78"],
] as const;

const gradientPalettes = [
  ["#070a0d", "#854c37", "#2f6864"],
  ["#08070c", "#5f467d", "#b35e48"],
  ["#050b0e", "#17647a", "#9a573d"],
  ["#0b0806", "#9b6d32", "#335b51"],
  ["#08090e", "#3f568e", "#9b4b51"],
  ["#070a08", "#3e745c", "#8e4934"],
] as const;

function sharedDefinitions(): string {
  return `
    <filter id="grain" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency=".62" numOctaves="3" seed="11"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 .085"/></feComponentTransfer>
    </filter>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset=".62" stop-color="#000" stop-opacity=".08"/>
      <stop offset="1" stop-color="#000" stop-opacity=".38"/>
    </linearGradient>`;
}

function amoledArtwork(study: Study, variant: number): string {
  const radius = 240 + variant * 34;
  return `
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#000"/>
    <g fill="none" stroke="#f2eee6" stroke-opacity=".1" stroke-width="2" transform="rotate(${study.rotation} 660 1434)">
      <circle cx="${study.x2}" cy="${study.y}" r="${radius}"/>
      <circle cx="${study.x2}" cy="${study.y}" r="${radius + study.step}"/>
      <circle cx="${study.x2}" cy="${study.y}" r="${radius + study.step * 2}"/>
    </g>
    <path d="M${study.x - 220} ${study.y2} C${study.x + 190} ${study.y2 - 410} ${study.x2 - 260} ${study.y2 + 260} ${WIDTH + 120} ${study.y2 - 180}" fill="none" stroke="#9eb79c" stroke-opacity=".16" stroke-width="3"/>
    <circle cx="${study.x}" cy="${study.y2}" r="7" fill="#d8e5cc" fill-opacity=".42"/>`;
}

function minimalArtwork(study: Study, variant: number): string {
  const warm = variant % 2 === 0 ? "#d7d0c2" : "#b8b5ad";
  const panelX = variant % 2 === 0 ? 790 : 110;
  return `
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#11110f"/>
    <rect x="${panelX}" y="${680 + variant * 42}" width="420" height="${1120 + variant * 55}" fill="${warm}" fill-opacity=".2"/>
    <line x1="${study.x}" y1="620" x2="${study.x}" y2="2500" stroke="#f3eee4" stroke-opacity=".28" stroke-width="2"/>
    <line x1="${study.x + 24}" y1="${study.y2}" x2="${WIDTH - 110}" y2="${study.y2}" stroke="#f3eee4" stroke-opacity=".14" stroke-width="2"/>
    <circle cx="${study.x}" cy="${study.y2}" r="${34 + variant * 4}" fill="none" stroke="#f3eee4" stroke-opacity=".38" stroke-width="2"/>`;
}

function abstractArtwork(study: Study, variant: number): string {
  const [base, first, second, accent] = abstractPalettes[variant]!;
  return `
    <defs>
      <radialGradient id="a" cx="35%" cy="35%" r="70%">
        <stop stop-color="${first}" stop-opacity=".95"/>
        <stop offset="1" stop-color="${first}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="b" cx="60%" cy="45%" r="72%">
        <stop stop-color="${second}" stop-opacity=".88"/>
        <stop offset="1" stop-color="${second}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${base}"/>
    <ellipse cx="${study.x2}" cy="${study.y}" rx="${620 - variant * 18}" ry="${790 + variant * 34}" fill="url(#a)" transform="rotate(${study.rotation} ${study.x2} ${study.y})"/>
    <ellipse cx="${study.x}" cy="${study.y2}" rx="${560 + variant * 26}" ry="${830 - variant * 22}" fill="url(#b)" transform="rotate(${-study.rotation} ${study.x} ${study.y2})"/>
    <path d="M-130 ${study.y2 + 180} C260 ${study.y2 - 470} 710 ${study.y2 + 390} ${WIDTH + 170} ${study.y2 - 260}" fill="none" stroke="${accent}" stroke-opacity=".46" stroke-width="${14 + variant * 3}"/>`;
}

function gradientArtwork(study: Study, variant: number): string {
  const [base, first, second] = gradientPalettes[variant]!;
  return `
    <defs>
      <radialGradient id="glow-one" cx="50%" cy="50%" r="50%">
        <stop stop-color="${first}" stop-opacity=".96"/>
        <stop offset="1" stop-color="${first}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="glow-two" cx="50%" cy="50%" r="50%">
        <stop stop-color="${second}" stop-opacity=".9"/>
        <stop offset="1" stop-color="${second}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${base}"/>
    <circle cx="${study.x2}" cy="${study.y + 90}" r="${690 + variant * 25}" fill="url(#glow-one)"/>
    <circle cx="${study.x - 80}" cy="${study.y2}" r="${760 - variant * 22}" fill="url(#glow-two)"/>
    <path d="M-120 ${study.y2 + 300} Q660 ${study.y2 - 430} 1440 ${study.y2 + 120}" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="3"/>`;
}

function monochromeArtwork(study: Study, variant: number): string {
  const reverse = variant % 2 === 1;
  const base = reverse ? "#e7e4dc" : "#050505";
  const ink = reverse ? "#050505" : "#f0ede5";
  return `
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${base}"/>
    <g transform="rotate(${study.rotation} 660 1434)">
      <rect x="${study.x - 520}" y="${study.y}" width="1160" height="${190 + variant * 22}" fill="${ink}" fill-opacity="${reverse ? ".9" : ".74"}"/>
      <circle cx="${study.x2}" cy="${study.y2}" r="${310 + variant * 26}" fill="none" stroke="${ink}" stroke-opacity=".74" stroke-width="${72 + variant * 5}"/>
      <line x1="-80" y1="${study.y2 + 470}" x2="1400" y2="${study.y2 + 470}" stroke="${ink}" stroke-opacity=".4" stroke-width="4"/>
    </g>`;
}

function gridArtwork(study: Study, variant: number): string {
  const step = study.step;
  const offset = variant * 17;
  return `
    <defs>
      <pattern id="small-grid" width="${step}" height="${step}" patternUnits="userSpaceOnUse" patternTransform="translate(${offset} ${offset}) rotate(${variant % 2 === 0 ? 0 : 6})">
        <path d="M ${step} 0 L 0 0 0 ${step}" fill="none" stroke="#e8e3d8" stroke-opacity=".12" stroke-width="2"/>
      </pattern>
      <pattern id="large-grid" width="${step * 4}" height="${step * 4}" patternUnits="userSpaceOnUse">
        <rect width="${step * 4}" height="${step * 4}" fill="url(#small-grid)"/>
        <path d="M ${step * 4} 0 L 0 0 0 ${step * 4}" fill="none" stroke="#e8e3d8" stroke-opacity=".24" stroke-width="3"/>
      </pattern>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#090a09"/>
    <rect y="520" width="${WIDTH}" height="${HEIGHT - 520}" fill="url(#large-grid)"/>
    <rect x="${study.x}" y="${study.y}" width="${step * 3}" height="${step * 5}" fill="#a6b39a" fill-opacity=".16" stroke="#dce6d2" stroke-opacity=".4" stroke-width="3"/>
    <circle cx="${study.x2}" cy="${study.y2}" r="${step * 2}" fill="#090a09" stroke="#e8e3d8" stroke-opacity=".42" stroke-width="3"/>`;
}

function artworkFor(
  theme: OriginalTheme,
  study: Study,
  variant: number,
): string {
  switch (theme) {
    case "amoled":
      return amoledArtwork(study, variant);
    case "minimal":
      return minimalArtwork(study, variant);
    case "abstract":
      return abstractArtwork(study, variant);
    case "gradient":
      return gradientArtwork(study, variant);
    case "monochrome":
      return monochromeArtwork(study, variant);
    case "grid":
      return gridArtwork(study, variant);
  }
}

export function createOriginalBackground(
  theme: OriginalTheme,
): BackgroundAsset {
  const variant = studyByTheme[theme];
  const study = studies[variant]!;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <defs>${sharedDefinitions()}</defs>
      ${artworkFor(theme, study, variant)}
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#floor)"/>
      <rect width="${WIDTH}" height="${HEIGHT}" filter="url(#grain)" opacity=".72"/>
    </svg>`;

  return {
    bytes: new TextEncoder().encode(svg),
    contentType: "image/svg+xml",
    attribution: {
      label: `WallCab ${themeLabels[theme]} Study ${String(variant + 1).padStart(2, "0")}`,
      url: "https://wallcab.dhruvdev.me/sources",
      license: "CC0 1.0",
      creator: "WallCab",
      source: "WallCab Original",
    },
  };
}
