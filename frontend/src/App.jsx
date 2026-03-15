import { SceneRoot } from "./three/SceneRoot";

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
    marginBottom: "20px"
  }}
>
  ▶ Start Match
</button>



export default function App() {
  return <SceneRoot />;
}
