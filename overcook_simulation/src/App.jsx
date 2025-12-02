// src/App.jsx

import React, { useState, useEffect, useRef } from "react";
import OvercookScene from "./components/OvercookScene";
import { adaptEpisode } from "./data/overcook_episodes";
import { Range } from "react-range";

const MIN_OFFSET = -20;
const MAX_OFFSET = 20;
const FRAME_DURATION = 0.3;

// 시간 라벨 (필요하면 사용)
function baseTimeLabel(frame) {
  return `${(frame * FRAME_DURATION).toFixed(2)}s`;
}

export default function App() {
  const [episode, setEpisode] = useState(null); // 업로드된 에피소드
  const [fileName, setFileName] = useState(""); // 업로드된 파일 이름

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

  const frameDuration = FRAME_DURATION;
  const totalFrames = episode?.frames?.length ?? 0;
  const totalTime = totalFrames * frameDuration;
  const hasEpisode = totalFrames > 0;

  const frame =
    hasEpisode && totalFrames > 0
      ? episode.frames[Math.min(frameIndex, totalFrames - 1)]
      : null;
  const progress =
    hasEpisode && totalTime > 0
      ? Math.min((elapsed / totalTime) * 100, 100)
      : 0;

  // 구간 재생 여부
  const isReplaying = playMode === "segment" && isPlaying;

  // JSON 파일 업로드 핸들러
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = JSON.parse(event.target.result);
        const adapted = adaptEpisode(raw, file.name);

        // 기존 재생 취소
        cancelAnimationFrame(rafRef.current);

        // 새 에피소드로 상태 리셋
        setEpisode({
          fileName: file.name,
          ...adapted,
        });
        setFileName(file.name);

        setIsPlaying(false);
        setPlayMode("full");
        segmentEndFrameRef.current = null;

        setElapsed(0);
        setFrameIndex(0);
        setRawMarkers([]);
        setIntervals([]);
        setSelectedInterval(null);
        setLocked(true);
      } catch (err) {
        console.error("Failed to read JSON", err);
        alert("유효한 JSON 파일이 아닙니다.");
      }
    };
    reader.readAsText(file);
  };

  // 메인 재생 루프
  useEffect(() => {
    if (!isPlaying || !episode || totalFrames === 0) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

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
  }, [isPlaying, playMode, frameDuration, totalFrames, totalTime, elapsed, episode]);

  // Space key → 현재 프레임 index 저장
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName?.toLowerCase?.() || "";
      const isTyping =
        tag === "textarea" ||
        tag === "input" ||
        e.target.isContentEditable;

      if (isTyping) return;

      if (e.code === "Space") {
        e.preventDefault();

        if (!episode || totalFrames === 0) return;

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
  }, [frameIndex, episode, totalFrames]);

  // 선택한 interval만 재생
  const handleReplayFromBase = (intv) => {
    if (!intv || !episode || totalFrames === 0) return;

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

    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);

    segmentEndFrameRef.current = endFrame;
    setPlayMode("segment");

    requestAnimationFrame(() => {
      setFrameIndex(startFrame);
      setElapsed(startTime);
      setIsPlaying(true);
    });
  };

  const togglePlay = () => {
    if (!episode || totalFrames === 0) return;
    if (isPlaying) return;

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
    if (!episode || totalFrames === 0) return;

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
    const layout =
      episode.staticInfo?.layoutName ||
      episode.staticInfo?.mapName ||
      "uploaded";

    const payload = {
      fileName: episode.fileName || fileName || "uploaded.json",
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

  // 업로드 버튼 기준 pill 스타일
  const pillStyle = {
    background: "#333333",
    color: "#f0f0f0",
    borderRadius: "6px",
  };

  // 공통 버튼 스타일
  const commonButtonStyle = {
    ...pillStyle,
    padding: "6px 16px",
    border: "none",
    fontWeight: 600,
    fontSize: "0.9em",
    cursor: "pointer",
    outline: "none",
  };

  // 메인 화면
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
          Overcooked Trajectory Viewer
        </h2>

        <div
          style={{
            fontSize: "0.9em",
            color: "#ccc",
            marginBottom: "10px",
          }}
        >
          {hasEpisode ? (
            <>
              Trajectory file <code>{episode.fileName}</code>
            </>
          ) : (
            <>JSON trajectory 파일을 업로드해 주세요.</>
          )}
        </div>

        {/* 업로드 버튼 */}
        <div style={{ marginBottom: "12px" }}>
          <label
            style={{
              ...pillStyle,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: "0.9em",
              display: "inline-block",
              outline: "none",
            }}
          >
            JSON 파일 업로드
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {/* 프레임 상태 표시 */}
        <div
          style={{
            ...pillStyle,
            fontSize: "0.9em",
            marginBottom: "15px",
            padding: "6px 12px",
            display: "inline-block",
          }}
        >
          {hasEpisode ? (
            <>
              Frame {frameIndex} / {totalFrames - 1}
            </>
          ) : (
            <>No episode loaded</>
          )}
        </div>

        {/* 에이전트 화면 */}
        <div
          style={{
            width: "100%",
            maxWidth: "800px",
            height: "50vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          {hasEpisode && frame ? (
            <div
              style={{
                transform: "scale(1.2)",
                transformOrigin: "top center",
              }}
            >
              <OvercookScene
                staticInfo={episode.staticInfo}
                frame={frame}
                frames={episode.frames}
                isReplaying={isReplaying}
              />
            </div>
          ) : (
            <div
              style={{
                border: "1px dashed #444",
                borderRadius: "10px",
                padding: "20px 40px",
                color: "#777",
                fontSize: "0.95em",
              }}
            >
              JSON trajectory 파일을 업로드하면 여기에서 플레이 화면을 볼 수
              있습니다.
            </div>
          )}
        </div>

        {/* Controls */}
        <div
          style={{
            marginTop: "18px",
            marginBottom: "10px",
            display: "flex",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          {/* Play */}
          <button
            onClick={togglePlay}
            disabled={isPlaying || !hasEpisode}
            style={{
              ...commonButtonStyle,
              opacity: isPlaying || !hasEpisode ? 0.4 : 1,
              cursor: isPlaying || !hasEpisode ? "not-allowed" : "pointer",
            }}
          >
            {isPlaying ? "▶️ Playing..." : "▶️ Play"}
          </button>

          {/* Reset */}
          <button
            onClick={reset}
            style={{
              ...commonButtonStyle,
            }}
          >
            🔁 Reset
          </button>

          {/* Export */}
          {!locked && hasEpisode && (
            <button
              onClick={handleExport}
              style={{
                ...commonButtonStyle,
              }}
            >
              📁 Export marker.json
            </button>
          )}
        </div>

        {/* Raw timeline */}
        <div
          style={{
            width: "50%",
            margin: "8px auto 8px auto",
            position: "relative",
            background: "#181818",
            borderRadius: "6px",
            padding: "10px 10px",
          }}
        >
          <p
            style={{
              margin: "0 0 4px 0",
              textAlign: "left",
              color: "#bbb",
              fontWeight: 500,
              fontSize: "0.9em",
            }}
          >
            Real-Time Markers
          </p>
          {/* 설명 한 줄 */}
          <p
            style={{
              margin: "0 0 8px 0",
              textAlign: "left",
              color: "#888",
              fontSize: "0.8em",
            }}
          >
            Unexpected agent behavior를 보면 재생 중 Space 키를 눌러 해당 프레임에
            마커를 추가하세요.
          </p>
          <div
            style={{
              position: "relative",
              height: "8px",
              background: "#333",
              borderRadius: "6px",
            }}
          >
            {/* 진행 바 단색 */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: `${progress}%`,
                height: "8px",
                background: "#666666",
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
                  title={
                    hasEpisode
                      ? `Replay around frame ${markerFrame} (${(
                          markerFrame * frameDuration
                        ).toFixed(2)}s)`
                      : ""
                  }
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
                    cursor: hasEpisode ? "pointer" : "default",
                    boxShadow: "none",
                    transition: "all 0.15s ease",
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div
        style={{
          width: "600px",
          flexShrink: 0,
          borderLeft: "2px solid #222",
          paddingLeft: "20px",
          textAlign: "center",
          opacity: !hasEpisode || locked ? 0.4 : 1,
          pointerEvents: !hasEpisode || locked ? "none" : "auto",
          transition: "opacity 0.3s ease",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {!hasEpisode ? (
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
            <h3 style={{ color: "#ffd54f" }}>JSON 파일을 업로드해 주세요</h3>
            <p>
              Trajectory JSON을 업로드하면 여기에서 마커와 보정 구간을 편집할 수
              있습니다.
            </p>
          </div>
        ) : locked ? (
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
              <strong>첫 전체 재생</strong>이 끝나면 오른쪽 패널에서 구간을 편집할 수
              있습니다.
            </p>
          </div>
        ) : intervals.length === 0 ? (
          <p style={{ color: "#888", marginTop: "40px" }}>
            아직 마커가 없습니다. 재생 중에 Space 키를 눌러 마커를 추가해 보세요.
          </p>
        ) : (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              textAlign: "left",
              paddingRight: "8px",
              paddingBottom: "20px",
              boxSizing: "border-box",
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
                      ? "1px solid #e0c15a"
                      : "1px solid #333",
                    borderRadius: "10px",
                    padding: "12px",
                    marginBottom: "12px",
                    background: isSelected ? "#242008" : "#181818",
                    cursor: "pointer",
                    color: isSelected ? "#fff3c0" : "#ddd",
                    transition: "all 0.2s ease",
                    position: "relative",
                  }}
                >
                  {/* 헤더 라인 + X 삭제 버튼 */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 600 }}>
                      <span
                        style={{
                          background: "#333",
                          padding: "3px 6px",
                          borderRadius: "4px",
                          fontSize: "0.85em",
                        }}
                      >
                        Frame {baseFrame}
                      </span>
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteInterval(i);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#777",
                        cursor: "pointer",
                        fontSize: "1rem",
                        lineHeight: 1,
                        padding: "2px 4px",
                        outline: "none",
                      }}
                      title="Delete this interval"
                    >
                      ×
                    </button>
                  </div>

                  {/* Start / End 프레임 */}
                  <p
                    style={{
                      margin: "4px 0",
                      fontSize: "0.9em",
                      color: "#aaa",
                    }}
                  >
                    Start frame {startFrame} End frame {endFrame}
                  </p>

                  {/* 간단 reason 요약 */}
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

                  {/* 전체 타임라인 중 이 구간 위치 */}
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

                  {/* 선택된 카드만 확장 영역 표시 */}
                  {isSelected && selectedInterval && (
                    <>
                      {/* Replay window 영역 */}
                      <div
                        style={{
                          marginTop: "14px",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          background: "#151515",
                          border: "1px solid #333",
                          color: "#eee",
                          fontSize: "0.9em",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 6px 0",
                            color: "#ccc",
                            fontWeight: 500,
                          }}
                        >
                          Replay Window
                        </p>
                        <p
                          style={{
                            margin: "0 0 10px 0",
                            color: "#aaa",
                          }}
                        >
                         
                        </p>

                        {/* Replay 버튼 */}
                        <div
                          style={{
                            display: "flex",
                            
                            gap: "10px",
                            marginBottom: "10px",
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReplayFromBase(selectedInterval);
                            }}
                            style={{
                              ...pillStyle,
                              padding: "6px 14px",
                              border: "none",
                              fontWeight: 600,
                              fontSize: "0.85em",
                              cursor: "pointer",
                              outline: "none",
                            }}
                          >
                            🔁 Replay
                          </button>
                        </div>

                        {/* 오프셋 Range */}
                        <Range
                          values={[
                            selectedInterval.startOffset,
                            selectedInterval.endOffset,
                          ]}
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
                              {/* 선택된 구간 하이라이트 */}
                              <div
                                style={{
                                  position: "absolute",
                                  left: `${
                                    ((selectedInterval.startOffset -
                                      MIN_OFFSET) /
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
                                  background: "#ffd54f",
                                  borderRadius: "8px",
                                }}
                              />
                              {/* baseFrame(실시간 마킹 시점) 표시: offset 0 위치, 더 진하고 두꺼운 선 */}
                              <div
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: `${
                                    ((0 - MIN_OFFSET) /
                                      (MAX_OFFSET - MIN_OFFSET)) *
                                    100
                                  }%`,
                                  width: "4px",
                                  height: "100%",
                                  background: "#000000b4",
                                  transform: "translateX(-50%)",
                                  borderRadius: "2px",
                                  
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
                            marginTop: "10px",
                            fontSize: "0.9em",
                            color: "#ccc",
                            gap: "12px",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div>Start offset frames</div>
                            <input
                              type="number"
                              value={selectedInterval.startOffset}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleOffsetEdit(
                                  "startOffset",
                                  e.target.value
                                );
                              }}
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
                              onChange={(e) => {
                                e.stopPropagation();
                                handleOffsetEdit("endOffset", e.target.value);
                              }}
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

                      {/* Calibration Note */}
                      <div
                        style={{
                          marginTop: "10px",
                          textAlign: "left",
                          fontSize: "0.9em",
                        }}
                      >
                        <div
                          style={{ marginBottom: "4px", color: "#ccc" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Calibration note
                        </div>
                        <textarea
                          value={selectedInterval.reason || ""}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleReasonChange(e.target.value);
                          }}
                          placeholder="이 구간을 다시 표시한 이유를 메모해 주세요 ex 파란 에이전트가 접시 대신 양파를 집음"

                          rows={4}
                          style={{
                            width: "100%",
                            resize: "vertical",
                            minHeight: "120px",
                            maxHeight: "220px",
                            padding: "8px 10px",
                            background: "#181818",
                            border: "1px solid #555",
                            borderRadius: "8px",
                            color: "#eee",
                            fontFamily: "inherit",
                            fontSize: "0.9em",
                            lineHeight: 1.5,
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
