import sharp from "sharp";
import { z } from "zod";
import { hashString, toUtcDateKey } from "@/features/wallpaper/daily";
import type {
  BackgroundAsset,
  VisualTheme,
} from "@/features/wallpaper/types";

const themeQueries: Record<VisualTheme, string> = {
  nature: "misty wild meadow morning",
  mountains: "dramatic mountain dawn landscape",
  ocean: "deep ocean waves aerial",
  forest: "dark old growth forest light",
  space: "nebula deep space stars",
  amoled: "black night minimal light",
  minimal: "minimal architecture shadow monochrome",
  abstract: "abstract organic texture monochrome",
};

const paletteByTheme: Record<
  VisualTheme,
  readonly [string, string, string]
> = {
  nature: ["#0b1610", "#284532", "#a4aa79"],
  mountains: ["#080b0e", "#303941", "#9b8d79"],
  ocean: ["#020a0e", "#083047", "#40798b"],
  forest: ["#050b08", "#102a1d", "#56705d"],
  space: ["#020205", "#13182a", "#554c6b"],
  amoled: ["#000000", "#080808", "#303030"],
  minimal: ["#0a0a09", "#34322f", "#b8ad9b"],
  abstract: ["#080808", "#292323", "#796050"],
};

const openverseSchema = z.object({
  results: z.array(
    z.object({
      url: z.url(),
      foreign_landing_url: z.url().nullable().optional(),
      creator: z.string().nullable().optional(),
      license: z.string(),
      source: z.string().nullable().optional(),
      width: z.number().nullable().optional(),
      height: z.number().nullable().optional(),
    }),
  ),
});

const allowedImageHosts = new Set([
  "upload.wikimedia.org",
  "live.staticflickr.com",
  "images.metmuseum.org",
  "images-assets.nasa.gov",
]);

function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (allowedImageHosts.has(url.hostname) || url.hostname.endsWith(".nasa.gov"))
    );
  } catch {
    return false;
  }
}

function fallbackBackground(theme: VisualTheme): BackgroundAsset {
  const [dark, mid, accent] = paletteByTheme[theme];
  const ring =
    theme === "space"
      ? '<circle cx="78%" cy="22%" r="15%" fill="none" stroke="#ffffff" stroke-opacity=".16" stroke-width="2"/>'
      : "";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1320" height="2868" viewBox="0 0 1320 2868">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${dark}"/>
          <stop offset=".54" stop-color="${mid}"/>
          <stop offset="1" stop-color="${accent}"/>
        </linearGradient>
        <filter id="noise">
          <feTurbulence baseFrequency=".7" numOctaves="3" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer><feFuncA type="table" tableValues="0 .13"/></feComponentTransfer>
        </filter>
      </defs>
      <rect width="1320" height="2868" fill="url(#g)"/>
      <path d="M-120 2130 C260 1760 480 1910 760 1560 C980 1280 1220 1320 1460 930 V2868 H-120Z" fill="#000" fill-opacity=".28"/>
      <path d="M-100 2470 C300 2050 620 2260 940 1880 C1110 1680 1270 1670 1430 1470" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="3"/>
      ${ring}
      <rect width="1320" height="2868" filter="url(#noise)" opacity=".55"/>
    </svg>`;

  return {
    bytes: new TextEncoder().encode(svg),
    contentType: "image/svg+xml",
    attribution: {
      label: `${theme} procedural study`,
      url: "https://wallcab.dhruvdev.me/sources",
      license: "CC0 1.0",
      creator: "WallCab",
      source: "WallCab fallback",
    },
  };
}

export async function getBackgroundAsset(
  theme: VisualTheme,
  date = new Date(),
): Promise<BackgroundAsset> {
  try {
    const query = new URLSearchParams({
      q: themeQueries[theme],
      license: "cc0,pdm",
      mature: "false",
      page_size: "20",
    });
    const response = await fetch(
      `https://api.openverse.org/v1/images/?${query.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "WallCab/1.0 (+https://wallcab.dhruvdev.me)",
        },
        signal: AbortSignal.timeout(3_500),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return fallbackBackground(theme);
    }

    const payload = openverseSchema.parse(await response.json());
    const candidates = payload.results.filter(
      (result) =>
        ["cc0", "pdm"].includes(result.license.toLowerCase()) &&
        isAllowedImageUrl(result.url) &&
        (result.width ?? 0) >= 1200 &&
        (result.height ?? 0) >= 1600,
    );
    const selected =
      candidates[
        hashString(`${toUtcDateKey(date)}:${theme}`) % candidates.length
      ];

    if (!selected) {
      return fallbackBackground(theme);
    }

    const imageResponse = await fetch(selected.url, {
      headers: {
        Accept: "image/avif,image/webp,image/jpeg,image/png",
        "User-Agent": "WallCab/1.0 (+https://wallcab.dhruvdev.me)",
      },
      signal: AbortSignal.timeout(5_500),
      redirect: "follow",
      cache: "no-store",
    });

    if (
      !imageResponse.ok ||
      !isAllowedImageUrl(imageResponse.url) ||
      !/^image\/(jpeg|png|webp|avif)/.test(
        imageResponse.headers.get("content-type") ?? "",
      )
    ) {
      return fallbackBackground(theme);
    }

    const contentLength = Number(
      imageResponse.headers.get("content-length") ?? 0,
    );
    if (contentLength > 8 * 1024 * 1024) {
      return fallbackBackground(theme);
    }

    const sourceBytes = new Uint8Array(await imageResponse.arrayBuffer());
    if (sourceBytes.byteLength > 8 * 1024 * 1024) {
      return fallbackBackground(theme);
    }

    const bytes = await sharp(sourceBytes)
      .rotate()
      .resize(1320, 2868, { fit: "cover", position: "attention" })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();

    return {
      bytes,
      contentType: "image/jpeg",
      attribution: {
        label: selected.creator
          ? `Photo by ${selected.creator}`
          : "Public-domain photograph",
        url: selected.foreign_landing_url ?? selected.url,
        license: selected.license.toUpperCase(),
        creator: selected.creator ?? undefined,
        source: selected.source ?? "Openverse",
      },
    };
  } catch {
    return fallbackBackground(theme);
  }
}
