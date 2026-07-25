import { visualThemes } from "@/features/wallpaper/types";

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

const specification = {
  openapi: "3.1.0",
  info: {
    title: "WallCab Wallpaper API",
    version: "2.0.0",
    description:
      "Choose one or more learning interests and generate one deterministic, source-credited daily wallpaper.",
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
        parameters: [
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
            schema: optionSchema(visualThemes, "nature"),
          },
          {
            name: "size",
            in: "query",
            schema: optionSchema(["standard", "air", "max"], "standard"),
          },
        ],
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
        parameters: [
          {
            name: "categories",
            in: "query",
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
            schema: optionSchema(visualThemes, "nature"),
          },
          {
            name: "size",
            in: "query",
            schema: optionSchema(["standard", "air", "max"], "standard"),
          },
        ],
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
          requestId: { type: "string", format: "uuid" },
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
