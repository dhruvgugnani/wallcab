import sharp from "sharp";
import { z } from "zod";
import { hashString, toUtcDateKey } from "@/features/wallpaper/daily";
import type {
  BackgroundAsset,
  PhotographicTheme,
  VisualTheme,
} from "@/features/wallpaper/types";
import { isPhotographicTheme } from "@/features/wallpaper/types";
import { createOriginalBackground } from "@/server/services/original-backgrounds";

const themeQueries: Record<PhotographicTheme, string> = {
  nature: "plants nature",
  mountains: "mountain landscape",
  ocean: "ocean coast",
  forest: "forest trees",
  space: "space nebula",
};

const themeMetadataTerms: Record<PhotographicTheme, ReadonlySet<string>> = {
  nature: new Set([
    "botany",
    "flora",
    "flower",
    "flowers",
    "garden",
    "grass",
    "leaf",
    "leaves",
    "nature",
    "plant",
    "plants",
    "wild",
  ]),
  mountains: new Set([
    "highland",
    "highlands",
    "mountain",
    "mountains",
    "peak",
    "peaks",
    "rocky",
    "summit",
  ]),
  ocean: new Set([
    "beach",
    "coast",
    "ocean",
    "sea",
    "shore",
    "water",
    "wave",
    "waves",
  ]),
  forest: new Set([
    "forest",
    "forests",
    "pine",
    "tree",
    "trees",
    "woodland",
    "woods",
  ]),
  space: new Set([
    "astronomy",
    "astrophotography",
    "constellation",
    "constellations",
    "cosmos",
    "galaxy",
    "milkyway",
    "nebula",
    "space",
    "stars",
  ]),
};

const rejectedMetadataTerms = new Set([
  "art",
  "book",
  "books",
  "boy",
  "boys",
  "child",
  "children",
  "drawing",
  "girl",
  "girls",
  "human",
  "illustration",
  "man",
  "male",
  "painting",
  "people",
  "person",
  "portrait",
  "poster",
  "text",
  "vintage",
  "woman",
  "women",
]);

const paletteByTheme: Record<
  PhotographicTheme,
  readonly [string, string, string]
> = {
  nature: ["#0b1610", "#284532", "#a4aa79"],
  mountains: ["#080b0e", "#303941", "#9b8d79"],
  ocean: ["#020a0e", "#083047", "#40798b"],
  forest: ["#050b08", "#102a1d", "#56705d"],
  space: ["#020205", "#13182a", "#554c6b"],
};

const openverseSchema = z.object({
  results: z.array(
    z.object({
      url: z.url(),
      foreign_landing_url: z.url().nullable().optional(),
      creator: z.string().nullable().optional(),
      license: z.string(),
      source: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
      title: z.string().nullable().optional(),
      tags: z
        .array(
          z.object({
            name: z.string(),
          }),
        )
        .optional(),
      width: z.number().nullable().optional(),
      height: z.number().nullable().optional(),
    }),
  ),
});

