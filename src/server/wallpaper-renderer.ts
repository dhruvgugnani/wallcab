import sharp from "sharp";
import { toUtcDateKey } from "@/features/wallpaper/daily";
import {
  categoryLabels,
  deviceDimensions,
  type WallpaperOutput,
  type WallpaperRequest,
} from "@/features/wallpaper/types";
import { sha256Hex } from "@/server/cache/signing";
import {
  getPreparedManifest,
  resolveBackground,
  resolveDailyLesson,
} from "@/server/daily-manifest";

export const RENDERER_VERSION = "v1";
export const MAX_WALLPAPER_BYTES = Math.floor(2.2 * 1024 * 1024);

export function wallpaperCacheKey(
  request: WallpaperRequest,
  dateKey: string,
): string {
  return `wallpaper/${RENDERER_VERSION}/${dateKey}/${request.category}/${request.theme}/${request.size}.png`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function wrapText(
  value: string,
  maximumCharacters: number,
  maximumLines: number,
): string[] {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maximumCharacters) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = word;

    if (lines.length === maximumLines) {
      break;
    }
  }

  if (lines.length < maximumLines && current) {
    lines.push(current);
  }

  const consumed = lines.join(" ").replace(/…$/, "").split(/\s+/).length;
  if (consumed < words.length && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const last = lines[lastIndex] ?? "";
    lines[lastIndex] = `${last.replace(/[.,;:!?-]*$/, "").slice(0, maximumCharacters - 1)}…`;
  }

  return lines;
}

function tspans(
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
): string {
  return lines
    .map(
      (line, index) =>
        `<tspan x="${x}" y="${y + index * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");
}

function createOverlay(
  output: Omit<WallpaperOutput, "bytes" | "etag" | "byteLength" | "key">,
  width: number,
  height: number,
): Buffer {
  const scale = width / 1206;
  const left = Math.round(112 * scale);
  const right = width - left;
  const termSize = Math.round(
    (output.lesson.term.length > 22
      ? 92
      : output.lesson.term.length > 14
        ? 112
        : 142) * scale,
  );
  const definitionLines = wrapText(output.lesson.definition, 41, 4);
  const quoteLines = wrapText(output.lesson.quote.text, 43, 3);
  const factLines = wrapText(output.lesson.fact, 45, 4);
  const sourceCredit = `${output.background.label} · ${output.background.license}`;
  const category = categoryLabels[output.category].toUpperCase();

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000" stop-opacity=".08"/>
          <stop offset=".28" stop-color="#000" stop-opacity=".13"/>
          <stop offset=".52" stop-color="#000" stop-opacity=".46"/>
          <stop offset=".78" stop-color="#000" stop-opacity=".77"/>
          <stop offset="1" stop-color="#000" stop-opacity=".92"/>
        </linearGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="${Math.round(4 * scale)}" stdDeviation="${Math.round(9 * scale)}" flood-color="#000" flood-opacity=".45"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shade)"/>
      <g fill="#f4f0e8" filter="url(#shadow)">
        <g transform="translate(${left} ${Math.round(650 * scale)})">
          <rect width="${Math.round(48 * scale)}" height="${Math.round(61 * scale)}" rx="${Math.round(3 * scale)}" fill="none" stroke="#f4f0e8" stroke-width="${Math.max(2, Math.round(3 * scale))}"/>
          <path d="M${Math.round(14 * scale)} ${Math.round(17 * scale)}H${Math.round(34 * scale)}M${Math.round(14 * scale)} ${Math.round(31 * scale)}H${Math.round(34 * scale)}M${Math.round(14 * scale)} ${Math.round(45 * scale)}H${Math.round(27 * scale)}" stroke="#f4f0e8" stroke-width="${Math.max(2, Math.round(3 * scale))}"/>
        </g>
        <text x="${left + Math.round(68 * scale)}" y="${Math.round(688 * scale)}" font-family="Arial, sans-serif" font-size="${Math.round(27 * scale)}" font-weight="700" letter-spacing="${Math.round(5 * scale)}">WALLCAB / ${escapeXml(category)}</text>
        <text x="${left}" y="${Math.round(1080 * scale)}" font-family="Georgia, 'Times New Roman', serif" font-size="${termSize}" font-weight="600" letter-spacing="${Math.round(-3 * scale)}">${escapeXml(output.lesson.term)}</text>
        <text font-family="Arial, sans-serif" font-size="${Math.round(39 * scale)}" font-weight="500" fill="#f4f0e8" fill-opacity=".92">
          ${tspans(definitionLines, left, Math.round(1170 * scale), Math.round(54 * scale))}
        </text>
        <line x1="${left}" x2="${right}" y1="${Math.round(1450 * scale)}" y2="${Math.round(1450 * scale)}" stroke="#f4f0e8" stroke-opacity=".36"/>
        <text x="${left}" y="${Math.round(1535 * scale)}" font-family="Arial, sans-serif" font-size="${Math.round(21 * scale)}" font-weight="700" letter-spacing="${Math.round(5 * scale)}" fill="#d8d1c5">A THOUGHT FOR TODAY</text>
        <text font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(49 * scale)}" font-style="italic">
          ${tspans(quoteLines, left, Math.round(1620 * scale), Math.round(65 * scale))}
        </text>
        <text x="${left}" y="${Math.round(1855 * scale)}" font-family="Arial, sans-serif" font-size="${Math.round(25 * scale)}" fill="#d8d1c5">— ${escapeXml(output.lesson.quote.author)}</text>
        <text x="${left}" y="${Math.round(2010 * scale)}" font-family="Arial, sans-serif" font-size="${Math.round(21 * scale)}" font-weight="700" letter-spacing="${Math.round(5 * scale)}" fill="#d8d1c5">ONE MORE THING</text>
        <text font-family="Arial, sans-serif" font-size="${Math.round(34 * scale)}" fill="#f4f0e8" fill-opacity=".9">
          ${tspans(factLines, left, Math.round(2085 * scale), Math.round(49 * scale))}
        </text>
        <line x1="${left}" x2="${right}" y1="${height - Math.round(180 * scale)}" y2="${height - Math.round(180 * scale)}" stroke="#f4f0e8" stroke-opacity=".24"/>
        <text x="${left}" y="${height - Math.round(115 * scale)}" font-family="Arial, sans-serif" font-size="${Math.round(19 * scale)}" letter-spacing="${Math.round(2 * scale)}" fill="#d8d1c5">${escapeXml(output.date)} UTC · ${escapeXml(sourceCredit)}</text>
      </g>
    </svg>
  `);
}

