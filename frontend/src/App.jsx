import React from "react";
import SceneRoot from "./three/SceneRoot";

export default function App() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "black",
        overflow: "hidden",
      }}
    >
      <SceneRoot />
    </div>
  );
}
