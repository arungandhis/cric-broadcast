export function ScoreBug({ score }) {
  return (
    <div style={{
      position: "absolute",
      top: 20,
      left: 20,
      padding: "10px 20px",
      background: "rgba(0,0,0,0.6)",
      color: "white",
      borderRadius: 8,
      fontSize: 20
    }}>
      {score.runs}/{score.wickets} ({score.overs})
    </div>
  );
}
