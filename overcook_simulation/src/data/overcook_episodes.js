// src/data/overcook_episodes.js

// x, y 스왑 함수  (trajectory: x=row, y=col → viewer: x=col, y=row)
export function swapPos(pos) {
  if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") {
    return pos;
  }
  return { x: pos.y, y: pos.x };
}

// 업로드된 trajectory 포맷을 viewer 포맷으로 통일
// 지원 포맷
// 1) { staticInfo, dynamicState: [...] }
// 2) { staticInfo, frames: [...] }
export function adaptEpisode(raw, fileName = "unknown") {
  const staticInfo = raw.staticInfo;

  const rawFrames =
    Array.isArray(raw.dynamicState) && raw.dynamicState.length > 0
      ? raw.dynamicState
      : Array.isArray(raw.frames)
      ? raw.frames
      : [];

  if (!staticInfo || rawFrames.length === 0) {
    console.warn(
      `[overcook_episodes] Unexpected format in ${fileName}. ` +
        "Expected { staticInfo, dynamicState[] } or { staticInfo, frames[] }."
    );
  }

  // 여기서 200 timestep만 사용하도록 slice 적용
  const frames = rawFrames.slice(0, 80).map((state) => ({
    ...state,
    players: (state.players || []).map((p) => ({
      ...p,
      position: swapPos(p.position),
      heldObject:
        p.heldObject && p.heldObject.position
          ? { ...p.heldObject, position: swapPos(p.heldObject.position) }
          : p.heldObject,
    })),
    objects: (state.objects || []).map((o) => ({
      ...o,
      position: o.position ? swapPos(o.position) : o.position,
    })),
  }));

  return {
    staticInfo,
    frames,
  };
}
