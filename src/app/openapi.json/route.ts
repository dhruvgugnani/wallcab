import {
  PERSONAL_NOTE_MAX_LENGTH,
  visualThemes,
} from "@/features/wallpaper/types";

const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const categoryValues = [
  "vocabulary",
  "coding",
  "finance",
  "stoicism",
  "science",
  "history",
  "psychology",
  "productivity",
] as const;

const optionSchema = (values: readonly string[], defaultValue: string) => ({
  type: "string",
  enum: values,
  default: defaultValue,
});

const wallpaperParameters = [
  {
    name: "categories",
    in: "query",
    description:
      "One to eight interests. WallCab resolves one category per UTC day.",
    style: "form",
    explode: false,
    schema: {
      type: "array",
      items: { type: "string", enum: categoryValues },
      minItems: 1,
      maxItems: 8,
      uniqueItems: true,
      default: ["vocabulary"],
    },
  },
  {
    name: "theme",
    in: "query",
    description: "Built-in theme and fallback for a custom background.",
    schema: optionSchema(visualThemes, "nature"),
  },
  {
    name: "size",
    in: "query",
    schema: optionSchema(["standard", "air", "max"], "standard"),
  },
  {
    name: "background",
    in: "query",
    description:
      "Optional opaque custom-background ID returned by the upload flow.",
    schema: {
      type: "string",
      pattern: "^[A-Za-z0-9_-]{22}$",
    },
  },
  {
    name: "note",
    in: "query",
    description:
      "Optional text rendered under PERSONAL NOTE. Blank values remove the section. Because it is part of the URL, do not use sensitive information.",
    schema: {
      type: "string",
      minLength: 1,
      maxLength: PERSONAL_NOTE_MAX_LENGTH,
    },
  },
] as const;

