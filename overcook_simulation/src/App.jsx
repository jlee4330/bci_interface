import React, { useState, useEffect, useRef } from "react";
import OvercookScene from "./components/OvercookScene";
import { ROUNDS } from "./data/overcook_episodes";
import { Range } from "react-range";

const MIN_OFFSET = -20;
const MAX_OFFSET = 20;
const FRAME_DURATION = 0.3;

// 0: random0_medium, 1: random1, 2: random3, 3: small_corridor
const LAYOUT_ORDER = [0, 1, 2, 3, 0, 1, 2, 3];
const TOTAL_ROUNDS = 8;

// 초기 라운드용 trajectory 선택
function createInitialRoundState() {
  const layoutIdx = LAYOUT_ORDER[0];
  const eps = ROUNDS[layoutIdx].episodes;
  const ep = eps[Math.floor(Math.random() * eps.length)];
  const used = ROUNDS.map(() => []);
  used[layoutIdx] = [ep.fileName];
  return { initialEpisode: ep, initialUsed: used };
}

// 라운드별 trajectory 선택 (같은 폴더에서는 아직 안 쓴 파일 우선)
function pickEpisodeForRound(roundIndex, usedFilesByLayout) {
  const layoutIdx = LAYOUT_ORDER[roundIndex];
  const eps = ROUNDS[layoutIdx].episodes;
  const used = usedFilesByLayout[layoutIdx] || [];

  const candidates = eps.filter((ep) => !used.includes(ep.fileName));
  const list = candidates.length > 0 ? candidates : eps;

  const ep = list[Math.floor(Math.random() * list.length)];
  return { episode: ep, layoutIdx };
}

function baseTimeLabel(frame) {
  return `${(frame * FRAME_DURATION).toFixed(2)}s`;
}

const { initialEpisode, initialUsed } = createInitialRoundState();

