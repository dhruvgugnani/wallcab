"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  categoryLabels,
  deviceDimensions,
  devicePresets,
  learningCategories,
  themeLabels,
  visualThemes,
  type DevicePreset,
  type LearningCategory,
  type VisualTheme,
} from "@/features/wallpaper/types";
import {
  normalizeLearningCategories,
  selectDailyCategory,
} from "@/features/wallpaper/preferences";

type Selections = {
  categories: LearningCategory[];
  theme: VisualTheme;
  size: DevicePreset;
};

const defaults: Selections = {
  categories: ["vocabulary"],
  theme: "nature",
  size: "standard",
};

type SourceStatus =
  | { state: "loading" }
  | {
      state: "ready";
      category: LearningCategory;
      mode: "external" | "fallback";
      provider: string;
    }
  | { state: "unavailable" };

const storageKey = "wallcab:preferences:v2";

function isSelections(value: unknown): value is Selections {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Selections>;
  return (
    Array.isArray(candidate.categories) &&
    candidate.categories.length >= 1 &&
    candidate.categories.length <= learningCategories.length &&
    candidate.categories.every((category) =>
      learningCategories.includes(category as LearningCategory),
    ) &&
    visualThemes.includes(candidate.theme as VisualTheme) &&
    devicePresets.includes(candidate.size as DevicePreset)
  );
}

