import React, { useRef, useEffect, useState } from "react";

export default function OvercookScene({ staticInfo, frame }) {
  const gridSize = 80;
  const { grid, width, height } = staticInfo;

  const prevFrameRef = useRef(frame);
  const [interpProgress, setInterpProgress] = useState(1);

  // soup 조리 시작 시점 저장
  const cookingRef = useRef({});

  // 디버그용 로그
  useEffect(() => {
    console.log(
      "timestep",
      frame.timestep,
      "objects",
      frame.objects.map((o) => ({
        name: o.name,
        x: o.position.x,
        y: o.position.y,
      }))
    );
  }, [frame]);

  // 보간 애니메이션
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

  // 바닥 타일
  const tileMap = {
    X: "/assets/tiles/tile_2.png",
    " ": "/assets/tiles/tile_0.png",
    P: "/assets/tiles/tile_oven.png",
    S: "/assets/tiles/tile_finish.png",
    O: "/assets/tiles/tile_onion3.png",
    D: "/assets/tiles/tile_dish7.png",
  };

  // 기본 오브젝트 스프라이트
  const objectMap = {
    onion: "/assets/tiles/tile_onion.png",
    tomato: "/assets/tiles/tile_oven.png",
    soup: "/assets/tiles/tile_soup.png",
    dish: "/assets/tiles/tile_dish.png",
  };

  // 오븐 상태별 스프라이트
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

  // 이 오브젝트가 플레이어에게 들려 있는지 체크
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
    // 플레이어가 들고 있는 오브젝트면 바닥에 렌더하지 않음
    if (isHeldByPlayer(obj)) {
      return null;
    }

    const { x, y } = obj.position;
    let sprite = objectMap[obj.name] || "/assets/tiles/tile_15.png";

    const totalCookTime = staticInfo.cookTime ?? 20;
    let remainingTime = null;

    if (obj.name === "soup") {
      const count =
        obj.numIngredients ??
        obj.ingredients?.length ??
        0;

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

    const cooking = obj.isCooking && !obj.isReady;
    const ready = obj.isReady;

    // 오븐 타이머 바 위치를 좀 더 아래로
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
            {/* 전체 빨간 바 */}
            <rect
              x={x * gridSize + 20}
              y={barY}
              width={40}
              height={6}
              rx={3}
              fill="#ff5555"
              opacity={0.85}
            />
            {/* 흰색 진행 바 */}
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
      {frame.objects.map((o, i) => renderObject(o, i))}
      {frame.players.map((p, i) => renderPlayer(p, i))}
    </svg>
  );
}
