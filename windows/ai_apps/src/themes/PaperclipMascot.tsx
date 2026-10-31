import { useState } from "react";

const TIPS = [
  "Press Enter to ask. Use Shift+Enter when you need another line.",
  "Open a question from the index to pick up an earlier conversation.",
  "Every answer comes from Gemini through your local bridge.",
  "Options lets you change the model or check the connection.",
  "Code appears in plain preformatted boxes; model HTML is never run.",
];

/**
 * Pip is an original wire-paperclip character. It is purely a help mascot:
 * clicking it cycles local interface tips and never generates an answer.
 */
export function PaperclipMascot() {
  const [tipIndex, setTipIndex] = useState(0);

  return (
    <aside aria-label="Pip the assistant" className="win-mascot-pane">
      <div aria-live="polite" className="win-speech">
        <span className="win-speech-name">Pip says:</span>
        {TIPS[tipIndex]}
      </div>
      <button
        aria-label="Show another assistant tip"
        className="win-paperclip"
        onClick={() => setTipIndex((current) => (current + 1) % TIPS.length)}
        title="Click Pip for another tip"
        type="button"
      >
        <svg
          aria-hidden="true"
          className="win-paperclip-art"
          viewBox="0 0 100 140"
        >
          <path
            className="win-paperclip-wire"
            d="M30 118V30c0-14 9-23 21-23s21 9 21 23v68c0 18-11 31-27 31S18 116 18 98V43"
          />
          <path
            className="win-paperclip-wire win-paperclip-wire--inner"
            d="M50 43v57c0 10 7 16 15 12"
          />
          <g className="win-paperclip-face">
            <circle className="win-paperclip-eye" cx="42" cy="39" r="3.2" />
            <circle className="win-paperclip-eye" cx="59" cy="39" r="3.2" />
            <path
              className="win-paperclip-smile"
              d="M42 50c4 5 11 5 15 0"
            />
            <path className="win-paperclip-brow" d="M36 31l8-3" />
            <path className="win-paperclip-brow" d="M65 31l-8-3" />
          </g>
        </svg>
        <span className="win-mascot-name">Pip</span>
      </button>
      <span className="win-mascot-caption">Click Pip for another tip</span>
    </aside>
  );
}
