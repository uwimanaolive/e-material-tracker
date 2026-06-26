import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <h1>Something went wrong</h1>
          <p style={{ color: "#666" }}>{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("currentUser");
              localStorage.removeItem("token");
              window.location.href = "/login";
            }}
            style={{ marginTop: 12, padding: "8px 16px", cursor: "pointer" }}
          >
            Clear session and go to login
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
