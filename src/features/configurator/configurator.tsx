"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isCustomBackgroundDeleteToken,
  isCustomBackgroundId,
} from "@/features/wallpaper/custom-background";
import {
  categoryLabels,
  deviceDimensions,
  devicePresets,
  learningCategories,
  originalThemes,
  PERSONAL_NOTE_MAX_LENGTH,
  photographicThemes,
  themeCadence,
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
import { prepareImageUpload } from "./prepare-upload";
import { TurnstileWidget } from "./turnstile-widget";

type SavedCustomBackground = {
  id: string;
  deleteToken: string;
  deletionUrl: string;
  active: boolean;
};

type Selections = {
  categories: LearningCategory[];
  theme: VisualTheme;
  size: DevicePreset;
  customBackground?: SavedCustomBackground;
  personalNote: string;
};

const defaults: Selections = {
  categories: ["vocabulary"],
  theme: "nature",
  size: "standard",
  personalNote: "",
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

const storageKey = "wallcab:preferences:v3";
const legacyStorageKey = "wallcab:preferences:v2";

const themeGroups = [
  {
    id: "photography",
    label: "Daily photography",
    note: "A new source-checked image each day",
    themes: photographicThemes,
  },
  {
    id: "originals",
    label: "WallCab Originals",
    note: "Fixed SVG art; the lesson still changes daily",
    themes: originalThemes,
  },
] as const;

type StoredSelections = Omit<Selections, "personalNote"> & {
  personalNote?: string;
};

function isStoredSelections(value: unknown): value is StoredSelections {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredSelections>;
  const custom = candidate.customBackground;
  const customIsValid =
    custom === undefined ||
    (typeof custom === "object" &&
      custom !== null &&
      isCustomBackgroundId(custom.id) &&
      isCustomBackgroundDeleteToken(custom.deleteToken) &&
      typeof custom.deletionUrl === "string" &&
      typeof custom.active === "boolean");
  return (
    Array.isArray(candidate.categories) &&
    candidate.categories.length >= 1 &&
    candidate.categories.length <= learningCategories.length &&
    candidate.categories.every((category) =>
      learningCategories.includes(category as LearningCategory),
    ) &&
    visualThemes.includes(candidate.theme as VisualTheme) &&
    devicePresets.includes(candidate.size as DevicePreset) &&
    (candidate.personalNote === undefined ||
      (typeof candidate.personalNote === "string" &&
        candidate.personalNote.length <= PERSONAL_NOTE_MAX_LENGTH &&
        !/[\u0000-\u001f\u007f]/.test(candidate.personalNote))) &&
    customIsValid
  );
}

type UploadStatus = "idle" | "preparing" | "uploading" | "failed";

export function Configurator({
  siteOrigin,
  shortcutUrl,
  turnstileSiteKey,
}: {
  siteOrigin: string;
  shortcutUrl: string;
  turnstileSiteKey: string;
}) {
  const [selections, setSelections] = useState<Selections>(defaults);
  const [hydrated, setHydrated] = useState(false);
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState("");
  const [sourceStatus, setSourceStatus] = useState<SourceStatus>({
    state: "loading",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAllowed, setUploadAllowed] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [deleteStatus, setDeleteStatus] = useState<
    "idle" | "deleting" | "failed"
  >("idle");
  const [deleteMessage, setDeleteMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored =
          window.localStorage.getItem(storageKey) ??
          window.localStorage.getItem(legacyStorageKey);
        const parsed: unknown = stored ? JSON.parse(stored) : null;
        if (isStoredSelections(parsed)) {
          setSelections({
            ...parsed,
            categories: normalizeLearningCategories(parsed.categories),
            personalNote: parsed.personalNote?.trim() ?? "",
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

  function selectTheme(theme: VisualTheme) {
    setSelections((current) => ({
      ...current,
      theme,
      customBackground: current.customBackground
        ? { ...current.customBackground, active: false }
        : undefined,
    }));
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
    const browserOrigin =
      hydrated && window.location.origin !== "null"
        ? window.location.origin
        : "";
    const origin =
      browserOrigin.startsWith("http://localhost") ||
      browserOrigin.startsWith("http://127.0.0.1")
        ? browserOrigin
        : siteOrigin;
    const url = new URL("/api/wallpaper", origin);
    url.searchParams.set("categories", selections.categories.join(","));
    url.searchParams.set("theme", selections.theme);
    url.searchParams.set("size", selections.size);
    if (selections.customBackground?.active) {
      url.searchParams.set("background", selections.customBackground.id);
    }
    const personalNote = selections.personalNote.trim();
    if (personalNote) {
      url.searchParams.set("note", personalNote);
    }
    return url.toString().replaceAll("%2C", ",");
  }, [hydrated, selections, siteOrigin]);

  const statusUrl = useMemo(() => {
    const url = new URL(apiUrl);
    url.pathname = "/api/wallpaper/status";
    url.searchParams.delete("note");
    return url.toString();
  }, [apiUrl]);

  const previewRequestUrl = useMemo(() => {
    const url = new URL(apiUrl);
    url.searchParams.set("preview", "1");
    return url.toString().replaceAll("%2C", ",");
  }, [apiUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      setPreviewUrl(previewRequestUrl);
      setPreviewFailed(false);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [previewRequestUrl]);

  const resolvedCategory = hydrated
    ? selectDailyCategory(selections.categories)
    : selections.categories[0]!;

  useEffect(() => {
    if (!hydrated) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
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
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
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

  const acceptTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token);
    setUploadMessage("");
  }, []);

  const rejectTurnstileToken = useCallback(() => {
    setTurnstileToken("");
    setUploadMessage("Verification expired. Please complete it again.");
  }, []);

  async function uploadCustomBackground() {
    if (!uploadFile || !uploadAllowed || !turnstileToken) return;

    setUploadStatus("preparing");
    setUploadMessage("Preparing your image…");
    try {
      const prepared = await prepareImageUpload(uploadFile);
      const form = new FormData();
      form.set("image", prepared);
      form.set("turnstileToken", turnstileToken);
      form.set("rightsConfirmed", "true");
      setUploadStatus("uploading");
      setUploadMessage("Saving your private background…");

      const response = await fetch("/api/custom-backgrounds", {
        method: "POST",
        body: form,
      });
      const result = (await response.json().catch(() => null)) as
        | {
          backgroundId?: string;
          deleteToken?: string;
          deletionUrl?: string;
          message?: string;
        }
        | null;

      if (
        !response.ok ||
        !result ||
        !isCustomBackgroundId(result.backgroundId) ||
        !isCustomBackgroundDeleteToken(result.deleteToken) ||
        typeof result.deletionUrl !== "string"
      ) {
        throw new Error(
          result?.message ?? "The upload could not be saved. Please try again.",
        );
      }

      setSelections((current) => ({
        ...current,
        customBackground: {
          id: result.backgroundId as string,
          deleteToken: result.deleteToken as string,
          deletionUrl: result.deletionUrl as string,
          active: true,
        },
      }));
      setUploadFile(null);
      setUploadAllowed(false);
      setUploadStatus("idle");
      setUploadMessage(
        "Your upload is active. Copy the updated wallpaper address below.",
      );
      setPreviewFailed(false);
      setSourceStatus({ state: "loading" });
    } catch (error) {
      setUploadStatus("failed");
      setUploadMessage(
        error instanceof Error
          ? error.message
          : "The upload could not be saved. Please try again.",
      );
    } finally {
      setTurnstileToken("");
      setTurnstileReset((current) => current + 1);
    }
  }

  async function copyDeletionLink() {
    const deletionUrl = selections.customBackground?.deletionUrl;
    if (!deletionUrl) return;
    try {
      await navigator.clipboard.writeText(deletionUrl);
      setDeleteMessage("Private deletion link copied.");
    } catch {
      setDeleteMessage("Select and copy the private link manually.");
    }
  }

  async function deleteUpload() {
    const custom = selections.customBackground;
    if (!custom) return;
    setDeleteStatus("deleting");
    setDeleteMessage("Deleting your upload…");
    try {
      const response = await fetch(
        `/api/custom-backgrounds/${encodeURIComponent(custom.id)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deleteToken: custom.deleteToken }),
        },
      );
      if (!response.ok && response.status !== 404) {
        throw new Error("Deletion is temporarily unavailable.");
      }
      setSelections((current) => ({
        ...current,
        customBackground: undefined,
      }));
      setDeleteStatus("idle");
      setDeleteMessage("The upload was deleted.");
      setPreviewFailed(false);
      setSourceStatus({ state: "loading" });
    } catch (error) {
      setDeleteStatus("failed");
      setDeleteMessage(
        error instanceof Error
          ? error.message
          : "Deletion is temporarily unavailable.",
      );
    }
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
          <div className="theme-groups">
            {themeGroups.map((group) => (
              <section
                className="theme-group"
                aria-labelledby={`theme-group-${group.id}`}
                key={group.id}
              >
                <div className="theme-group-heading">
                  <p id={`theme-group-${group.id}`}>{group.label}</p>
                  <span aria-hidden="true" />
                  <small>{group.note}</small>
                </div>
                <div className="choice-grid theme-choices">
                  {group.themes.map((theme) => (
                    <label key={theme} data-theme={theme}>
                      <input
                        type="radio"
                        name="theme"
                        value={theme}
                        aria-label={themeLabels[theme]}
                        checked={selections.theme === theme}
                        onChange={() => selectTheme(theme)}
                      />
                      <span className="theme-swatch" aria-hidden="true" />
                      <span className="theme-copy">
                        <strong>{themeLabels[theme]}</strong>
                        <small>
                          {themeCadence[theme] === "daily"
                            ? "Daily photo"
                            : "Fixed design"}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <section className="custom-background" aria-labelledby="custom-title">
            <div className="theme-group-heading">
              <p id="custom-title">Your own background</p>
              <span aria-hidden="true" />
              <small>Private upload · retained while used</small>
            </div>

            {selections.customBackground ? (
              <div className="custom-background-saved">
                <div>
                  <span
                    className={
                      selections.customBackground.active
                        ? "custom-state custom-state-active"
                        : "custom-state"
                    }
                  >
                    {selections.customBackground.active
                      ? "Active"
                      : "Saved, not active"}
                  </span>
                  <strong>Your uploaded background</strong>
                  <p>
                    It stays behind each new daily lesson. It is removed after
                    30 days without wallpaper use.
                  </p>
                </div>
                <div className="custom-actions">
                  <button
                    type="button"
                    onClick={() =>
                      updateSelections({
                        customBackground: {
                          ...selections.customBackground!,
                          active: !selections.customBackground!.active,
                        },
                      })
                    }
                  >
                    {selections.customBackground.active
                      ? "Use built-in style"
                      : "Use my upload"}
                  </button>
                  <button type="button" onClick={copyDeletionLink}>
                    Copy deletion link
                  </button>
                  <button
                    className="custom-delete"
                    type="button"
                    disabled={deleteStatus === "deleting"}
                    onClick={deleteUpload}
                  >
                    {deleteStatus === "deleting"
                      ? "Deleting…"
                      : "Delete upload"}
                  </button>
                </div>
                <code>{selections.customBackground.deletionUrl}</code>
              </div>
            ) : (
              <div className="custom-upload-form">
                <label className="custom-file">
                  <span>Choose a JPEG, PNG, or WebP</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      setUploadFile(event.target.files?.[0] ?? null);
                      setUploadMessage("");
                    }}
                  />
                  <strong>
                    {uploadFile ? uploadFile.name : "Choose image"}
                  </strong>
                </label>
                <label className="custom-consent">
                  <input
                    type="checkbox"
                    checked={uploadAllowed}
                    onChange={(event) =>
                      setUploadAllowed(event.target.checked)
                    }
                  />
                  <span>
                    I own this image or have permission to use it, and it is
                    safe to display.
                  </span>
                </label>
                {turnstileSiteKey ? (
                  <TurnstileWidget
                    siteKey={turnstileSiteKey}
                    resetSignal={turnstileReset}
                    onToken={acceptTurnstileToken}
                    onError={rejectTurnstileToken}
                  />
                ) : (
                  <p className="custom-setup-note">
                    Uploads are being connected. Built-in styles remain
                    available.
                  </p>
                )}
                <button
                  className="custom-upload-button"
                  type="button"
                  disabled={
                    !turnstileSiteKey ||
                    !turnstileToken ||
                    !uploadFile ||
                    !uploadAllowed ||
                    uploadStatus === "preparing" ||
                    uploadStatus === "uploading"
                  }
                  onClick={uploadCustomBackground}
                >
                  {uploadStatus === "preparing"
                    ? "Preparing…"
                    : uploadStatus === "uploading"
                      ? "Uploading…"
                      : "Use my background"}
                </button>
                <p className="custom-upload-note">
                  Your browser shrinks large photos before upload. WallCab
                  strips metadata and keeps the original private.
                </p>
              </div>
            )}
            <p
              className={
                uploadStatus === "failed" || deleteStatus === "failed"
                  ? "custom-message custom-message-error"
                  : "custom-message"
              }
              aria-live="polite"
            >
              {uploadMessage || deleteMessage}
            </p>
          </section>
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

        <fieldset>
          <legend>
            <span>04</span>
            Add something personal
          </legend>
          <label className="personal-note-field" htmlFor="personal-note">
            <span>Personal note</span>
            <input
              id="personal-note"
              name="personalNote"
              type="text"
              value={selections.personalNote}
              maxLength={PERSONAL_NOTE_MAX_LENGTH}
              autoComplete="off"
              placeholder="Something Of Your Own..."
              aria-describedby="personal-note-help personal-note-count"
              onChange={(event) =>
                setSelections((current) => ({
                  ...current,
                  personalNote: event.target.value,
                }))
              }
            />
            <span className="personal-note-meta">
              <small id="personal-note-help">
                Optional. Leave this blank to remove the section completely.
              </small>
              <small id="personal-note-count" aria-live="polite">
                {selections.personalNote.length}/{PERSONAL_NOTE_MAX_LENGTH}
              </small>
            </span>
          </label>
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
            {selections.customBackground?.active
              ? " private background"
              : " theme"}
            , one size
            {selections.personalNote.trim()
              ? ", and your personal note"
              : ""}
            .{" "}
            {selections.personalNote.trim()
              ? "Avoid sensitive information because the note is visible in the URL. "
              : ""}
            No account is attached.
          </small>
          <div className="shortcut-next">
            <div className="shortcut-next-copy">
              <span>Complete setup</span>
              <strong>Install it, then schedule it.</strong>
              <ol className="shortcut-next-steps">
                <li>
                  <span>01</span>
                  <p>Copy the wallpaper address above.</p>
                </li>
                <li>
                  <span>02</span>
                  <p>
                    Install WallCab and paste the address when the Shortcut
                    asks.
                  </p>
                </li>
                <li>
                  <span>03</span>
                  <p>
                    Open Shortcuts → Automation → + → Time of Day.
                  </p>
                </li>
                <li>
                  <span>04</span>
                  <p>
                    Choose your time, select <strong>Daily</strong> and{" "}
                    <strong>Run Immediately</strong>, tap Next, then choose
                    WallCab.
                  </p>
                </li>
              </ol>
            </div>
            <div className="shortcut-next-actions">
              <a
                className="button button-light"
                href={shortcutUrl}
                target="_blank"
                rel="noreferrer"
              >
                Install WallCab Shortcut
              </a>
              <Link className="text-link" href="/install#manual-setup">
                See every setup screen
              </Link>
            </div>
          </div>
        </div>
      </div>

      <aside className="preview-panel" aria-label="Live wallpaper preview">
        <div className="preview-sticky">
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
            {!previewFailed ? (
              <>
                <Image
                  key={previewUrl || previewRequestUrl}
                  src={previewUrl || previewRequestUrl}
                  alt={`Today’s ${categoryLabels[resolvedCategory]} wallpaper using ${
                    selections.customBackground?.active
                      ? "your custom background"
                      : `the ${themeLabels[selections.theme]} theme`
                  }`}
                  width={deviceDimensions[selections.size].width}
                  height={deviceDimensions[selections.size].height}
                  sizes="(max-width: 800px) 78vw, 31vw"
                  unoptimized
                  onLoad={() => setPreviewLoading(false)}
                  onError={() => {
                    setPreviewLoading(false);
                    setPreviewFailed(true);
                  }}
                />
                {previewLoading ? (
                  <div className="preview-loading" role="status">
                    <span aria-hidden="true" />
                    <p>Preparing fast preview&hellip;</p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="preview-error">
                <strong>Preview paused</strong>
                <p>The wallpaper service is temporarily unavailable.</p>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewLoading(true);
                    setPreviewFailed(false);
                  }}
                >
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
        </div>
      </aside>
    </div>
  );
}
