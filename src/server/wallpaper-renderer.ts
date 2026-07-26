import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { toUtcDateKey } from "@/features/wallpaper/daily";
import {
  categoryLabels,
  deviceDimensions,
  type DailyLesson,
  type ResolvedWallpaperRequest,
  type WallpaperOutput,
} from "@/features/wallpaper/types";
import { sha256Hex } from "@/server/cache/signing";
import {
  getPreparedManifest,
  resolveBackground,
  resolveDailyLesson,
  type DailyManifest,
} from "@/server/daily-manifest";
import { resolveCustomBackground } from "@/server/custom-backgrounds";

export const RENDERER_VERSION = "v7";
export const MAX_WALLPAPER_BYTES = Math.floor(2.2 * 1024 * 1024);

function getRendererFontFiles(): string[] {
  const fontDirectory = join(process.cwd(), "src", "server", "fonts");
  return [
    join(fontDirectory, "manrope-variable.ttf"),
    join(fontDirectory, "fraunces-variable.ttf"),
    join(fontDirectory, "fraunces-variable-italic.ttf"),
  ];
}

export function wallpaperCacheKey(
  request: ResolvedWallpaperRequest,
  dateKey: string,
): string {
  if (request.customBackgroundId) {
    return `wallpaper/${RENDERER_VERSION}/${dateKey}/custom/${request.customBackgroundId}/${request.category}/${request.theme}/${request.size}.png`;
  }
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
  const words = value
    .trim()
    .split(/\s+/)
    .flatMap((word) => {
      if (word.length <= maximumCharacters) {
        return [word];
      }

      const chunks: string[] = [];
      for (
        let index = 0;
        index < word.length;
        index += maximumCharacters
      ) {
        chunks.push(word.slice(index, index + maximumCharacters));
      }
      return chunks;
    });
  const lines: string[] = [];
  let current = "";
  let consumedWords = 0;

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maximumCharacters) {
      current = candidate;
      consumedWords += 1;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    if (lines.length === maximumLines) {
      break;
    }
    current = word;
    consumedWords += 1;
  }

  if (lines.length < maximumLines && current) {
    lines.push(current);
  }

  if (consumedWords < words.length && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const last = (lines[lastIndex] ?? "").replace(/[.,;:!?-]*$/, "");
    lines[lastIndex] = `${last.slice(0, maximumCharacters - 1)}…`;
  }

  return lines;
}

