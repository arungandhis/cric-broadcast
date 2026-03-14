export function CommentaryBar({ text }) {
  return (
    <div style={{
      position: "absolute",
      bottom: 20,
      left: 0,
      right: 0,
      padding: 20,
      background: "rgba(0,0,0,0.7)",
      color: "white",
      textAlign: "center",
      fontSize: 18
    }}>
      {text}
    </div>
  );
}
