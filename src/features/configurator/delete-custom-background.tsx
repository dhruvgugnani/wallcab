"use client";

import { useEffect, useState } from "react";
import {
  isCustomBackgroundDeleteToken,
  isCustomBackgroundId,
} from "@/features/wallpaper/custom-background";

type DeletionCredential = {
  id: string;
  token: string;
};

function readCredential(): DeletionCredential | null {
  const fragment = window.location.hash.slice(1);
  const [id, token, extra] = fragment.split(".");
  if (
    extra !== undefined ||
    !isCustomBackgroundId(id) ||
    !isCustomBackgroundDeleteToken(token)
  ) {
    return null;
  }
  return { id, token };
}

export function DeleteCustomBackground() {
  const [credential, setCredential] = useState<DeletionCredential | null>(null);
  const [state, setState] = useState<
    "loading" | "ready" | "deleting" | "deleted" | "invalid" | "failed"
  >("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const parsed = readCredential();
      setCredential(parsed);
      setState(parsed ? "ready" : "invalid");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function removeUpload() {
    if (!credential) return;
    setState("deleting");
    setMessage("Deleting the uploaded image and active wallpaper copies…");
    try {
      const response = await fetch(
        `/api/custom-backgrounds/${encodeURIComponent(credential.id)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deleteToken: credential.token }),
        },
      );
      if (!response.ok && response.status !== 404) {
        throw new Error("The deletion service is temporarily unavailable.");
      }
      window.history.replaceState(null, "", window.location.pathname);
      setCredential(null);
      setState("deleted");
      setMessage(
        response.status === 404
          ? "This upload was already deleted or expired."
          : "Your custom background was deleted.",
      );
    } catch (error) {
      setState("failed");
      setMessage(
        error instanceof Error
          ? error.message
          : "The deletion service is temporarily unavailable.",
      );
    }
  }

  return (
    <section className="delete-panel section-shell" aria-live="polite">
      {state === "loading" ? <p>Checking the private deletion link…</p> : null}
      {state === "invalid" ? (
        <>
          <h2>This deletion link is incomplete.</h2>
          <p>
            Use the full private link copied from the WallCab configurator.
            The secret after the <code>#</code> is required and is never sent
            until you press delete.
          </p>
        </>
      ) : null}
      {state === "ready" || state === "deleting" || state === "failed" ? (
        <>
          <h2>Delete the uploaded background?</h2>
          <p>
            This permanently removes the private source image and purges active
            generated wallpaper copies. Your built-in WallCab links are not
            affected.
          </p>
          <button
            type="button"
            disabled={state === "deleting"}
            onClick={removeUpload}
          >
            {state === "deleting" ? "Deleting…" : "Permanently delete"}
          </button>
        </>
      ) : null}
      {state === "deleted" ? (
        <>
          <h2>Deletion complete.</h2>
          <p>{message}</p>
        </>
      ) : null}
      {state !== "deleted" && message ? (
        <p className={state === "failed" ? "delete-error" : ""}>{message}</p>
      ) : null}
    </section>
  );
}
