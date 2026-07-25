const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const optionSchema = (values: readonly string[], defaultValue: string) => ({
  type: "string",
  enum: values,
  default: defaultValue,
});

const specification = {
  openapi: "3.1.0",
  info: {
    title: "WallCab Wallpaper API",
    version: "1.0.0",
    description:
      "Generate one deterministic, source-credited daily learning wallpaper.",
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
            name: "category",
            in: "query",
            schema: optionSchema(
              [
                "vocabulary",
                "coding",
                "finance",
                "stoicism",
                "science",
                "history",
                "psychology",
                "productivity",
              ],
              "vocabulary",
            ),
          },
          {
            name: "theme",
            in: "query",
            schema: optionSchema(
              [
                "nature",
                "mountains",
                "ocean",
                "forest",
                "space",
                "amoled",
                "minimal",
                "abstract",
              ],
              "nature",
            ),
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
  },
  components: {
    schemas: {
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