const specification = {
  openapi: "3.1.0",
  info: {
    title: "WallCab Wallpaper API",
    version: "2.2.0",
    description:
      "Choose one or more learning interests, optionally add a personal note, and generate one deterministic, source-credited daily wallpaper.",
    license: {
      name: "MIT (code only)",
      url: "https://github.com/dhruvgugnani/wallcab/blob/main/LICENSE",
    },
  },
  servers: [{ url: origin }],
  paths: {
    "/api/wallpaper": {
      get: {
        operationId: "getDailyWallpaper",
        summary: "Get a daily wallpaper",
        parameters: wallpaperParameters,
        responses: {
          "200": {
            description: "Generated wallpaper",
            headers: {
              ETag: { schema: { type: "string" } },
              "X-WallCab-Date": { schema: { type: "string", format: "date" } },
              "X-WallCab-Categories": { schema: { type: "string" } },
              "X-WallCab-Category": { schema: { type: "string" } },
              "X-WallCab-Content-Mode": {
                schema: { type: "string", enum: ["external", "fallback"] },
              },
              "X-WallCab-Content-Provider": {
                schema: { type: "string" },
              },
              "X-WallCab-Background-Mode": {
                schema: {
                  type: "string",
                  enum: ["custom", "daily-photo", "fixed-design"],
                },
              },
              "X-WallCab-Cache": {
                schema: {
                  type: "string",
                  enum: ["HIT", "MISS", "BYPASS"],
                },
              },
            },
            content: {
              "image/png": {
                schema: { type: "string", contentEncoding: "binary" },
              },
            },
          },
          "307": {
            description: "Temporary redirect to a signed cached image",
            headers: {
              Location: {
                required: true,
                schema: { type: "string", format: "uri" },
              },
            },
          },
          "400": {
            description: "Unsupported parameter",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "429": {
            description: "Rate limit exceeded",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "502": {
            description: "Wallpaper generation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      head: {
        operationId: "headDailyWallpaper",
        summary: "Get daily wallpaper metadata",
        parameters: wallpaperParameters,
        responses: {
          "200": { description: "Wallpaper metadata without an image body" },
          "307": { description: "Temporary redirect to a signed cached image" },
          "400": { description: "Unsupported parameter" },
          "429": { description: "Rate limit exceeded" },
          "502": { description: "Wallpaper generation failed" },
        },
      },
    },
    "/api/wallpaper/status": {
      get: {
        operationId: "getDailyWallpaperStatus",
        summary: "Inspect the resolved category and content source",
        parameters: wallpaperParameters,
        responses: {
          "200": {
            description: "Resolved daily source status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WallpaperStatus" },
              },
            },
          },
          "400": { description: "Unsupported parameter" },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
    "/api/custom-backgrounds": {
      post: {
        operationId: "uploadCustomBackground",
        summary: "Upload a private custom background",
        description:
          "Requires a fresh Turnstile token with the custom_background_upload action.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: [
                  "image",
                  "turnstileToken",
                  "rightsConfirmed",
                ],
                properties: {
                  image: {
                    type: "string",
                    contentEncoding: "binary",
                    description: "JPEG, PNG, or WebP up to 4 MiB.",
                  },
                  turnstileToken: {
                    type: "string",
                    maxLength: 2048,
                  },
                  rightsConfirmed: {
                    type: "string",
                    const: "true",
                    description:
                      "Uploader confirms ownership or permission and safe-display suitability.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Private background stored",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CustomUploadResult" },
              },
            },
          },
          "400": { description: "Invalid image or multipart request" },
          "403": { description: "Turnstile verification rejected" },
          "413": { description: "Upload exceeds the request limit" },
          "429": { description: "Upload rate limit exceeded" },
          "503": { description: "Upload protection or storage unavailable" },
        },
      },
    },
    "/api/custom-backgrounds/{backgroundId}": {
      delete: {
        operationId: "deleteCustomBackground",
        summary: "Delete a private custom background",
        parameters: [
          {
            name: "backgroundId",
            in: "path",
            required: true,
            schema: {
              type: "string",
              pattern: "^[A-Za-z0-9_-]{22}$",
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["deleteToken"],
                properties: {
                  deleteToken: {
                    type: "string",
                    pattern: "^[A-Za-z0-9_-]{43}$",
                  },
                },
              },
            },
          },
        },
        responses: {
          "204": { description: "Background deleted" },
          "404": {
            description: "Upload missing or deletion credential invalid",
          },
          "429": { description: "Deletion rate limit exceeded" },
        },
      },
    },
  },
  components: {
    schemas: {
      WallpaperStatus: {
        type: "object",
        required: [
          "date",
          "selectedCategories",
          "resolvedCategory",
          "content",
          "background",
          "requestId",
        ],
        properties: {
          date: { type: "string", format: "date" },
          selectedCategories: {
            type: "array",
            items: { type: "string", enum: categoryValues },
          },
          resolvedCategory: { type: "string", enum: categoryValues },
          content: {
            type: "object",
            required: ["mode", "provider"],
            properties: {
              mode: {
                type: "string",
                enum: ["external", "fallback"],
              },
              provider: { type: "string" },
              fallbackReason: { type: "string" },
              source: {
                type: ["object", "null"],
                properties: {
                  label: { type: "string" },
                  url: { type: "string", format: "uri" },
                  license: { type: "string" },
                },
              },
            },
          },
          background: {
            type: "object",
            required: ["mode", "theme"],
            properties: {
              mode: {
                type: "string",
                enum: ["custom", "daily-photo", "fixed-design"],
              },
              theme: { type: "string", enum: visualThemes },
            },
          },
          requestId: { type: "string", format: "uuid" },
        },
      },
      CustomUploadResult: {
        type: "object",
        required: [
          "backgroundId",
          "deleteToken",
          "deletionUrl",
          "inactiveDays",
        ],
        properties: {
          backgroundId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{22}$",
          },
          deleteToken: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{43}$",
          },
          deletionUrl: { type: "string", format: "uri-reference" },
          inactiveDays: { type: "integer", const: 30 },
        },
      },
      Error: {
        type: "object",
        required: ["code", "message", "requestId"],
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          requestId: { type: "string", format: "uuid" },
        },
      },
    },
  },
} as const;

export function GET() {
  return Response.json(specification, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