export function Configurator({ siteOrigin }: { siteOrigin: string }) {
  const [selections, setSelections] = useState<Selections>(defaults);
  const [hydrated, setHydrated] = useState(false);
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [sourceStatus, setSourceStatus] = useState<SourceStatus>({
    state: "loading",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        const parsed: unknown = stored ? JSON.parse(stored) : null;
        if (isSelections(parsed)) {
          setSelections({
            ...parsed,
            categories: normalizeLearningCategories(parsed.categories),
          });
        }
      } catch {
        // A blocked localStorage should not prevent the configurator from working.
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(selections));
    } catch {
      // Preferences simply remain session-only when storage is unavailable.
    }
  }, [hydrated, selections]);

  function updateSelections(next: Partial<Selections>) {
    setSelections((current) => ({ ...current, ...next }));
    setPreviewFailed(false);
    setSourceStatus({ state: "loading" });
  }

  function toggleCategory(category: LearningCategory) {
    setSelections((current) => {
      const selected = current.categories.includes(category);
      if (selected && current.categories.length === 1) {
        return current;
      }

      const categories = selected
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category];
      return {
        ...current,
        categories: normalizeLearningCategories(categories),
      };
    });
    setPreviewFailed(false);
    setSourceStatus({ state: "loading" });
  }

  const apiUrl = useMemo(() => {
    const origin =
      hydrated && window.location.origin !== "null"
        ? window.location.origin
        : siteOrigin;
    const url = new URL("/api/wallpaper", origin);
    url.searchParams.set("categories", selections.categories.join(","));
    url.searchParams.set("theme", selections.theme);
    url.searchParams.set("size", selections.size);
    return url.toString().replaceAll("%2C", ",");
  }, [hydrated, selections, siteOrigin]);

  const statusUrl = useMemo(() => {
    const url = new URL(apiUrl);
    url.pathname = "/api/wallpaper/status";
    return url.toString();
  }, [apiUrl]);

  const resolvedCategory = hydrated
    ? selectDailyCategory(selections.categories)
    : selections.categories[0]!;

  useEffect(() => {
    if (!hydrated) return;

    const controller = new AbortController();
    void fetch(statusUrl, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Status unavailable");
        }
        return response.json() as Promise<{
          resolvedCategory: LearningCategory;
          content: {
            mode: "external" | "fallback";
            provider: string;
          };
        }>;
      })
      .then((status) => {
        setSourceStatus({
          state: "ready",
          category: status.resolvedCategory,
          mode: status.content.mode,
          provider: status.content.provider,
        });
      })
      .catch((error: unknown) => {
        if (
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setSourceStatus({ state: "unavailable" });
        }
      });

    return () => controller.abort();
  }, [hydrated, statusUrl]);

  async function copyUrl() {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(apiUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    window.setTimeout(() => setCopyStatus("idle"), 2400);
  }

  return (
    <div className="configurator">
      <div className="config-panel">
        <fieldset>
          <legend>
            <span>01</span>
            What would you like to learn about?
          </legend>
          <div className="category-guidance">
            <p id="category-guidance">
              Choose one or more. WallCab picks one of your interests for each
              UTC day.
            </p>
            <button
              type="button"
              onClick={() =>
                updateSelections({
                  categories:
                    selections.categories.length ===
                    learningCategories.length
                      ? ["vocabulary"]
                      : [...learningCategories],
                })
              }
            >
              {selections.categories.length === learningCategories.length
                ? "Reset"
                : "Select all"}
            </button>
          </div>
          <div className="choice-grid category-choices">
            {learningCategories.map((category) => (
              <label key={category}>
                <input
                  type="checkbox"
                  name="categories"
                  value={category}
                  checked={selections.categories.includes(category)}
                  aria-describedby="category-guidance"
                  onChange={() => toggleCategory(category)}
                />
                <span>
                  {categoryLabels[category]}
                  <i aria-hidden="true">✓</i>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <span>02</span>
            Choose a visual direction
          </legend>
          <div className="choice-grid theme-choices">
            {visualThemes.map((theme) => (
              <label key={theme} data-theme={theme}>
                <input
                  type="radio"
                  name="theme"
                  value={theme}
                  checked={selections.theme === theme}
                  onChange={() => updateSelections({ theme })}
                />
                <span className="theme-swatch" aria-hidden="true" />
                <span>{themeLabels[theme]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <span>03</span>
            Which iPhone are you using?
          </legend>
          <div className="device-choices">
            {devicePresets.map((size) => (
              <label key={size}>
                <input
                  type="radio"
                  name="size"
                  value={size}
                  checked={selections.size === size}
                  onChange={() => updateSelections({ size })}
                />
                <span>
                  <strong>{deviceDimensions[size].label}</strong>
                  <small>
                    {deviceDimensions[size].width} × {deviceDimensions[size].height}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="api-output">
          <p>Your personal wallpaper address</p>
          <code>{apiUrl}</code>
          <button type="button" onClick={copyUrl}>
            {copyStatus === "copied"
              ? "Copied"
              : copyStatus === "failed"
                ? "Select address manually"
                : "Copy address"}
            <span aria-hidden="true">
              {copyStatus === "copied" ? "✓" : "↗"}
            </span>
          </button>
          <span className="sr-only" aria-live="polite">
            {copyStatus === "copied"
              ? "Wallpaper address copied to the clipboard."
              : copyStatus === "failed"
                ? "Copy failed. Select the wallpaper address and copy it manually."
                : ""}
          </span>
          <small>
            This URL contains {selections.categories.length} learning{" "}
            {selections.categories.length === 1 ? "choice" : "choices"}, one
            theme, and one size. No account or personal information is
            attached.
          </small>
        </div>
      </div>

      <aside className="preview-panel" aria-label="Live wallpaper preview">
        <div className="preview-label">
          <span>Live edition</span>
          <span>
            Today ·{" "}
            {categoryLabels[
              sourceStatus.state === "ready"
                ? sourceStatus.category
                : resolvedCategory
            ]}
          </span>
        </div>
        <div className="phone-frame">
          <div className="phone-island" aria-hidden="true" />
          {sourceStatus.state === "loading" ? (
            <div className="preview-loading" role="status">
              <span />
              <p>Choosing today&apos;s lesson</p>
            </div>
          ) : !previewFailed ? (
            <Image
              key={apiUrl}
              src={apiUrl}
              alt={`Today’s ${categoryLabels[resolvedCategory]} wallpaper in the ${themeLabels[selections.theme]} theme`}
              width={deviceDimensions[selections.size].width}
              height={deviceDimensions[selections.size].height}
              sizes="(max-width: 800px) 78vw, 31vw"
              unoptimized
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <div className="preview-error">
              <strong>Preview paused</strong>
              <p>The wallpaper service is temporarily unavailable.</p>
              <button type="button" onClick={() => setPreviewFailed(false)}>
                Try again
              </button>
            </div>
          )}
        </div>
        <p className="preview-note">
          <span>Updated once daily at 00:00 UTC</span>
          <span
            className={
              sourceStatus.state === "ready"
                ? `source-mode source-mode-${sourceStatus.mode}`
                : "source-mode"
            }
          >
            {sourceStatus.state === "ready"
              ? sourceStatus.mode === "external"
                ? `External · ${sourceStatus.provider}`
                : "Fallback · reviewed catalog"
              : "Source status unavailable"}
          </span>
        </p>
      </aside>
    </div>
  );
}