const allowedImageHosts = new Set([
  "upload.wikimedia.org",
  "live.staticflickr.com",
  "cdn.stocksnap.io",
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

function metadataTerms(result: {
  title?: string | null;
  tags?: Array<{ name: string }>;
}): Set<string> {
  return new Set(
    [result.title ?? "", ...(result.tags?.map(({ name }) => name) ?? [])]
      .flatMap((value) => value.toLowerCase().split(/[^\p{L}\p{N}]+/u))
      .filter(Boolean),
  );
}

function isThemeMatchedPhotograph(
  theme: PhotographicTheme,
  result: {
    title?: string | null;
    tags?: Array<{ name: string }>;
    category?: string | null;
    source?: string | null;
    width?: number | null;
    height?: number | null;
  },
): boolean {
  if (
    result.category?.toLowerCase() !== "photograph" ||
    result.source?.toLowerCase() !== "stocksnap" ||
    (result.width ?? 0) < 900 ||
    (result.height ?? 0) < 1_200 ||
    (result.height ?? 0) < (result.width ?? 0) * 1.15
  ) {
    return false;
  }

  const terms = metadataTerms(result);
  if ([...terms].some((term) => rejectedMetadataTerms.has(term))) {
    return false;
  }

  return [...terms].some((term) =>
    themeMetadataTerms[theme].has(term),
  );
}

function fallbackMotif(theme: PhotographicTheme): string {
  switch (theme) {
    case "nature":
      return `
        <g data-theme-motif="nature">
          <path d="M1080 210 C760 300 690 610 825 850 C1110 780 1260 500 1080 210Z" fill="#b7c992" fill-opacity=".28"/>
          <path d="M1065 265 C980 470 905 635 825 850" fill="none" stroke="#dce6bd" stroke-opacity=".24" stroke-width="8"/>
          <path d="M250 1940 C535 1645 840 1715 1020 2050 C730 2250 420 2185 250 1940Z" fill="#718b62" fill-opacity=".22"/>
          <path d="M300 1945 C545 1950 790 1990 1020 2050" fill="none" stroke="#dce6bd" stroke-opacity=".18" stroke-width="7"/>
        </g>`;
    case "mountains":
      return `
        <g data-theme-motif="mountains">
          <path d="M-120 2110 L365 980 L620 1510 L905 650 L1460 2110Z" fill="#82909a" fill-opacity=".34"/>
          <path d="M365 980 L485 1245 L410 1210 L350 1305 L295 1150Z" fill="#e8e2d6" fill-opacity=".3"/>
          <path d="M905 650 L1085 1015 L980 950 L900 1090 L820 825Z" fill="#f0e9dc" fill-opacity=".38"/>
          <path d="M-100 2260 L430 1650 L660 1920 L1040 1320 L1450 2230Z" fill="#11181c" fill-opacity=".54"/>
        </g>`;
    case "ocean":
      return `
        <g data-theme-motif="ocean" fill="none">
          <path d="M-100 700 C190 520 390 885 680 700 C965 520 1165 860 1440 670" stroke="#8ec9d6" stroke-opacity=".28" stroke-width="44"/>
          <path d="M-120 1140 C210 940 430 1340 760 1120 C1020 945 1220 1180 1450 1060" stroke="#62a9bb" stroke-opacity=".3" stroke-width="64"/>
          <path d="M-140 1740 C170 1480 470 1895 800 1650 C1060 1460 1250 1690 1460 1530" stroke="#b4dce3" stroke-opacity=".18" stroke-width="30"/>
          <circle cx="1020" cy="430" r="185" fill="#d9ede8" fill-opacity=".1" stroke="none"/>
        </g>`;
    case "forest":
      return `
        <g data-theme-motif="forest">
          <path d="M170 2290 V760 M445 2360 V490 M765 2280 V690 M1080 2370 V390" stroke="#203d2c" stroke-opacity=".76" stroke-width="84"/>
          <circle cx="150" cy="690" r="350" fill="#486c52" fill-opacity=".3"/>
          <circle cx="470" cy="490" r="420" fill="#315842" fill-opacity=".4"/>
          <circle cx="820" cy="625" r="390" fill="#54725a" fill-opacity=".26"/>
          <circle cx="1110" cy="360" r="430" fill="#395e47" fill-opacity=".38"/>
        </g>`;
    case "space":
      return `
        <g data-theme-motif="space">
          <circle cx="1015" cy="545" r="235" fill="#7e789f" fill-opacity=".18"/>
          <circle cx="1015" cy="545" r="310" fill="none" stroke="#d7d3e8" stroke-opacity=".19" stroke-width="5"/>
          <path d="M95 530 H105 M250 310 H266 M475 645 H487 M690 280 H700 M920 1040 H934 M1140 1180 H1152 M310 1270 H324 M650 1510 H660" stroke="#fff" stroke-opacity=".62" stroke-width="8" stroke-linecap="round"/>
          <path d="M-140 2160 C270 1710 610 1980 950 1580 C1130 1370 1280 1360 1450 1120" fill="none" stroke="#9a92bc" stroke-opacity=".14" stroke-width="120"/>
        </g>`;
  }
}

function fallbackBackground(theme: PhotographicTheme): BackgroundAsset {
  const [dark, mid, accent] = paletteByTheme[theme];
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
      ${fallbackMotif(theme)}
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
  if (!isPhotographicTheme(theme)) {
    return createOriginalBackground(theme);
  }

  try {
    const query = new URLSearchParams({
      q: themeQueries[theme],
      category: "photograph",
      aspect_ratio: "tall",
      size: "large",
      source: "stocksnap",
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
        isThemeMatchedPhotograph(theme, result),
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