export default function App() {
  const [roundIndex, setRoundIndex] = useState(0); // 0~7
  const [episode, setEpisode] = useState(initialEpisode);
  const [usedFilesByLayout, setUsedFilesByLayout] = useState(initialUsed);

  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState("full"); // "full" | "segment"
  const [elapsed, setElapsed] = useState(0); // 초 단위 경과 시간

  const [rawMarkers, setRawMarkers] = useState([]); // [frameIndex, ...]
  const [intervals, setIntervals] = useState([]); // [{ baseFrame, startOffset, endOffset, reason }, ...]
  const [selectedInterval, setSelectedInterval] = useState(null);
  const [locked, setLocked] = useState(true);

  const rafRef = useRef(null);
  const segmentEndFrameRef = useRef(null); // 구간 재생 끝 프레임

  const totalFrames = episode.frames.length;
  const frameDuration = FRAME_DURATION;
  const totalTime = totalFrames * frameDuration;
  const currentLayoutIdx = LAYOUT_ORDER[roundIndex];

  // 구간 재생 여부
  const isReplaying = playMode === "segment" && isPlaying;

  // 메인 재생 루프
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    // 이 effect가 시작될 때의 "기준 시점"을 로컬로 잡음
    const startTime = performance.now() - elapsed * 1000;

    const update = () => {
      const now = performance.now();
      const newElapsed = (now - startTime) / 1000;
      const newFrameIndex = Math.floor(newElapsed / frameDuration);

      // 구간 재생 모드
      if (playMode === "segment") {
        const endFrame = segmentEndFrameRef.current ?? totalFrames - 1;

        if (newFrameIndex >= endFrame) {
          setFrameIndex(endFrame);
          setElapsed(endFrame * frameDuration);
          setIsPlaying(false);
          return;
        }

        setFrameIndex(newFrameIndex);
        setElapsed(newElapsed);
        rafRef.current = requestAnimationFrame(update);
        return;
      }

      // 전체 재생 모드
      if (newFrameIndex < totalFrames) {
        setFrameIndex(newFrameIndex);
        setElapsed(newElapsed);
        rafRef.current = requestAnimationFrame(update);
      } else {
        setFrameIndex(totalFrames - 1);
        setElapsed(totalTime);
        setIsPlaying(false);
        setLocked(false);
      }
    };

    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, playMode, frameDuration, totalFrames, totalTime, elapsed]);

  // Space key → 현재 프레임 index 저장
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();

        const currentFrame = frameIndex;

        setRawMarkers((prev) => [...prev, currentFrame]);
        setIntervals((prev) => [
          ...prev,
          {
            baseFrame: currentFrame,
            startOffset: -2,
            endOffset: 2,
            reason: "",
          },
        ]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [frameIndex]);

  // 선택한 interval만 재생
  const handleReplayFromBase = (intv) => {
    if (!intv) return;

    let startFrame = intv.baseFrame + intv.startOffset;
    let endFrame = intv.baseFrame + intv.endOffset;

    startFrame = Math.max(startFrame, 0);
    endFrame = Math.min(endFrame, totalFrames - 1);

    if (startFrame > endFrame) {
      const tmp = startFrame;
      startFrame = endFrame;
      endFrame = tmp;
    }

    const startTime = startFrame * frameDuration;

    // 1) 현재 재생 완전히 정지
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);

    // 2) 구간 정보 세팅 후, 다음 프레임에서 다시 시작
    segmentEndFrameRef.current = endFrame;
    setPlayMode("segment");

    requestAnimationFrame(() => {
      setFrameIndex(startFrame);
      setElapsed(startTime);
      setIsPlaying(true);
    });
  };

  const togglePlay = () => {
    if (isPlaying) return;

    // 에피소드 끝까지 갔으면 다시 처음부터
    if (frameIndex >= totalFrames - 1) {
      setFrameIndex(0);
      setElapsed(0);
    }

    cancelAnimationFrame(rafRef.current);
    setPlayMode("full");
    setLocked(true);
    setIsPlaying(true);
  };

  // 같은 trajectory에서 완전 초기화
  const reset = () => {
    cancelAnimationFrame(rafRef.current);

    setIsPlaying(false);
    setPlayMode("full");
    segmentEndFrameRef.current = null;

    setElapsed(0);
    setFrameIndex(0);
    setRawMarkers([]);
    setIntervals([]);
    setSelectedInterval(null);
    setLocked(true);
  };

  // 다음 라운드
  const handleNextRound = () => {
    if (roundIndex >= TOTAL_ROUNDS - 1) return;

    const nextRoundIndex = roundIndex + 1;
    const { episode: nextEpisode, layoutIdx } = pickEpisodeForRound(
      nextRoundIndex,
      usedFilesByLayout
    );

    cancelAnimationFrame(rafRef.current);

    setIsPlaying(false);
    setPlayMode("full");
    segmentEndFrameRef.current = null;

    setRoundIndex(nextRoundIndex);
    setEpisode(nextEpisode);
    setUsedFilesByLayout((prev) => {
      const copy = prev.map((arr) => [...arr]);
      if (!copy[layoutIdx].includes(nextEpisode.fileName)) {
        copy[layoutIdx].push(nextEpisode.fileName);
      }
      return copy;
    });

    setElapsed(0);
    setFrameIndex(0);
    setRawMarkers([]);
    setIntervals([]);
    setSelectedInterval(null);
    setLocked(true);
  };

  // 오프셋 편집
  const handleOffsetEdit = (field, value) => {
    if (!selectedInterval) return;

    const intValue = parseInt(value, 10);
    if (Number.isNaN(intValue)) return;

    const updated = [...intervals];
    updated[selectedInterval.index][field] = intValue;
    setIntervals(updated);

    setSelectedInterval((prev) => ({
      ...prev,
      [field]: intValue,
    }));
  };

  // reason 편집
  const handleReasonChange = (value) => {
    if (!selectedInterval) return;

    const updated = [...intervals];
    updated[selectedInterval.index].reason = value;
    setIntervals(updated);

    setSelectedInterval((prev) => ({
      ...prev,
      reason: value,
    }));
  };

  const deleteInterval = (index) => {
    setIntervals((prev) => prev.filter((_, i) => i !== index));
    setRawMarkers((prev) => prev.filter((_, i) => i !== index));
    setSelectedInterval(null);
  };

  // JSON export helper
  const exportJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 최종 export
  const handleExport = () => {
    const realTimeData = rawMarkers.slice();

    const calibratedData = intervals.map((intv) => {
      const baseFrame = intv.baseFrame;
      let startFrame = baseFrame + intv.startOffset;
      let endFrame = baseFrame + intv.endOffset;

      startFrame = Math.max(0, Math.min(startFrame, totalFrames - 1));
      endFrame = Math.max(0, Math.min(endFrame, totalFrames - 1));

      if (startFrame > endFrame) {
        const tmp = startFrame;
        startFrame = endFrame;
        endFrame = tmp;
      }

      return [startFrame, endFrame];
    });

    const reasons = intervals.map((intv) => intv.reason || "");
    const layoutIdx = LAYOUT_ORDER[roundIndex];

    const payload = {
      round: roundIndex + 1,
      layout: ROUNDS[layoutIdx].label,
      fileName: episode.fileName,
      errorInfo: [
        {
          type: "real-time",
          data: realTimeData,
        },
        {
          type: "calibrated",
          data: calibratedData,
          reason: reasons,
        },
      ],
    };

    exportJSON(payload, "error_info.json");
  };

  const frame = episode.frames[Math.min(frameIndex, totalFrames - 1)];
  const progress = Math.min((elapsed / totalTime) * 100, 100);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "40px",
        padding: "30px",
        background: "linear-gradient(160deg, #0d0d0d 0%, #1b1b1b 100%)",
        color: "#f0f0f0",
        height: "100vh",
        width: "100vw",
        boxSizing: "border-box",
        overflowX: "hidden",
        overflowY: "auto",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Main viewer */}
          <div
          style={{
            textAlign: "center",
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "sticky",
            top: 0,
            height: "100vh",
          }}
        >



        <h2
          style={{
            color: "#ffffff",
            fontWeight: 600,
            marginBottom: "8px",
            letterSpacing: "0.5px",
          }}
        >
          Round {roundIndex + 1} / {TOTAL_ROUNDS} ·{" "}
          {ROUNDS[currentLayoutIdx].label}
        </h2>

        <div
          style={{
            fontSize: "0.9em",
            color: "#ccc",
            marginBottom: "10px",
          }}
        >
          Trajectory file: <code>{episode.fileName}</code>
        </div>

        <div
          style={{
            fontSize: "1.2em",
            color: "#ffd54f",
            marginBottom: "15px",
            background: "#222",
            padding: "6px 12px",
            display: "inline-block",
            borderRadius: "6px",
          }}
        >
          ⏱ {elapsed.toFixed(2)}s / {totalTime.toFixed(2)}s{" "}
          <span style={{ fontSize: "0.8em", marginLeft: "8px", color: "#aaa" }}>
            (frame {frameIndex} / {totalFrames - 1})
          </span>
        </div>

        {/* 에이전트 화면 크게 + scale */}
        <div
          style={{
            width: "100%",
            maxWidth: "1300px",
            height: "60vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              transform: "scale(1.2)",
              transformOrigin: "top center",
            }}
          >
            <OvercookScene
              staticInfo={episode.staticInfo}
              frame={frame}
              isReplaying={isReplaying}
            />
          </div>
        </div>

        {/* Raw timeline */}
        <div
          style={{
            width: "50%",
            margin: "18px auto 8px auto",
            position: "relative",
            background: "#181818",
            borderRadius: "6px",
            padding: "10px 10px",
          }}
        >
          <p
            style={{
              margin: "0 0 6px 0",
              textAlign: "left",
              color: "#bbb",
              fontWeight: 500,
              fontSize: "0.9em",
            }}
          >
            Raw Error Markers
          </p>
          <div
            style={{
              position: "relative",
              height: "8px",
              background: "#333",
              borderRadius: "6px",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: `${progress}%`,
                height: "8px",
                background: "linear-gradient(90deg, #807b7bff, #ffffffff)",
                borderRadius: "6px",
              }}
            />
            {rawMarkers.map((markerFrame, i) => {
              const pos =
                totalFrames > 1
                  ? (markerFrame / (totalFrames - 1)) * 100
                  : 0;
              return (
                <div
                  key={i}
                  onClick={() => handleReplayFromBase(intervals[i])}
                  title={`Replay around frame ${markerFrame} (${(
                    markerFrame * frameDuration
                  ).toFixed(2)}s)`}
                  style={{
                    position: "absolute",
                    left: `${pos}%`,
                    top: "-2px",
                    width: "6px",
                    height: "14px",
                    background:
                      selectedInterval?.index === i
                        ? "#ffd54f"
                        : "rgba(255,68,68,0.9)",
                    borderRadius: "2px",
                    transform: "translateX(-50%)",
                    cursor: "pointer",
                    boxShadow:
                      selectedInterval?.index === i
                        ? "0 0 8px rgba(255,213,79,0.8)"
                        : "0 0 4px rgba(255,255,255,0.5)",
                    transition: "all 0.15s ease",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div
          style={{
            marginTop: "18px",
            display: "flex",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          <button
            onClick={togglePlay}
            disabled={isPlaying}
            style={{
              padding: "12px 24px",
              background: "linear-gradient(90deg, #444, #444)",
              border: "none",
              borderRadius: "8px",
              color: isPlaying ? "#aaa" : "#000",
              fontWeight: 700,
              cursor: isPlaying ? "not-allowed" : "pointer",
              opacity: isPlaying ? 0.6 : 1,
              fontSize: "1em",
              transition: "all 0.3s ease",
            }}
          >
            {isPlaying ? "▶️ Playing..." : "▶️ Play"}
          </button>

          <button
            onClick={reset}
            style={{
              padding: "12px 20px",
              background: "#3b3939ff",
              borderRadius: "8px",
              color: "#ddd",
              fontWeight: 600,
              cursor: "pointer",
              transition: "0.3s",
            }}
          >
            🔁 Reset
          </button>

          <button
            onClick={handleNextRound}
            disabled={roundIndex >= TOTAL_ROUNDS - 1}
            style={{
              padding: "12px 20px",
              background:
                roundIndex >= TOTAL_ROUNDS - 1
                  ? "#222"
                  : "linear-gradient(90deg, #555, #777)",
              borderRadius: "8px",
              color: roundIndex >= TOTAL_ROUNDS - 1 ? "#666" : "#000",
              fontWeight: 600,
              cursor:
                roundIndex >= TOTAL_ROUNDS - 1 ? "not-allowed" : "pointer",
              transition: "0.3s",
            }}
          >
            ➡ Next Round
          </button>
        </div>

        {/* Export Button */}
        {!locked && (
          <div
            style={{
              marginTop: "18px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <button
              onClick={handleExport}
              style={{
                padding: "10px 24px",
                background: "linear-gradient(90deg, #555, #888)",
                border: "none",
                borderRadius: "8px",
                color: "#000",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📁 Export error_info.json
            </button>
          </div>
        )}
      </div>

      {/* Right Panel */}
      <div
  style={{
    width: "600px",
    flexShrink: 0,
    borderLeft: "2px solid #222",
    paddingLeft: "20px",
    textAlign: "center",
    opacity: locked ? 0.4 : 1,
    pointerEvents: locked ? "none" : "auto",
    transition: "opacity 0.3s ease",
    height: "100vh",
    overflowY: "auto",
  }}
>

        {locked ? (
          <div
            style={{
              background: "#1c1c1c",
              padding: "40px 20px",
              borderRadius: "8px",
              border: "1px solid #444",
              color: "#ccc",
              marginTop: "40px",
              boxShadow: "inset 0 0 15px rgba(0,0,0,0.3)",
            }}
          >
            <h3 style={{ color: "#ffd54f" }}>⚠️ Locked</h3>
            <p>
              Wait until the <strong>1 Round of Play</strong> finishes to edit
              intervals.
            </p>
          </div>
        ) : intervals.length === 0 ? (
          <p style={{ color: "#888" }}>No markers yet.</p>
        ) : (
          <div
            style={{
              maxHeight: "70vh",
              overflowY: "auto",
              textAlign: "left",
              paddingRight: "8px",
            }}
          >
            {intervals.map((intv, i) => {
              const isSelected = selectedInterval?.index === i;

              const baseFrame = intv.baseFrame;
              let startFrame = baseFrame + intv.startOffset;
              let endFrame = baseFrame + intv.endOffset;

              startFrame = Math.max(startFrame, 0);
              endFrame = Math.min(endFrame, totalFrames - 1);

              if (startFrame > endFrame) {
                const tmp = startFrame;
                startFrame = endFrame;
                endFrame = tmp;
              }

              const startTimeSec = startFrame * frameDuration;
              const endTimeSec = endFrame * frameDuration;

              const widthPercent =
                totalFrames > 0
                  ? ((endFrame - startFrame + 1) / totalFrames) * 100
                  : 0;
              const leftPercent =
                totalFrames > 0 ? (startFrame / totalFrames) * 100 : 0;

              return (
                <div
                  key={i}
                  onClick={() => {
                    setSelectedInterval({ index: i, ...intv });
                    handleReplayFromBase(intv);
                  }}
                  style={{
                    border: isSelected
                      ? "2px solid #ffd54f"
                      : "1px solid #333",
                    borderRadius: "10px",
                    padding: "12px",
                    marginBottom: "12px",
                    background: isSelected ? "#332b00" : "#181818",
                    cursor: "pointer",
                    color: isSelected ? "#fff5c0" : "#ddd",
                    transition: "all 0.2s ease",
                    boxShadow: isSelected
                      ? "0 0 10px rgba(255,213,79,0.3)"
                      : "none",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    #{i + 1}{" "}
                    <span
                      style={{
                        background: "#333",
                        padding: "3px 6px",
                        borderRadius: "4px",
                        fontSize: "0.85em",
                      }}
                    >
                      Base: frame {baseFrame} ({baseTimeLabel(baseFrame)})
                    </span>
                  </p>
                  <p
                    style={{
                      margin: "4px 0",
                      fontSize: "0.9em",
                      color: "#aaa",
                    }}
                  >
                    Start: {startTimeSec.toFixed(2)}s | End:{" "}
                    {endTimeSec.toFixed(2)}s
                  </p>

                  {intv.reason && (
                    <p
                      style={{
                        margin: "4px 0 0 0",
                        fontSize: "0.85em",
                        color: "#bbb",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      📝 {intv.reason}
                    </p>
                  )}

                  <div
                    style={{
                      position: "relative",
                      height: "8px",
                      background: "#333",
                      borderRadius: "3px",
                      marginTop: "6px",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        height: "100%",
                        background: isSelected ? "#ffd54f" : "#ff4444",
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!locked && selectedInterval && (
          <ReplayWindow
            selectedInterval={selectedInterval}
            handleOffsetEdit={handleOffsetEdit}
            handleReplayFromBase={handleReplayFromBase}
            deleteInterval={deleteInterval}
            handleReasonChange={handleReasonChange}
          />
        )}
      </div>
    </div>
  );
}

/* ReplayWindow: 프레임 단위 조정 + reason 메모 */
function ReplayWindow({
  selectedInterval,
  handleOffsetEdit,
  handleReplayFromBase,
  deleteInterval,
  handleReasonChange,
}) {
  const baseFrame = selectedInterval.baseFrame;
  const baseTimeSec = baseFrame * FRAME_DURATION;

  const startFrame = baseFrame + selectedInterval.startOffset;
  const endFrame = baseFrame + selectedInterval.endOffset;

  const startTimeSec = startFrame * FRAME_DURATION;
  const endTimeSec = endFrame * FRAME_DURATION;

  return (
    <div
      style={{
        marginTop: "25px",
        borderTop: "1px solid #333",
        paddingTop: "20px",
        color: "#eee",
      }}
    >
      <h3 style={{ color: "#ffffff", marginBottom: "10px", fontSize: "1.1em" }}>
        🎯 Replay Window
      </h3>
      <p style={{ color: "#aaa", marginBottom: "6px", fontSize: "0.95em" }}>
        Focus on <strong>frame {baseFrame}</strong> ({baseTimeSec.toFixed(2)}s)
      </p>
      <p style={{ color: "#aaa", marginBottom: "14px", fontSize: "0.9em" }}>
        Start frame {startFrame} ({startTimeSec.toFixed(2)}s), End frame{" "}
        {endFrame} ({endTimeSec.toFixed(2)}s)
      </p>

      {/* === Replay / Delete 버튼 (위로 이동) === */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={() => handleReplayFromBase(selectedInterval)}
          style={{
            padding: "10px 22px",
            background: "linear-gradient(90deg, #292828ff)",
            border: "none",
            borderRadius: "8px",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          🔁 Replay
        </button>
        <button
          onClick={() => deleteInterval(selectedInterval.index)}
          style={{
            padding: "10px 22px",
            background: "linear-gradient(90deg, #292828ff)",
            border: "none",
            borderRadius: "8px",
            color: "#c6c1c1ff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          🗑 Delete
        </button>
      </div>

      {/* === 오프셋 조절 UI === */}
      <div
        style={{
          padding: "12px 14px",
          borderRadius: "10px",
          background: "#151515",
          border: "1px solid #333",
        }}
      >
        <Range
          values={[selectedInterval.startOffset, selectedInterval.endOffset]}
          step={1}
          min={MIN_OFFSET}
          max={MAX_OFFSET}
          onChange={(values) => {
            handleOffsetEdit("startOffset", values[0]);
            handleOffsetEdit("endOffset", values[1]);
          }}
          renderTrack={({ props, children }) => (
            <div
              {...props}
              style={{
                ...props.style,
                height: "16px",
                width: "100%",
                borderRadius: "8px",
                background: "#444",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${
                    ((selectedInterval.startOffset - MIN_OFFSET) /
                      (MAX_OFFSET - MIN_OFFSET)) *
                    100
                  }%`,
                  width: `${
                    ((selectedInterval.endOffset -
                      selectedInterval.startOffset) /
                      (MAX_OFFSET - MIN_OFFSET)) *
                    100
                  }%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #ffd54f, #ffd54f)",
                  borderRadius: "8px",
                }}
              />
              {children}
            </div>
          )}
          renderThumb={({ props }) => (
            <div
              {...props}
              style={{
                ...props.style,
                height: "22px",
                width: "22px",
                borderRadius: "50%",
                background: "#ffffff",
                boxShadow: "0 0 4px rgba(0,0,0,0.5)",
              }}
            />
          )}
        />

        {/* 오프셋 숫자 입력 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "12px",
            fontSize: "0.9em",
            color: "#ccc",
            gap: "16px",
          }}
        >
          <div style={{ flex: 1 }}>
            <div>Start offset frames</div>
            <input
              type="number"
              value={selectedInterval.startOffset}
              onChange={(e) => handleOffsetEdit("startOffset", e.target.value)}
              style={{
                width: "100%",
                maxWidth: "130px",
                padding: "6px 8px",
                marginTop: "6px",
                background: "#222",
                border: "1px solid #555",
                borderRadius: "6px",
                color: "#eee",
                fontSize: "0.95em",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div>End offset frames</div>
            <input
              type="number"
              value={selectedInterval.endOffset}
              onChange={(e) => handleOffsetEdit("endOffset", e.target.value)}
              style={{
                width: "100%",
                maxWidth: "130px",
                padding: "6px 8px",
                marginTop: "6px",
                background: "#222",
                border: "1px solid #555",
                borderRadius: "6px",
                color: "#eee",
                fontSize: "0.95em",
              }}
            />
          </div>
        </div>
      </div>

      {/* === Calibration Note === */}
      <div
        style={{
          marginTop: "18px",
          textAlign: "left",
          fontSize: "0.95em",
        }}
      >
        <div style={{ marginBottom: "6px", color: "#ccc" }}>
          Calibration note
        </div>
        <textarea
          value={selectedInterval.reason || ""}
          onChange={(e) => handleReasonChange(e.target.value)}
          placeholder="이 구간으로 다시 잡은 이유를 메모해 주세요."
          rows={4}
          style={{
            width: "100%",
            resize: "vertical",
            minHeight: "390px",
            padding: "10px 12px",
            background: "#181818",
            border: "1px solid #555",
            borderRadius: "8px",
            color: "#eee",
            fontFamily: "inherit",
            fontSize: "0.95em",
            lineHeight: 1.5,
          }}
        />
      </div>
    </div>
  );
}
