import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("RootErrorBoundary caught:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "monospace", color: "#b91c1c", background: "#fef2f2", minHeight: "100vh" }}>
          <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>React Render Error</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, background: "#fee2e2", padding: 12, borderRadius: 8 }}>
            {this.state.error.stack || this.state.error.message}
          </pre>
          {this.state.errorInfo && (
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 12, color: "#7f1d1d" }}>
              {this.state.errorInfo.componentStack}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: "8px 16px", background: "#b91c1c", color: "white", borderRadius: 6, border: "none", cursor: "pointer" }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Global unhandled error handler
window.addEventListener("error", (event) => {
  console.error("Global window error:", event.error || event.message);
  const root = document.getElementById("root");
  if (root && root.children.length === 0) {
    root.innerHTML = `
      <div style="padding: 24px; font-family: monospace; color: #b91c1c; background: #fef2f2; min-height: 100vh;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">Window Error</h2>
        <pre style="white-space: pre-wrap; font-size: 13px; background: #fee2e2; padding: 12px; border-radius: 8px;">${
          event.error?.stack || event.message || "Unknown error"
        }</pre>
        <button onclick="window.location.reload()" style="margin-top: 16px; padding: 8px 16px; background: #b91c1c; color: white; border-radius: 6px; border: none; cursor: pointer;">
          Reload App
        </button>
      </div>
    `;
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
