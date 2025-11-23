// src/data/overcook_episodes.js

// Vite 전용: 폴더 안 json 전부 한 번에 import
const rawRandom0 = import.meta.glob("./random0_medium/*.json", { eager: true });
const rawRandom1 = import.meta.glob("./random1/*.json", { eager: true });
const rawRandom3 = import.meta.glob("./random3/*.json", { eager: true });
const rawSmallCorridor = import.meta.glob("./small_corridor/*.json", {
  eager: true,
});

// Vite 모듈에서 실제 데이터만 꺼내기
function normalizeModule(mod) {
  return mod && typeof mod === "object" && "default" in mod ? mod.default : mod;
}

// x,y 스왑 함수  (trajectory: x=row, y=col  → viewer: x=col, y=row)
function swapPos(pos) {
  if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") {
    return pos;
  }
  return { x: pos.y, y: pos.x };
}

// trajectory 포맷을 viewer 포맷으로 통일
// 지원 포맷
// 1) { staticInfo, dynamicState: [...] }
// 2) { staticInfo, frames: [...] }
function adaptEpisode(raw, fileName = "unknown") {
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

  // 여기서 플레이어/오브젝트 좌표만 x,y 스왑해서 viewer 포맷으로 변환
  const frames = rawFrames.map((state) => ({
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

// glob 결과 → [{ fileName, staticInfo, frames }, ...]
function makeEpisodeArray(globResult) {
  return Object.entries(globResult).map(([path, mod]) => {
    const raw = normalizeModule(mod);
    const fileName = path.split("/").pop();
    const episode = adaptEpisode(raw, fileName);

    return {
      fileName,
      ...episode,
    };
  });
}

export const ROUNDS = [
  {
    id: 1,
    label: "random0_medium",
    episodes: makeEpisodeArray(rawRandom0),
  },
  {
    id: 2,
    label: "random1",
    episodes: makeEpisodeArray(rawRandom1),
  },
  {
    id: 3,
    label: "random3",
    episodes: makeEpisodeArray(rawRandom3),
  },
  {
    id: 4,
    label: "small_corridor",
    episodes: makeEpisodeArray(rawSmallCorridor),
  },
];
