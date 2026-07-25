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

type Selections = {
  category: LearningCategory;
  theme: VisualTheme;
  size: DevicePreset;
};

const defaults: Selections = {
  category: "vocabulary",
  theme: "nature",
  size: "standard",
};

const storageKey = "wallcab:preferences:v1";

function isSelections(value: unknown): value is Selections {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Selections>;
  return (
    learningCategories.includes(candidate.category as LearningCategory) &&
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        const parsed: unknown = stored ? JSON.parse(stored) : null;
        if (isSelections(parsed)) setSelections(parsed);
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
  }

  const apiUrl = useMemo(() => {
    const origin =
      hydrated && window.location.origin !== "null"
        ? window.location.origin
        : siteOrigin;
    const url = new URL("/api/wallpaper", origin);
    url.searchParams.set("category", selections.category);
    url.searchParams.set("theme", selections.theme);
    url.searchParams.set("size", selections.size);
    return url.toString();
  }, [hydrated, selections, siteOrigin]);

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
            What would you like to learn?
          </legend>
          <div className="choice-grid category-choices">
            {learningCategories.map((category) => (
              <label key={category}>
                <input
                  type="radio"
                  name="category"
                  value={category}
                  checked={selections.category === category}
                  onChange={() => updateSelections({ category })}
                />
                <span>{categoryLabels[category]}</span>
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
            This URL contains only these three choices. No account or personal
            information is attached.
          </small>
        </div>
      </div>

      <aside className="preview-panel" aria-label="Live wallpaper preview">
        <div className="preview-label">
          <span>Live edition</span>
          <span>{categoryLabels[selections.category]}</span>
        </div>
        <div className="phone-frame">
          <div className="phone-island" aria-hidden="true" />
          {!previewFailed ? (
            <Image
              key={apiUrl}
              src={apiUrl}
              alt={`Today’s ${categoryLabels[selections.category]} wallpaper in the ${themeLabels[selections.theme]} theme`}
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
          Updated once daily at 00:00 UTC
          <span>Source credit appears on every image</span>
        </p>
      </aside>
    </div>
  );
}
