import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { useMatchEvents } from "./useMatchEvents";
import { ScoreBug } from "../ui/ScoreBug";
import { CommentaryBar } from "../ui/CommentaryBar";

export function SceneRoot() {
  const [event, setEvent] = useState(null);

  useMatchEvents((e) => setEvent(e));

  return (
    <>
      <Canvas camera={{ position: [0, 10, 25], fov: 45 }}>
        <mesh position={[0, -1, 0]}>
          <boxGeometry args={[20, 0.5, 20]} />
          <meshStandardMaterial color="green" />
        </mesh>
      </Canvas>

      {event && (
        <>
          <ScoreBug score={event.score} />
          <CommentaryBar text={event.commentary} />
        </>
      )}
    </>
  );
}
