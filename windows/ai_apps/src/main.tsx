import { createRoot } from "react-dom/client";
import App from "./App";
import { applyThemeToDocument, loadTheme } from "./lib/theme";
import "./styles.css";
import "./themes/shared.css";
import "./themes/messenger.css";
import "./themes/assistant.css";

applyThemeToDocument(loadTheme());

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root was not found");
}

createRoot(container).render(<App />);
