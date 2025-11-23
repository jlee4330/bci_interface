import React, { useRef, useEffect, useState } from "react";

export default function OvercookScene({ staticInfo, frame }) {
  const gridSize = 80;
  const { grid, width, height } = staticInfo;

  const prevFrameRef = useRef(frame);
  const [interpProgress, setInterpProgress] = useState(1); // 0~1 사이 값

  // 프레임 변경 시마다 보간 애니메이션 시작
  useEffect(() => {
    setInterpProgress(0);
    const start = performance.now();

    const animate = (now) => {
      const t = Math.min((now - start) / 150, 1); // 150ms 동안 보간
      setInterpProgress(t);
      if (t < 1) requestAnimationFrame(animate);
      else prevFrameRef.current = frame; // 완료 시 현재 프레임을 prev로 저장
    };

    requestAnimationFrame(animate);
  }, [frame]);

  const lerp = (a, b, t) => a + (b - a) * t;

  // 🎨 타일 매핑
  const tileMap = {
    X: "/assets/tiles/tile_2.png",
    " ": "/assets/tiles/tile_0.png",
    P: "/assets/tiles/tile_8.png",
    S: "/assets/tiles/tile_10.png",
    O: "/assets/tiles/tile_9.png",
    D: "/assets/tiles/tile_11.png",
  };

  const objectMap = {
    onion: "/assets/tiles/tile_8.png",
    tomato: "/assets/tiles/tile_9.png",
    soup: "/assets/tiles/tile_10.png",
    dish: "/assets/tiles/tile_15.png",
  };

  const playerSprites = [
    "/assets/tiles/tile_agent1.png",
    "/assets/tiles/tile_agent2.png",
  ];

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

  const renderObject = (obj, i) => {
    const { x, y } = obj.position;
    const sprite = objectMap[obj.name] || "/assets/tiles/tile_15.png";
    const cooking = obj.isCooking && !obj.isReady;
    const ready = obj.isReady;

    return (
      <g key={`obj-${i}`}>
        <image
          href={sprite}
          x={x * gridSize + 10}
          y={y * gridSize + 10}
          width={gridSize * 0.8}
          height={gridSize * 0.8}
          opacity={ready ? 1 : 0.85}
          filter={cooking ? "brightness(1.3)" : "none"}
        />
        {cooking && (
          <rect
            x={x * gridSize + 25}
            y={y * gridSize - 5}
            width={30}
            height={6}
            rx={3}
            fill="#ff5555"
            opacity={0.8}
          />
        )}
      </g>
    );
  };

  const renderPlayer = (player, index) => {
    const prevPlayer = prevFrameRef.current.players[index];
    const { x, y } = player.position;
    const prevX = prevPlayer?.position.x ?? x;
    const prevY = prevPlayer?.position.y ?? y;

    // ✨ 보간 위치 계산
    const interpX = lerp(prevX, x, interpProgress);
    const interpY = lerp(prevY, y, interpProgress);

    const scale = 1.0;
    const offset = (gridSize * (scale - 1)) / 2;
    const sprite = playerSprites[index % playerSprites.length];

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
            width={gridSize * 0.4}
            height={gridSize * 0.4}
            x={gridSize * 0.3}
            y={-gridSize * 0.3}
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