export function fitWallpaperText(lesson: DailyLesson) {
  const termLines = wrapText(lesson.term, 18, 2);
  const longestTermLine = Math.max(...termLines.map((line) => line.length));
  const pronunciation =
    lesson.category === "vocabulary" &&
    lesson.pronunciation &&
    lesson.pronunciation.length <= 50 &&
    !/[\u0000-\u001f\u007f]/.test(lesson.pronunciation)
      ? lesson.pronunciation.trim()
      : undefined;

  return {
    termLines,
    termFontSize:
      longestTermLine <= 12 ? 142 : longestTermLine <= 16 ? 112 : 92,
    pronunciation,
    definitionLines: wrapText(lesson.definition, 36, 4),
    quoteLines: wrapText(lesson.quote.text, 34, 3),
    factLines: wrapText(lesson.fact, 38, 4),
  };
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

export function createWallpaperOverlay(
  output: Omit<WallpaperOutput, "bytes" | "etag" | "byteLength" | "key">,
  width: number,
  height: number,
): Buffer {
  const scale = width / 1206;
  const left = Math.round(112 * scale);
  const right = width - left;
  const layout = fitWallpaperText(output.lesson);
  const termSize = Math.round(layout.termFontSize * scale);
  const termLineHeight = Math.round(layout.termFontSize * 0.9 * scale);
  const termStartY = Math.round(
    (layout.termLines.length > 1 ? 990 : 1080) * scale,
  );
  const brandLabelY = termStartY - Math.round(190 * scale);
  const brandMarkY = brandLabelY - Math.round(38 * scale);
  const termBottomY =
    termStartY + (layout.termLines.length - 1) * termLineHeight;
  const pronunciationY = termBottomY + Math.round(56 * scale);
  const definitionStartY =
    termBottomY +
    Math.round(layout.pronunciation ? 130 * scale : 90 * scale);
  const sourceCredit =
    wrapText(
      `${output.background.label} · ${output.background.license}`,
      72,
      1,
    )[0] ?? "Source unavailable";
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
        <clipPath id="content-bounds">
          <rect x="${left}" y="${Math.round(620 * scale)}" width="${right - left}" height="${height - Math.round(700 * scale)}"/>
        </clipPath>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shade)"/>
      <g fill="#f4f0e8" filter="url(#shadow)" clip-path="url(#content-bounds)">
        <g transform="translate(${left} ${brandMarkY})">
          <rect width="${Math.round(48 * scale)}" height="${Math.round(61 * scale)}" rx="${Math.round(3 * scale)}" fill="none" stroke="#f4f0e8" stroke-width="${Math.max(2, Math.round(3 * scale))}"/>
          <path d="M${Math.round(14 * scale)} ${Math.round(17 * scale)}H${Math.round(34 * scale)}M${Math.round(14 * scale)} ${Math.round(31 * scale)}H${Math.round(34 * scale)}M${Math.round(14 * scale)} ${Math.round(45 * scale)}H${Math.round(27 * scale)}" stroke="#f4f0e8" stroke-width="${Math.max(2, Math.round(3 * scale))}"/>
        </g>
        <text x="${left + Math.round(68 * scale)}" y="${brandLabelY}" font-family="Manrope" font-size="${Math.round(27 * scale)}" font-weight="700" letter-spacing="${Math.round(5 * scale)}">WALLCAB / ${escapeXml(category)}</text>
        <text font-family="Fraunces" font-size="${termSize}" font-weight="600" letter-spacing="${Math.round(-3 * scale)}">
          ${tspans(layout.termLines, left, termStartY, termLineHeight)}
        </text>
        ${
          layout.pronunciation
            ? `<text x="${left}" y="${pronunciationY}" font-family="Fraunces" font-size="${Math.round(40 * scale)}" font-style="italic" fill="#d8d1c5">${escapeXml(layout.pronunciation)}</text>`
            : ""
        }
        <text font-family="Manrope" font-size="${Math.round(39 * scale)}" font-weight="500" fill="#f4f0e8" fill-opacity=".92">
          ${tspans(layout.definitionLines, left, definitionStartY, Math.round(50 * scale))}
        </text>
        <line x1="${left}" x2="${right}" y1="${Math.round(1450 * scale)}" y2="${Math.round(1450 * scale)}" stroke="#f4f0e8" stroke-opacity=".36"/>
        <text x="${left}" y="${Math.round(1535 * scale)}" font-family="Manrope" font-size="${Math.round(21 * scale)}" font-weight="700" letter-spacing="${Math.round(5 * scale)}" fill="#d8d1c5">A THOUGHT FOR TODAY</text>
        <text font-family="Fraunces" font-size="${Math.round(49 * scale)}" font-style="italic">
          ${tspans(layout.quoteLines, left, Math.round(1620 * scale), Math.round(65 * scale))}
        </text>
        <text x="${left}" y="${Math.round(1855 * scale)}" font-family="Manrope" font-size="${Math.round(25 * scale)}" fill="#d8d1c5">— ${escapeXml(output.lesson.quote.author)}</text>
        <text x="${left}" y="${Math.round(2010 * scale)}" font-family="Manrope" font-size="${Math.round(21 * scale)}" font-weight="700" letter-spacing="${Math.round(5 * scale)}" fill="#d8d1c5">ONE MORE THING</text>
        <text font-family="Manrope" font-size="${Math.round(34 * scale)}" fill="#f4f0e8" fill-opacity=".9">
          ${tspans(layout.factLines, left, Math.round(2085 * scale), Math.round(49 * scale))}
        </text>
        <line x1="${left}" x2="${right}" y1="${height - Math.round(180 * scale)}" y2="${height - Math.round(180 * scale)}" stroke="#f4f0e8" stroke-opacity=".24"/>
        <text x="${left}" y="${height - Math.round(115 * scale)}" font-family="Manrope" font-size="${Math.round(19 * scale)}" letter-spacing="${Math.round(2 * scale)}" fill="#d8d1c5">${escapeXml(output.date)} UTC · ${escapeXml(sourceCredit)}</text>
      </g>
    </svg>
  `);
}

export function rasterizeSvgWithBundledFonts(svg: Buffer | string): Buffer {
  const renderer = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: {
      defaultFontFamily: "Manrope",
      fontFiles: getRendererFontFiles(),
      loadSystemFonts: false,
      sansSerifFamily: "Manrope",
      serifFamily: "Fraunces",
    },
  });

  return Buffer.from(renderer.render().asPng());
}

export async function renderWallpaper(
  request: ResolvedWallpaperRequest,
  date = new Date(),
  context?: {
    manifest: DailyManifest | null;
    lesson?: DailyLesson;
  },
): Promise<WallpaperOutput> {
  const dateKey = toUtcDateKey(date);
  const manifest = context
    ? context.manifest
    : await getPreparedManifest(dateKey);
  const [lesson, background] = await Promise.all([
    context?.lesson
      ? Promise.resolve(context.lesson)
      : resolveDailyLesson(request.category, date, manifest),
    request.customBackgroundId
      ? resolveCustomBackground(request.customBackgroundId).then(
          (custom) =>
            custom ?? resolveBackground(request.theme, date, manifest),
        )
      : resolveBackground(request.theme, date, manifest),
  ]);
  const dimensions = deviceDimensions[request.size];
  const details = {
    ...request,
    date: dateKey,
    lesson,
    background: background.attribution,
  };
  const overlaySvg = createWallpaperOverlay(
    details,
    dimensions.width,
    dimensions.height,
  );
  const overlay = rasterizeSvgWithBundledFonts(overlaySvg);
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
