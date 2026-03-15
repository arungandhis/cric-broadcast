import { SceneRoot } from "./three/SceneRoot";

export default function App() {
  return (
    <>
      <button
        onClick={async () => {
          await fetch("https://cric-broadcast-backed.onrender.com/run-match", {
            method: "POST"
          });
        }}
        style={{
          padding: "12px 20px",
          fontSize: "18px",
          borderRadius: "8px",
          background: "#007bff",
          color: "white",
          border: "none",
          marginBottom: "20px",
          position: "absolute",
          top: "20px",
          left: "20px",
          zIndex: 10
        }}
      >
        ▶ Start Match
      </button>

      <SceneRoot />
    </>
  );
}
