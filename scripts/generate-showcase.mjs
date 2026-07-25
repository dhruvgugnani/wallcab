import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const outputDirectory = join(process.cwd(), "public", "showcase");
const faviconPath = join(process.cwd(), "src", "app", "favicon.ico");

const studies = [
  {
    slug: "vocabulary-nature",
    term: "LIMINAL",
    category: "VOCABULARY",
    definition: "occupying a position at, or on both sides of, a threshold",
    colors: ["#81906e", "#26332a", "#090d0a"],
  },
  {
    slug: "coding-amoled",
    term: "IDEMPOTENT",
    category: "CODING",
    definition: "an operation whose repeated application has the same result",
    colors: ["#000000", "#090909", "#000000"],
  },
  {
    slug: "finance-minimal",
    term: "LIQUIDITY",
    category: "FINANCE",
    definition: "the ease with which an asset can become spendable cash",
    colors: ["#b9b4a8", "#49483f", "#11110f"],
  },
  {
    slug: "stoicism-mountains",
    term: "DICHOTOMY",
    category: "STOICISM",
    definition: "distinguish what is within your control from what is not",
    colors: ["#9ba1a1", "#394148", "#111317"],
  },
  {
    slug: "science-space",
    term: "ENTROPY",
    category: "SCIENCE",
    definition: "a measure of the arrangements a system may contain",
    colors: ["#222846", "#151528", "#07070d"],
  },
  {
    slug: "psychology-abstract",
    term: "PRIMING",
    category: "PSYCHOLOGY",
    definition: "when earlier exposure quietly shapes a later response",
    colors: ["#8b513c", "#3f5753", "#121411"],
  },
  {
    slug: "history-grid",
    term: "PALIMPSEST",
    category: "HISTORY",
    definition: "a surface whose earlier marks remain beneath later writing",
    colors: ["#909d83", "#222823", "#090a09"],
  },
  {
    slug: "productivity-gradient",
    term: "TIMEBOXING",
    category: "PRODUCTIVITY",
    definition: "giving a task a fixed window instead of an open-ended day",
    colors: ["#a75a41", "#326662", "#08090b"],
  },
  {
    slug: "stoicism-monochrome",
    term: "EQUANIMITY",
    category: "STOICISM",
    definition: "steadiness of mind when circumstances refuse to cooperate",
    colors: ["#e5e2da", "#3b3b38", "#080808"],
  },
];

function escape(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}

function artwork(study, index) {
  const [top, middle, bottom] = study.colors;
  const geometry =
    index === 1
      ? `<circle cx="360" cy="440" r="220" fill="none" stroke="#a8b89a" stroke-opacity=".2"/>
         <circle cx="360" cy="440" r="150" fill="none" stroke="#a8b89a" stroke-opacity=".15"/>`
      : index === 5
        ? `<path d="M-100 500C140 160 390 820 820 300V0H-100Z" fill="#d6cbb7" opacity=".13"/>
           <circle cx="560" cy="360" r="270" fill="#b96c4f" opacity=".12"/>`
        : index === 6
          ? `<rect y="180" width="720" height="720" fill="url(#study-grid)"/>
             <rect x="420" y="310" width="180" height="300" fill="#a6b39a" opacity=".18" stroke="#dce6d2" stroke-opacity=".5"/>`
          : index === 7
            ? `<circle cx="585" cy="320" r="390" fill="#c76c4e" opacity=".24"/>
               <circle cx="80" cy="760" r="460" fill="#3c8b84" opacity=".25"/>`
            : index === 8
              ? `<g transform="rotate(-12 360 520)">
                   <rect x="-120" y="290" width="720" height="130" fill="#f1eee6" opacity=".74"/>
                   <circle cx="560" cy="680" r="190" fill="none" stroke="#f1eee6" stroke-width="54" opacity=".54"/>
                 </g>`
              : `<path d="M0 700 260 370 410 560 590 250 720 430V0H0Z" fill="#fff" opacity=".09"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="${top}"/>
        <stop offset=".5" stop-color="${middle}"/>
        <stop offset="1" stop-color="${bottom}"/>
      </linearGradient>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset=".25" stop-color="#000" stop-opacity=".03"/>
        <stop offset=".7" stop-color="#000" stop-opacity=".56"/>
        <stop offset="1" stop-color="#000" stop-opacity=".9"/>
      </linearGradient>
      <pattern id="study-grid" width="42" height="42" patternUnits="userSpaceOnUse">
        <path d="M42 0H0V42" fill="none" stroke="#eee9df" stroke-opacity=".2"/>
      </pattern>
    </defs>
    <rect width="720" height="1280" fill="url(#bg)"/>
    ${geometry}
    <rect width="720" height="1280" fill="url(#shade)"/>
    <text x="360" y="94" text-anchor="middle" fill="#fff" font-family="Arial" font-size="27" font-weight="700">09:41</text>
    <rect x="279" y="40" width="162" height="36" rx="18" fill="#000"/>
    <text x="58" y="760" fill="#c8d5bc" font-family="Arial" font-size="15" font-weight="700" letter-spacing="4">${study.category} / DAILY 01</text>
    <text x="58" y="830" fill="#f4f0e7" font-family="Georgia" font-size="${study.term.length > 9 ? 55 : 68}" letter-spacing="2">${escape(study.term)}</text>
    <line x1="58" y1="865" x2="662" y2="865" stroke="#fff" stroke-opacity=".28"/>
    <foreignObject x="58" y="900" width="580" height="150">
      <div xmlns="http://www.w3.org/1999/xhtml" style="color:#e5e0d7;font:29px/1.35 Georgia">${escape(study.definition)}</div>
    </foreignObject>
    <text x="58" y="1180" fill="#fff" fill-opacity=".7" font-family="Arial" font-size="13" letter-spacing="2">WALLCAB — SOURCE STUDY</text>
    <text x="662" y="1180" text-anchor="end" fill="#fff" fill-opacity=".55" font-family="Arial" font-size="11">CC0 / REVIEWED</text>
  </svg>`;
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  studies.map((study, index) =>
    sharp(Buffer.from(artwork(study, index)))
      .webp({ quality: 82, effort: 6 })
      .toFile(join(outputDirectory, `${study.slug}.webp`)),
  ),
);

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
  <rect width="64" height="64" rx="32" fill="#f0ede4"/>
  <circle cx="32" cy="32" r="25" fill="none" stroke="#0a0a08" stroke-width="2"/>
  <path d="M15 32h34M32 15v34" stroke="#0a0a08" stroke-width="2"/>
  <circle cx="32" cy="32" r="5" fill="#a8b89a" stroke="#0a0a08" stroke-width="2"/>
</svg>`;
await sharp(Buffer.from(favicon)).png().toFile(faviconPath);

console.log(`Generated ${studies.length} WallCab showcase images.`);
