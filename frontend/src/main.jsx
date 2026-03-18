import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

console.log("Frontend JS loaded!");
window.addEventListener("error", (e) => console.log("Global error:", e.message));
window.addEventListener("unhandledrejection", (e) => console.log("Promise error:", e.reason));


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
