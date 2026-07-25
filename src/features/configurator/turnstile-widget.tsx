"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";
import { CUSTOM_UPLOAD_TURNSTILE_ACTION } from "@/features/wallpaper/custom-background";

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      appearance: "interaction-only";
      theme: "dark";
      size: "flexible";
      callback(token: string): void;
      "error-callback"(): void;
      "expired-callback"(): void;
      "timeout-callback"(): void;
    },
  ): string;
  remove(widgetId: string): void;
  reset(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileWidgetProps = {
  siteKey: string;
  resetSignal: number;
  onToken: (token: string) => void;
  onError: () => void;
};

export function TurnstileWidget({
  siteKey,
  resetSignal,
  onToken,
  onError,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const renderWidget = useCallback(() => {
    if (
      !containerRef.current ||
      !window.turnstile ||
      widgetIdRef.current
    ) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action: CUSTOM_UPLOAD_TURNSTILE_ACTION,
      appearance: "interaction-only",
      theme: "dark",
      size: "flexible",
      callback: onToken,
      "error-callback": onError,
      "expired-callback": onError,
      "timeout-callback": onError,
    });
  }, [onError, onToken, siteKey]);

  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget]);

  useEffect(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderWidget}
      />
      <div
        className="turnstile-container"
        ref={containerRef}
        aria-label="Human verification"
      />
    </>
  );
}
