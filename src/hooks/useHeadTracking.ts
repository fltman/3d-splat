import { useEffect, useRef, useState } from "react";
import type { TrackingState } from "../types";

export type HeadPosition = { x: number; y: number; z: number; confidence: number };

const ZERO: HeadPosition = { x: 0, y: 0, z: 0, confidence: 0 };

export function useHeadTracking(enabled: boolean) {
  const position = useRef<HeadPosition>({ ...ZERO });
  const [status, setStatus] = useState<TrackingState>(enabled ? "loading" : "off");

  useEffect(() => {
    if (!enabled) {
      position.current = { ...ZERO };
      setStatus("off");
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    let landmarker: Awaited<ReturnType<typeof createLandmarker>> | null = null;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    async function start() {
      setStatus("loading");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        });
        video.srcObject = stream;
        await video.play();
        landmarker = await createLandmarker();
        if (cancelled) return;

        let lastVideoTime = -1;
        const detect = () => {
          if (cancelled || !landmarker) return;
          if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const result = landmarker.detectForVideo(video, performance.now());
            const landmarks = result.faceLandmarks?.[0];
            if (landmarks) {
              const nose = landmarks[1];
              const leftEye = landmarks[33];
              const rightEye = landmarks[263];
              const eyeDistance = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
              const next = {
                x: Math.max(-1, Math.min(1, (0.5 - nose.x) * 2.8)),
                y: Math.max(-1, Math.min(1, (0.48 - nose.y) * 2.4)),
                z: Math.max(-1, Math.min(1, (eyeDistance - 0.16) * 5.5)),
                confidence: 1,
              };
              position.current.x += (next.x - position.current.x) * 0.22;
              position.current.y += (next.y - position.current.y) * 0.22;
              position.current.z += (next.z - position.current.z) * 0.16;
              position.current.confidence = 1;
              setStatus((current) => (current === "active" ? current : "active"));
            } else {
              position.current.confidence *= 0.94;
              if (position.current.confidence < 0.05) {
                setStatus((current) => (current === "fallback" ? current : "fallback"));
              }
            }
          }
          frame = requestAnimationFrame(detect);
        };
        detect();
      } catch (error) {
        if (!cancelled) {
          console.warn("Head tracking unavailable", error);
          setStatus("error");
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      landmarker?.close();
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [enabled]);

  return { position, status };
}

async function createLandmarker() {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm",
  );
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
    minFaceDetectionConfidence: 0.55,
    minFacePresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
  });
}
