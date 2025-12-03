import React, { useRef, useEffect, useState, useMemo } from "react";

export default function OvercookScene({ staticInfo, frame, frames, isReplaying }) {
  const gridSize = 80;
  const { grid, width, height } = staticInfo;

  // 애니메이션용 이전 프레임
  const prevFrameRef = useRef(frame);

  // 로직용 이전 프레임 fake object 계산용
  const prevLogicFrameRef = useRef(frame);

  const [interpProgress, setInterpProgress] = useState(1);

  // 가짜 오브젝트 onion / soup 내려놓기 연출용
  const fakeObjectsRef = useRef([]);

  // 배달 누적 카운트
  const [deliveredCount, setDeliveredCount] = useState(0);
  const prevScoreRef = useRef(frame.score ?? 0);

  // 디버그용 로그  필요할 때만 켜기
  useEffect(() => {
    // if (frame.timestep % 10 === 0) {
    //   console.log("timestep", frame.timestep, "score", frame.score);
    // }
  }, [frame]);

  // 플레이어 앞 방향 오프셋
  const dirOffset = {
    north: { dx: 0, dy: -1 },
    south: { dx: 0, dy: 1 },
    west: { dx: -1, dy: 0 },
    east: { dx: 1, dy: 0 },
  };

  // 리플레이로 들어갈 때 fake object만 초기화 (타이머는 순수 계산으로 처리)
  useEffect(() => {
    if (isReplaying) {
      fakeObjectsRef.current = [];
      prevLogicFrameRef.current = frame;
    }
  }, [isReplaying, frame]);

  // fake object 업데이트
  useEffect(() => {
    // 리플레이 중에는 fake object 로직 자체를 멈춤
    if (isReplaying) return;

    // 에피소드 첫 프레임이면 리셋
    if (frame.timestep === 0) {
      fakeObjectsRef.current = [];
      prevLogicFrameRef.current = frame;
      return;
    }

    const prevFrame = prevLogicFrameRef.current;
    if (!prevFrame) {
      prevLogicFrameRef.current = frame;
      return;
    }

    let currentFake = [...fakeObjectsRef.current];

    frame.players.forEach((player, idx) => {
      const prevPlayer = prevFrame.players?.[idx];
      if (!prevPlayer) return;

      const prevHeld = prevPlayer.heldObject;
      const curHeld = player.heldObject;

      // 1 내려놓기  이전에는 들고 있었는데 지금은 안 들고 있음
      if (prevHeld && !curHeld) {
        const name = prevHeld.name;
        if (name === "onion" || name === "soup") {
          const ori = prevPlayer.orientation || "south";
          const { dx, dy } = dirOffset[ori] || { dx: 0, dy: 0 };

          const tx = prevPlayer.position.x + dx;
          const ty = prevPlayer.position.y + dy;

          if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
            const cell = grid[ty][tx];

            // 오븐 P 배달대 S 위에는 fake object 만들지 않음
            if (cell !== "P" && cell !== "S") {
              currentFake.push({
                id: `fake-${Date.now()}-${idx}-${name}`,
                name,
                position: { x: tx, y: ty },
              });
            }
          }
        }
      }

      // 2 집기  이전에는 없었는데 지금은 들고 있음
      if (!prevHeld && curHeld) {
        const name = curHeld.name;
        if (name === "onion" || name === "soup") {
          const ori = prevPlayer.orientation || player.orientation || "south";
          const { dx, dy } = dirOffset[ori] || { dx: 0, dy: 0 };

          const tx = prevPlayer.position.x + dx;
          const ty = prevPlayer.position.y + dy;

          const idxFake = currentFake.findIndex(
            (fo) =>
              fo.name === name &&
              fo.position.x === tx &&
              fo.position.y === ty
          );
          if (idxFake !== -1) {
            currentFake.splice(idxFake, 1);
          }
        }
      }
    });

    // 3 실제 object가 생긴 위치의 fake object 제거
    const realObjects = frame.objects || [];
    currentFake = currentFake.filter(
      (fo) =>
        !realObjects.some(
          (ro) =>
            ro.name === fo.name &&
            ro.position.x === fo.position.x &&
            ro.position.y === fo.position.y
        )
    );

    fakeObjectsRef.current = currentFake;
    prevLogicFrameRef.current = frame;
  }, [frame, grid, width, height, isReplaying]);

  // 리플레이용 fake object 재계산
  const replayFakeObjects = useMemo(() => {
    if (!isReplaying || !frames || !Array.isArray(frames) || !frame) return [];

    const currentTimestep = frame.timestep ?? 0;
    let currentFake = [];

    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const t = f.timestep ?? 0;

      // 현재 프레임 이후는 볼 필요 없음
      if (t > currentTimestep) break;

      // 에피소드 리셋 지점
      if (t === 0) {
        currentFake = [];
      }

      const prevFrame = i > 0 ? frames[i - 1] : null;
      if (!prevFrame) continue;

      f.players.forEach((player, idx) => {
        const prevPlayer = prevFrame.players?.[idx];
        if (!prevPlayer) return;

        const prevHeld = prevPlayer.heldObject;
        const curHeld = player.heldObject;

        // 1 내려놓기
        if (prevHeld && !curHeld) {
          const name = prevHeld.name;
          if (name === "onion" || name === "soup") {
            const ori = prevPlayer.orientation || "south";
            const { dx, dy } = dirOffset[ori] || { dx: 0, dy: 0 };

            const tx = prevPlayer.position.x + dx;
            const ty = prevPlayer.position.y + dy;

            if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
              const cell = grid[ty][tx];

              if (cell !== "P" && cell !== "S") {
                currentFake.push({
                  id: `replay-fake-${t}-${idx}-${name}`,
                  name,
                  position: { x: tx, y: ty },
                });
              }
            }
          }
        }

        // 2 집기
        if (!prevHeld && curHeld) {
          const name = curHeld.name;
          if (name === "onion" || name === "soup") {
            const ori = prevPlayer.orientation || player.orientation || "south";
            const { dx, dy } = dirOffset[ori] || { dx: 0, dy: 0 };

            const tx = prevPlayer.position.x + dx;
            const ty = prevPlayer.position.y + dy;

            const idxFake = currentFake.findIndex(
              (fo) =>
                fo.name === name &&
                fo.position.x === tx &&
                fo.position.y === ty
            );
            if (idxFake !== -1) {
              currentFake.splice(idxFake, 1);
            }
          }
        }
      });

      // 3 실제 object가 생긴 위치의 fake object 제거
      const realObjects = f.objects || [];
      currentFake = currentFake.filter(
        (fo) =>
          !realObjects.some(
            (ro) =>
              ro.name === fo.name &&
              ro.position.x === fo.position.x &&
              ro.position.y === fo.position.y
          )
      );
    }

    return currentFake;
  }, [isReplaying, frames, frame, grid, width, height]);

  // 포지션 보간 애니메이션
  useEffect(() => {
    const start = performance.now();
    setInterpProgress(0);

    const animate = (now) => {
      const t = Math.min((now - start) / 150, 1);
      setInterpProgress(t);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        prevFrameRef.current = frame;
      }
    };

    requestAnimationFrame(animate);
  }, [frame]);

  const lerp = (a, b, t) => a + (b - a) * t;

  // 🔥 핵심: 현재 frame 기준 각 오븐 위치의 soup 남은 시간 계산
  const cookingRemainingByKey = useMemo(() => {
    if (!frames || !Array.isArray(frames) || !frame) return {};

    const cookTimeDefault = staticInfo.cookTime ?? 20;
    const currentTimestep = frame.timestep ?? 0;

    const state = {};
    const remainingByKey = {};

    for (const f of frames) {
      const t = f.timestep ?? 0;
      if (t > currentTimestep) continue;

      const objs = f.objects || [];
      objs.forEach((obj) => {
        if (obj.name !== "soup") return;

        const isFakeSoup =
          obj.isCooking === undefined &&
          obj.isReady === undefined &&
          obj.numIngredients === undefined &&
          !Array.isArray(obj.ingredients);

        if (isFakeSoup) {
          return;
        }

        const count = obj.numIngredients ?? obj.ingredients?.length ?? 0;
        const onionCount = Math.max(0, Math.min(3, count));
        const key = `${obj.position.x} ${obj.position.y}`;

        const totalCookTime = obj.cookTime ?? cookTimeDefault;

        const logicalCooking = !obj.isReady && onionCount >= 3;
        const logicalReady = obj.isReady && onionCount >= 3;

        if (logicalCooking) {
          if (!state[key]) {
            state[key] = { startedAt: t };
          }
          const elapsed = t - state[key].startedAt;
          const clampedElapsed = Math.max(0, Math.min(totalCookTime, elapsed));
          const left = totalCookTime - clampedElapsed;

          remainingByKey[key] = left;
        } else {
          delete state[key];

          if (logicalReady) {
            remainingByKey[key] = 0;
          }
        }
      });
    }

    return remainingByKey;
  }, [frames, frame, staticInfo.cookTime]);

  // 배달 카운트 업데이트
  useEffect(() => {
    const reward = staticInfo.deliveryReward ?? 20;
    const prevScore = prevScoreRef.current ?? 0;
    const curScore = frame.score ?? 0;

    if (frame.timestep === 0) {
      setDeliveredCount(0);
      prevScoreRef.current = curScore;
      return;
    }

    const diff = curScore - prevScore;

    if (diff >= reward && reward > 0) {
      const deliveredNow = Math.floor(diff / reward);
      if (deliveredNow > 0) {
        setDeliveredCount((c) => c + deliveredNow);
      }
    }

    prevScoreRef.current = curScore;
  }, [frame, staticInfo.deliveryReward]);

  // 바닥 타일
  const tileMap = {
    X: "/assets/tiles/tile_a.png",
    " ": "/assets/tiles/tile_b.png",
    P: "/assets/tiles/Group 13.png",
    S: "/assets/tiles/deliver.png",
    O: "/assets/tiles/onionn.png",
    D: "/assets/tiles/dishh.png",
  };

  const objectMap = {
    onion: "/assets/tiles/tile_onion.png",
    tomato: "/assets/tiles/tile_oven.png",
    soup: "/assets/tiles/tile_soup.png",
    dish: "/assets/tiles/tile_dish.png",
  };

  const ovenSprites = {
    0: "/assets/tiles/tile_oven.png",
    1: "/assets/tiles/Group 9.png",
    2: "/assets/tiles/Group 10.png",
    3: "/assets/tiles/Group 11.png",
  };

  const playerSpriteMap = {
    0: {
      north: "/assets/tiles/tile_agent0_north.png",
      south: "/assets/tiles/tile_agent0_south.png",
      west: "/assets/tiles/tile_agent0_west.png",
      east: "/assets/tiles/tile_agent0_east.png",
    },
    1: {
      north: "/assets/tiles/tile_agent1_north.png",
      south: "/assets/tiles/tile_agent1_south.png",
      west: "/assets/tiles/tile_agent1_west.png",
      east: "/assets/tiles/tile_agent1_east.png",
    },
  };

  // grid는 static이라 메모이제이션
  const backgroundTiles = useMemo(
    () =>
      grid.map((row, y) =>
        row.map((cell, x) => {
          const tile = tileMap[cell] || tileMap[" "];
          return (
            <image
              key={`${x}-${y}`}
              href={tile}
              x={x * gridSize}
              y={y * gridSize}
              width={gridSize}
              height={gridSize}
            />
          );
        })
      ),
    [grid]
  );

  const isHeldByPlayer = (obj) => {
    return frame.players.some((p) => {
      const h = p.heldObject;
      if (!h) return false;
      return (
        h.name === obj.name &&
        h.position?.x === obj.position.x &&
        h.position?.y === obj.position.y
      );
    });
  };

  const renderObject = (obj, i) => {
    if (isHeldByPlayer(obj)) {
      return null;
    }

    const { x, y } = obj.position;
    const cell = grid[y]?.[x];
    if (cell === "S") {
      return null;
    }

    let sprite = objectMap[obj.name] || "/assets/tiles/tile_15.png";

    // 타이머 관련 변수
    let remainingTime = null;
    let cooking = false;
    let cookTotalForBar = staticInfo.cookTime ?? 20;

    if (obj.name === "soup") {
      const isFakeSoup =
        obj.isCooking === undefined &&
        obj.isReady === undefined &&
        obj.numIngredients === undefined &&
        !Array.isArray(obj.ingredients);

      if (isFakeSoup) {
        sprite = "/assets/tiles/tile_soup.png";
      } else {
        const count = obj.numIngredients ?? obj.ingredients?.length ?? 0;
        const onionCount = Math.max(0, Math.min(3, count));

        const totalCookTime = obj.cookTime ?? staticInfo.cookTime ?? 20;
        cookTotalForBar = totalCookTime;

        const logicalCooking = !obj.isReady && onionCount >= 3;
        const logicalReady = obj.isReady && onionCount >= 3;

        if (logicalReady) {
          sprite = "/assets/tiles/tile_soup.png";
        } else {
          sprite = ovenSprites[onionCount];
        }

        const key = `${x} ${y}`;
        const rem = cookingRemainingByKey[key];

        if (logicalCooking && typeof rem === "number") {
          remainingTime = rem;
          cooking = rem > 0;
        }
      }
    }

    const ready = obj.isReady;
    const barY = y * gridSize + 20;

    return (
      <g key={`obj-${i}`}>
        <image
          href={sprite}
          x={x * gridSize + 10}
          y={y * gridSize + 10}
          width={gridSize * 0.8}
          height={gridSize * 0.8}
          opacity={ready ? 1 : 0.85}
        />

        {cooking && remainingTime !== null && (
          <>
            <rect
              x={x * gridSize + 20}
              y={barY}
              width={40}
              height={6}
              rx={3}
              fill="#ff5555"
              opacity={0.85}
            />
            <rect
              x={x * gridSize + 20}
              y={barY}
              width={40 * (1 - remainingTime / cookTotalForBar)}
              height={6}
              rx={3}
              fill="#ffffff"
              opacity={0.9}
            />
            <text
              x={x * gridSize + gridSize / 2}
              y={barY - 4}
              textAnchor="middle"
              fontSize="12"
              fontFamily="monospace"
              fill="#ffffff"
            >
              {Math.ceil(remainingTime)}
            </text>
          </>
        )}
      </g>
    );
  };

  const renderPlayer = (player, index) => {
    const prevPlayer = prevFrameRef.current?.players?.[index] || player;

    const { x, y } = player.position;
    const prevX = prevPlayer.position?.x ?? x;
    const prevY = prevPlayer.position?.y ?? y;

    const interpX = lerp(prevX, x, interpProgress);
    const interpY = lerp(prevY, y, interpProgress);

    const scale = 1.0;
    const offset = (gridSize * (scale - 1)) / 2;

    const isInitialFrame = frame.timestep === 0;
    const rawOrientation = player.orientation || "south";
    const orientation = isInitialFrame ? "south" : rawOrientation;

    const spriteSet =
      playerSpriteMap[player.id] ||
      playerSpriteMap[index] ||
      playerSpriteMap[0];

    const sprite = spriteSet[orientation] || spriteSet.south;

    const held = player.heldObject?.name;
    const heldSprite = held ? objectMap[held] : null;

    return (
      <g
        key={player.id}
        transform={`translate(${interpX * gridSize - offset}, ${
          interpY * gridSize - offset
        }) scale(${scale})`}
      >
        <image href={sprite} width={gridSize} height={gridSize} />
        {heldSprite && (
          <image
            href={heldSprite}
            width={gridSize * 0.45}
            height={gridSize * 0.45}
            x={gridSize * 0.28}
            y={gridSize * 0.35}
          />
        )}
      </g>
    );
  };

  // 리플레이일 때도 재계산된 fake object 포함
  const combinedObjects = isReplaying
    ? [...frame.objects, ...replayFakeObjects]
    : [...frame.objects, ...fakeObjectsRef.current];

  return (
    <svg
      width={width * gridSize}
      height={height * gridSize}
      style={{
        border: "2px solid #999",
        background: "#d6c7a1",
        borderRadius: "8px",
        imageRendering: "pixelated",
      }}
    >
      {/* 바닥 타일 */}
      {backgroundTiles}

      {/* 오브젝트 */}
      {combinedObjects.map((o, i) => renderObject(o, i))}

      {/* 플레이어 */}
      {frame.players.map((p, i) => renderPlayer(p, i))}

      {/* 배달 카운트  리플레이 아닐 때만 표시 */}
      {!isReplaying && (
        <g transform="translate(10, 10)">
          <rect
            x={0}
            y={0}
            width={90}
            height={26}
            rx={8}
            ry={8}
            fill="rgba(0,0,0,0.6)"
            stroke="#ffffff"
            strokeWidth={1.5}
          />
          <text
            x={45}
            y={17}
            textAnchor="middle"
            fontSize="10"
            fontFamily="monospace"
            fill="#ffffff"
          >
            Delivered {deliveredCount}
          </text>
        </g>
      )}
    </svg>
  );
}
