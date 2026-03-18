import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// 🔥 GLOBAL ERROR CATCHER (works on mobile)
window.onerror = function (msg, url, line, col, error) {
  alert("Runtime Error: " + msg);
};

// 🔥 SIMPLE ERROR BOUNDARY (catches React render crashes)
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: "red", fontSize: 18 }}>
          <h2>App crashed</h2>
          <p>{String(this.state.error)}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
