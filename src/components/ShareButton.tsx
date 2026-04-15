import { useState } from "react";

type CopyState = "idle" | "copied" | "error";

export function ShareButton() {
  const [state, setState] = useState<CopyState>("idle");

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  const label =
    state === "copied" ? "Kopiert!" : state === "error" ? "Feil" : "Del lenke";

  return (
    <button
      className={`ritt-page__bookmark-btn ritt-page__share-btn${state !== "idle" ? ` ritt-page__share-btn--${state}` : ""}`}
      onClick={() => void handleShare()}
      title="Kopier lenke til utklippstavlen"
      aria-live="polite"
    >
      {label}
    </button>
  );
}
