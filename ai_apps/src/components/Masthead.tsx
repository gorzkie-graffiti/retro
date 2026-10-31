import type { FormEvent } from "react";

interface MastheadProps {
  historyQuery: string;
  onHistoryQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
}

export function Masthead({
  historyQuery,
  onHistoryQueryChange,
  onSearchSubmit,
}: MastheadProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearchSubmit();
  }

  return (
    <>
      <div className="utility-bar">
        <div className="page-width utility-inner">
          <nav aria-label="Utility" className="utility-links">
            <a href="#top">Gemini Labs</a>
            <span aria-hidden="true" className="utility-sep">
              |
            </span>
            <a href="#module-help">About the beta</a>
            <span aria-hidden="true" className="utility-sep">
              |
            </span>
            <a href="https://github.com/Sophomoresty/gemini-web2api" rel="noreferrer" target="_blank">
              Bridge source
            </a>
          </nav>
          <div className="utility-session">
            <span className="utility-led" aria-hidden="true" />
            Guest session · saved on this computer
          </div>
        </div>
      </div>

      <header className="masthead" id="top">
        <div className="masthead-tint" aria-hidden="true" />
        <div className="page-width masthead-inner">
          <a className="brand" href="#top" aria-label="Gemini Web 2.0 home">
            <span className="brand-gem" aria-hidden="true">
              <span className="brand-gem-shine" />
            </span>
            <span className="brand-copy">
              <span className="brand-name">
                Gemini
                <span className="brand-tm">™</span>
              </span>
              <span className="brand-tagline">Ask more. Know more.</span>
            </span>
          </a>

          <div className="masthead-right">
            <form className="history-search" onSubmit={handleSubmit} role="search">
              <label htmlFor="masthead-history-search">Search your history</label>
              <div className="history-search-row">
                <input
                  id="masthead-history-search"
                  onChange={(event) => onHistoryQueryChange(event.target.value)}
                  placeholder="Type a topic from an earlier chat…"
                  type="search"
                  value={historyQuery}
                />
                <button className="btn btn-small" type="submit">
                  Find
                </button>
              </div>
            </form>
            <div className="masthead-session">
              <strong>Personal answers, beta.</strong>
              <br />
              Powered by your own Gemini backend.
            </div>
          </div>
        </div>
        <div className="beta-ribbon" title="Public beta build">
          ★ BETA ★
        </div>
      </header>

      <nav aria-label="Primary" className="site-nav">
        <div className="page-width nav-inner">
          <a className="nav-tab nav-tab--active" href="#top">
            Home
          </a>
          <a className="nav-tab" href="#module-chat">
            Chat
          </a>
          <a className="nav-tab" href="#module-history">
            History
          </a>
          <a className="nav-tab" href="#module-connection">
            API Settings
          </a>
          <a className="nav-tab" href="#module-help">
            Help
          </a>
          <span className="nav-note">Your page, your modules, your Gemini.</span>
        </div>
      </nav>
    </>
  );
}
