import React, { useRef, useEffect, useState } from "react";

export default function OvercookScene({ staticInfo, frame }) {
  const gridSize = 80;
  const { grid, width, height } = staticInfo;

  // 애니메이션용 이전 프레임
  const prevFrameRef = useRef(frame);

  // 로직용 이전 프레임, fake object 계산용
  const prevLogicFrameRef = useRef(frame);

  const [interpProgress, setInterpProgress] = useState(1);

  // soup 조리 시작 시점 저장
  const cookingRef = useRef({});

  // 가짜 오브젝트 onion soup 내려놓기 연출용
  const fakeObjectsRef = useRef([]);

  // 배달 누적 카운트
  const [deliveredCount, setDeliveredCount] = useState(0);
  const prevScoreRef = useRef(frame.score ?? 0);

  // 디버그용
  useEffect(() => {
    console.log(
      "timestep",
      frame.timestep,
      "score",
      frame.score,
      "objects",
      frame.objects.map((o) => ({
        name: o.name,
        x: o.position.x,
        y: o.position.y,
      }))
    );
  }, [frame]);

  // 플레이어 앞 방향 오프셋
  const dirOffset = {
    north: { dx: 0, dy: -1 },
    south: { dx: 0, dy: 1 },
    west: { dx: -1, dy: 0 },
    east: { dx: 1, dy: 0 },
  };

  // fake object 업데이트  로직용 이전 프레임 사용
  useEffect(() => {
    // 에피소드 첫 프레임이면 이전 정보 리셋하고 종료
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

            // 오븐 P 와 배달대 S 위에는 fake object 만들지 않기
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
          const ori = player.orientation || prevPlayer.orientation || "south";
          const { dx, dy } = dirOffset[ori] || { dx: 0, dy: 0 };

          const tx = player.position.x + dx;
          const ty = player.position.y + dy;

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

    // 3 환경에서 실제 object가 생긴 경우 그 위치의 fake object 제거
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
    // 이번 프레임을 로직용 이전 프레임으로 저장
    prevLogicFrameRef.current = frame;
  }, [frame, grid, width, height]);

  // 보간 애니메이션  이쪽은 기존처럼 prevFrameRef 사용
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

  // 프레임 바뀔 때 soup 조리 상태 갱신
  useEffect(() => {
    const map = { ...cookingRef.current };

    frame.objects.forEach((obj) => {
      if (obj.name !== "soup") return;

      const key = `${obj.position.x} ${obj.position.y}`;
      const isCooking = obj.isCooking && !obj.isReady;

      if (isCooking) {
        if (!map[key]) {
          map[key] = { startedAt: frame.timestep };
        }
      } else {
        delete map[key];
      }
    });

    cookingRef.current = map;
  }, [frame]);

  const lerp = (a, b, t) => a + (b - a) * t;

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
    X: "/assets/tiles/tile_2.png",
    " ": "/assets/tiles/tile_0.png",
    P: "/assets/tiles/tile_oven.png",
    S: "/assets/tiles/tile_finish.png",
    O: "/assets/tiles/tile_onion3.png",
    D: "/assets/tiles/tile_dish7.png",
  };

  const objectMap = {
    onion: "/assets/tiles/tile_onion.png",
    tomato: "/assets/tiles/tile_oven.png",
    soup: "/assets/tiles/tile_soup.png",
    dish: "/assets/tiles/tile_dish.png",
  };

  const ovenSprites = {
    0: "/assets/tiles/tile_oven.png",
    1: "/assets/tiles/tile_oven_1.png",
    2: "/assets/tiles/tile_oven_2.png",
    3: "/assets/tiles/tile_oven_3.png",
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

  const renderTile = (cell, x, y) => {
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
  };

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

    const totalCookTime = staticInfo.cookTime ?? 20;
    let remainingTime = null;

    if (obj.name === "soup") {
      const isFakeSoup =
        obj.isCooking === undefined &&
        obj.isReady === undefined &&
        obj.numIngredients === undefined &&
        !Array.isArray(obj.ingredients);

      if (isFakeSoup) {
        sprite = "/assets/tiles/tile_soup.png";
      } else {
        const count =
          obj.numIngredients ?? obj.ingredients?.length ?? 0;

        const onionCount = Math.max(0, Math.min(3, count));

        if (obj.isReady) {
          sprite = "/assets/tiles/tile_soup.png";
        } else {
          sprite = ovenSprites[onionCount];
        }

        const key = `${x} ${y}`;
        const state = cookingRef.current[key];

        if (obj.isCooking && !obj.isReady && state) {
          const elapsed = frame.timestep - state.startedAt;
          const left = totalCookTime - elapsed;
          remainingTime = Math.max(0, left);
        }
      }
    }

    const cooking = obj.name === "soup" && obj.isCooking && !obj.isReady;
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

        {cooking && (
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
            {remainingTime !== null && (
              <rect
                x={x * gridSize + 20}
                y={barY}
                width={40 * (1 - remainingTime / totalCookTime)}
                height={6}
                rx={3}
                fill="#ffffff"
                opacity={0.9}
              />
            )}
          </>
        )}

        {cooking && remainingTime !== null && (
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

  const combinedObjects = [...frame.objects, ...fakeObjectsRef.current];

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
      {grid.map((row, y) => row.map((cell, x) => renderTile(cell, x, y)))}

      {combinedObjects.map((o, i) => renderObject(o, i))}

      {frame.players.map((p, i) => renderPlayer(p, i))}

      <g transform="translate(10, 10)">
        <rect
          x={0}
          y={0}
          width={130}
          height={36}
          rx={10}
          ry={10}
          fill="rgba(0,0,0,0.6)"
          stroke="#ffffff"
          strokeWidth={2}
        />
        <text
          x={65}
          y={22}
          textAnchor="middle"
          fontSize="14"
          fontFamily="monospace"
          fill="#ffffff"
        >
          Delivered {deliveredCount}
        </text>
      </g>
    </svg>
  );
}