export async function renderWallpaper(
  request: WallpaperRequest,
  date = new Date(),
): Promise<WallpaperOutput> {
  const dateKey = toUtcDateKey(date);
  const manifest = await getPreparedManifest(dateKey);
  const [lesson, background] = await Promise.all([
    resolveDailyLesson(request.category, date, manifest),
    resolveBackground(request.theme, date, manifest),
  ]);
  const dimensions = deviceDimensions[request.size];
  const details = {
    ...request,
    date: dateKey,
    lesson,
    background: background.attribution,
  };
  const overlay = createOverlay(details, dimensions.width, dimensions.height);
  const pipeline = sharp(background.bytes)
    .rotate()
    .resize(dimensions.width, dimensions.height, {
      fit: "cover",
      position: "attention",
    })
    .composite([{ input: overlay, blend: "over" }]);

  let bytes: Buffer | null = null;
  for (const colors of [192, 160, 128, 96, 64, 48, 32]) {
    bytes = await pipeline
      .clone()
      .png({
        palette: true,
        colors,
        compressionLevel: 9,
        effort: 10,
        quality: 84,
      })
      .toBuffer();
    if (bytes.byteLength <= MAX_WALLPAPER_BYTES) {
      break;
    }
  }

  if (!bytes || bytes.byteLength > MAX_WALLPAPER_BYTES) {
    throw new Error("Wallpaper could not be compressed below the cache limit");
  }

  const etag = sha256Hex(bytes);
  return {
    ...details,
    bytes,
    etag,
    byteLength: bytes.byteLength,
    key: wallpaperCacheKey(request, dateKey),
  };
}
