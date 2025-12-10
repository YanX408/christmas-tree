import React, { useEffect, useRef, useContext, useState } from 'react';
import { FilesetResolver, GestureRecognizer, DrawingUtils, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { TreeContext, TreeContextType, GestureDebugInfo } from '../types';

const GestureInput: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // ---- 手势配置 ----
  const GESTURE_THRESHOLDS: Record<string, number> = {
    Victory: 0.6,
    Thumb_Up: 0.55, // 略降阈值，加快触发
    Open_Palm: 0.5,
    Closed_Fist: 0.45 // 降低阈值，提升识别稳定性
  };
  const GESTURE_HOLD_FRAMES: Record<string, number> = {
    Victory: 6,
    Thumb_Up: 4, // 减少持有帧数，提升响应速度
    Open_Palm: 12,
    Closed_Fist: 6 // 缩短握拳持有帧数，加快回树形
  };
  const SWIPE_DX = 0.02;
  const COOLDOWNS = {
    victory: 1.0,
    thumb: 1.0,
    swipe: 0.8,
    click: 2.0,
    pulse: 1.2,
    theme: 0.9
  };
  const DWELL_THRESHOLD = 1.2;

  const { setState, setRotationSpeed, setRotationBoost, setPointer, state: appState, setHoverProgress, setClickTrigger, selectedPhotoUrl, setPanOffset, setZoomOffset, setDebugInfo, setSelectedPhotoUrl, setLightPulse, setOrnamentTheme } = useContext(TreeContext) as TreeContextType;

  const stateRef = useRef(appState);
  const photoRef = useRef(selectedPhotoUrl);

  useEffect(() => {
    stateRef.current = appState;
    photoRef.current = selectedPhotoUrl;
  }, [appState, selectedPhotoUrl]);

  const [loading, setLoading] = useState(true);

  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastVideoTime = useRef<number>(-1);
  const gestureStreak = useRef<{ name: string | null; count: number; lastStable: string | null }>({ name: null, count: 0, lastStable: null });

  const dwellTimerRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // 记录上一帧手掌中心位置，用于计算位移差
  const lastPalmPos = useRef<{ x: number, y: number } | null>(null);
  // 记录上一帧双手距离，用于缩放
  const lastHandDistance = useRef<number | null>(null);
  // 记录上一帧单手尺寸，用于单手缩放
  const lastHandScale = useRef<number | null>(null);
  // shaka 检测缓存
  const shakaState = useRef<{ isShaka: boolean }>({ isShaka: false });
  // 记录随机照片列表
  const photoListRef = useRef<string[]>([]);
  const loadingPhotosRef = useRef(false);
  const grabCooldownRef = useRef(0);
  const victoryPulseCooldownRef = useRef(0);
  const lastRandomPhotoRef = useRef<string | null>(null);
  const swipeCooldownRef = useRef(0);
  const thumbCooldownRef = useRef(0);
  const gestureHoldRef = useRef<{ name: string | null; count: number }>({ name: null, count: 0 });
  const clickCooldownRef = useRef<number>(0);
  const themeCooldownRef = useRef<number>(0);

  const THEME_FLICK_DX = 0.004; // 再降低阈值，轻微左右摆动即可触发
  const ORNAMENT_THEME_COUNT = 3;

  const isExtended = (landmarks: NormalizedLandmark[], tipIdx: number, mcpIdx: number, wrist: NormalizedLandmark) => {
    const tipDist = Math.hypot(landmarks[tipIdx].x - wrist.x, landmarks[tipIdx].y - wrist.y);
    const mcpDist = Math.hypot(landmarks[mcpIdx].x - wrist.x, landmarks[mcpIdx].y - wrist.y);
    return tipDist > mcpDist * 1.3;
  };

  const isPinching = (landmarks: NormalizedLandmark[]) => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    return distance < 0.05; // Threshold for pinch
  };

  // Shaka: 拇指、小指伸展，其余收起
  const isShaka = (landmarks: NormalizedLandmark[]) => {
    const wrist = landmarks[0];
    const thumbExtended = isExtended(landmarks, 4, 2, wrist);
    const indexExtended = isExtended(landmarks, 8, 5, wrist);
    const middleExtended = isExtended(landmarks, 12, 9, wrist);
    const ringExtended = isExtended(landmarks, 16, 13, wrist);
    const pinkyExtended = isExtended(landmarks, 20, 17, wrist);
    return thumbExtended && pinkyExtended && !indexExtended && !middleExtended && !ringExtended;
  };

  useEffect(() => {
    let mounted = true;
    // 预加载照片列表，供“抓取”动作随机展示
    const preloadPhotos = async () => {
      if (loadingPhotosRef.current || photoListRef.current.length > 0) return;
      loadingPhotosRef.current = true;
      try {
        const res = await fetch('/photos/photos.json?' + Date.now());
        if (res.ok) {
          const files: string[] = await res.json();
          photoListRef.current = files;
        }
      } catch (err) {
        console.warn('加载照片列表失败，将使用默认列表', err);
        photoListRef.current = ["2025_12_1.jpg", "2025_12_2.jpg", "2025_12_3.jpg", "2025_12_4.jpg", "2025_12_5.jpg"];
      } finally {
        loadingPhotosRef.current = false;
      }
    };
    preloadPhotos();

    const setupMediaPipe = async () => {
      try {
        // 1. Start Camera Access (Parallel)
        const streamPromise = navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: 320,
            height: 240,
            frameRate: { ideal: 30 }
          }
        }).catch(() => navigator.mediaDevices.getUserMedia({ video: true }));

        // 2. Start MediaPipe Loading (Parallel)
        const recognizerPromise = (async () => {
          const vision = await FilesetResolver.forVisionTasks(
            "/wasm"
          );
          return GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "/models/gesture_recognizer.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2
          });
        })();

        // 3. Wait for both to complete
        const [stream, recognizer] = await Promise.all([streamPromise, recognizerPromise]);

        if (!mounted) return;

        recognizerRef.current = recognizer;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            if (canvasRef.current && videoRef.current) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
            }
            if (previewCanvasRef.current && videoRef.current) {
              previewCanvasRef.current.width = videoRef.current.videoWidth;
              previewCanvasRef.current.height = videoRef.current.videoHeight;
            }
            setLoading(false);
            lastFrameTimeRef.current = Date.now();
            predictWebcam();
          };
        }

        // 同步一个可见的预览视频，展示在右上角
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
          previewRef.current.onloadedmetadata = () => {
            previewRef.current?.play();
          };
        }
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
        setLoading(false);
        
        // 检查是否是 HTTPS 问题
        if (error instanceof DOMException) {
          if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            console.error("摄像头权限被拒绝，请检查浏览器权限设置");
          } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            console.error("未找到摄像头设备");
          } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            console.error("摄像头无法访问，可能被其他应用占用");
          } else if (error.message?.includes('secure context') || error.message?.includes('HTTPS')) {
            alert('⚠️ 摄像头访问需要 HTTPS 连接！\n\n请使用 https:// 访问此应用，或使用 localhost。\n\n当前协议: ' + window.location.protocol);
          }
        }
      }
    };
    setupMediaPipe();
    return () => {
      mounted = false;
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const predictWebcam = () => {
    const now = Date.now();
    const delta = (now - lastFrameTimeRef.current) / 1000;
    lastFrameTimeRef.current = now;
    if (grabCooldownRef.current > 0) {
      grabCooldownRef.current = Math.max(0, grabCooldownRef.current - delta);
    }
    if (victoryPulseCooldownRef.current > 0) {
      victoryPulseCooldownRef.current = Math.max(0, victoryPulseCooldownRef.current - delta);
    }
    if (swipeCooldownRef.current > 0) {
      swipeCooldownRef.current = Math.max(0, swipeCooldownRef.current - delta);
    }
    if (thumbCooldownRef.current > 0) {
      thumbCooldownRef.current = Math.max(0, thumbCooldownRef.current - delta);
    }
    if (clickCooldownRef.current > 0) {
      clickCooldownRef.current = Math.max(0, clickCooldownRef.current - delta);
    }
    if (themeCooldownRef.current > 0) {
      themeCooldownRef.current = Math.max(0, themeCooldownRef.current - delta);
    }

    const currentState = stateRef.current;
    const isPhotoOpen = !!photoRef.current;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const recognizer = recognizerRef.current;

    if (video && recognizer && canvas) {
      if (video.currentTime !== lastVideoTime.current) {
        lastVideoTime.current = video.currentTime;
        const results = recognizer.recognizeForVideo(video, Date.now());
        const ctx = canvas.getContext("2d");
        const previewCtx = previewCanvasRef.current?.getContext("2d") || null;
        const gestureCandidates = results.gestures?.flat() || [];
        const getThreshold = (name: string, fallback = 0.6) => GESTURE_THRESHOLDS[name] ?? fallback;
        const hasGesture = (name: string) =>
          gestureCandidates.some(g => g.categoryName === name && g.score >= getThreshold(name));
        const isVictoryGesture = hasGesture('Victory');
        const isThumbUpGesture = hasGesture('Thumb_Up');
        const primaryGesture = gestureCandidates[0] || null;

        const updateHold = (name: string | null, score: number) => {
          if (!name) {
            gestureHoldRef.current = { name: null, count: 0 };
            return;
          }
          const th = getThreshold(name, 0.5);
          if (score >= th) {
            if (gestureHoldRef.current.name === name) {
              gestureHoldRef.current = { ...gestureHoldRef.current, count: gestureHoldRef.current.count + 1 };
            } else {
              gestureHoldRef.current = { name, count: 1 };
            }
          } else if (gestureHoldRef.current.name === name) {
            gestureHoldRef.current = { name: null, count: 0 };
          }
        };

        const meetsHold = (name: string) =>
          gestureHoldRef.current.name === name &&
          gestureHoldRef.current.count >= (GESTURE_HOLD_FRAMES[name] ?? 0);

        let detectedColor = "rgba(0, 255, 255, 0.2)"; // 默认霓虹青色，降低透明度
        let currentPointer = null;
        let isPointing = false;
        let isZooming = false;
        
        // 手指状态（用于调试）
        let indexExtended = false;
        let middleExtended = false;
        let ringExtended = false;
        let pinkyExtended = false;
        let thumbExtended = false;
        let isFiveFingers = false;
        let isTwoFingers = false;
        let pinch = false;
        let shaka = false;
        let isAllFolded = false;
        
        // 移动信息（用于调试）
        let movementDx = 0;
        let movementDy = 0;

        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          const wrist = landmarks[0];

          indexExtended = isExtended(landmarks, 8, 5, wrist);
          middleExtended = isExtended(landmarks, 12, 9, wrist);
          ringExtended = isExtended(landmarks, 16, 13, wrist);
          pinkyExtended = isExtended(landmarks, 20, 17, wrist);
          thumbExtended = isExtended(landmarks, 4, 2, wrist);

          shaka = isShaka(landmarks);
          shakaState.current.isShaka = shaka;

          isPointing = indexExtended && !middleExtended && !ringExtended && !pinkyExtended;
          isFiveFingers = indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended;
          // 平移手势改用 Shaka（保留 isTwoFingers 字段仅用于调试显示）
          isTwoFingers = shaka;
          // 全收拳兜底（无手指伸展）
          isAllFolded = !indexExtended && !middleExtended && !ringExtended && !pinkyExtended && !thumbExtended;

          // 全局更新手掌位置 (无论什么手势，只要有手就追踪，防止 flickering 导致 dx 丢失)
          const palmX = (landmarks[0].x + landmarks[5].x + landmarks[17].x) / 3;
          const palmY = (landmarks[0].y + landmarks[5].y + landmarks[17].y) / 3;

          let dx = 0;
          let dy = 0;
          if (lastPalmPos.current) {
            dx = (1.0 - palmX) - (1.0 - lastPalmPos.current.x); // x 轴镜像
            dy = palmY - lastPalmPos.current.y;
            movementDx = dx;
            movementDy = dy;
          }
          lastPalmPos.current = { x: palmX, y: palmY };

          // Relaxed movement threshold to 0.005 (was 0.003) to improve dwell stability
          const isMoving = Math.abs(dx) > 0.005 || Math.abs(dy) > 0.005;

          // 更新当前主手势的持有计数（用于帧稳定）
          if (primaryGesture) {
            updateHold(primaryGesture.categoryName, primaryGesture.score);
          } else {
            updateHold(null, 0);
          }

          // 如果是单指指向，打断"蓄力"状态
          if (isPointing) {
            gestureStreak.current.lastStable = null;
          }

          // --- 逻辑分支 1: 单手控制 (平移/缩放/旋转) ---
          if (results.landmarks.length === 1) {
            // 1.1 单手缩放 (五指张开，仅在 CHAOS 状态下生效，避免与状态切换冲突)
            // 动作快则缩放快，增强操纵感
            if (isFiveFingers && currentState === 'CHAOS') {
              const currentScale = Math.hypot(wrist.x - landmarks[9].x, wrist.y - landmarks[9].y);
              if (lastHandScale.current !== null) {
                const deltaScale = currentScale - lastHandScale.current;
                // 移除阈值，使用非线性映射增强快速动作的响应
                // deltaScale 越大，缩放越快（平方关系增强差异）
                const speed = Math.abs(deltaScale);
                const amplifiedDelta = Math.sign(deltaScale) * speed * (1 + speed * 50);

                setZoomOffset(prev => {
                  const next = prev - amplifiedDelta * 200.0;
                  return Math.max(-20, Math.min(next, 40));
                });
                if (speed > 0.001) isZooming = true;
              }
              lastHandScale.current = currentScale;
            } else {
              lastHandScale.current = null;
            }

            // 1.2 Shaka 平移 (任何状态下都可以，但未打开照片时)
            // 圣诞树树根直接跟随手掌中心位置（更稳）
            if (!isPhotoOpen && shaka) {
              // 使用手掌中心作为平移点
              const centerX = palmX;
              const centerY = palmY;

              // 将归一化坐标 (0-1) 转换为以屏幕中心为原点的坐标 (-0.5 到 0.5)
              // 然后乘以系数映射到世界坐标
              // x 轴镜像（因为摄像头是镜像的）
              const worldX = (0.5 - centerX) * 20;  // 左右范围 -10 到 10
              const worldY = (0.5 - centerY) * 12;  // 上下范围 -6 到 6

              // 直接设置位置（绝对跟随）
              setPanOffset({ x: worldX, y: worldY });

              detectedColor = "rgba(0, 255, 200, 0.9)";
              dwellTimerRef.current = 0;
              setHoverProgress(0);
            }
          } else {
            // 如果不是单手，重置单手缩放记录
            lastHandScale.current = null;
          }

          // --- 逻辑分支 2: 单指光标 & 点击 (Dwell or Pinch) ---
          pinch = isPinching(landmarks);

          // Victory 单独放行，指向/捏合仍需排除五指/两指/ Shaka
          if (
            currentState === 'CHAOS' &&
            (
              isVictoryGesture ||
              (!isFiveFingers && !isTwoFingers && (isPointing || pinch))
            )
          ) {
            const indexTip = landmarks[8];
            currentPointer = { x: 1.0 - indexTip.x, y: indexTip.y };

          // Victory 手势 -> 随机照片展示
          if (isVictoryGesture && meetsHold('Victory') && grabCooldownRef.current === 0) {
            if (photoListRef.current.length > 0) {
              const list = photoListRef.current;
              const len = list.length;
              const pickIndex = () => {
                if (window.crypto?.getRandomValues) {
                  const buf = new Uint32Array(1);
                  window.crypto.getRandomValues(buf);
                  return buf[0] % len;
                }
                return Math.floor(Math.random() * len);
              };
              let idx = pickIndex();
              if (len > 1 && lastRandomPhotoRef.current === list[idx]) {
                idx = (idx + 1) % len; // 避免连续重复
              }
              const chosen = list[idx];
              lastRandomPhotoRef.current = chosen;
              setSelectedPhotoUrl(`/photos/${chosen}`);
              grabCooldownRef.current = COOLDOWNS.victory;
            }
            dwellTimerRef.current = 0;
            setHoverProgress(0);
            detectedColor = "rgba(0, 255, 255, 1.0)";
          }
          // Dwell Click (Hover)
          else {
            dwellTimerRef.current += delta;
            const progress = Math.min(dwellTimerRef.current / DWELL_THRESHOLD, 1.0);
            setHoverProgress(progress);

            if (dwellTimerRef.current >= DWELL_THRESHOLD) {
              setClickTrigger(Date.now());
              clickCooldownRef.current = COOLDOWNS.click;
              dwellTimerRef.current = 0;
              setHoverProgress(0);
              detectedColor = "rgba(100, 255, 255, 1.0)"; // 亮青色完成
            } else {
              detectedColor = "rgba(0, 255, 255, 0.8)"; // 霓虹青色悬停
            }
          }
          } else {
            dwellTimerRef.current = 0;
            setHoverProgress(0);
          }

          // --- 逻辑分支 3: 状态切换 & 旋转控制 ---
          if (!isVictoryGesture && !isPointing) {
            if (primaryGesture) {
              const name = primaryGesture.categoryName;
              if (name === 'Open_Palm' && currentState === 'FORMED' && !isMoving && meetsHold('Open_Palm')) {
                setState("CHAOS");
                gestureHoldRef.current = { name: null, count: 0 };
              } else if (name === 'Closed_Fist' && (meetsHold('Closed_Fist') || primaryGesture.score >= getThreshold('Closed_Fist', 0.45) || isAllFolded)) {
                // 模型握拳或达到分数即触发回树
                setState("FORMED");
                setSelectedPhotoUrl(null);
                gestureHoldRef.current = { name: null, count: 0 };
              }
            } else {
              // 模型未给分类时，使用五指全收兜底
              if (isAllFolded) {
                setState("FORMED");
                setSelectedPhotoUrl(null);
                gestureHoldRef.current = { name: null, count: 0 };
              } else {
                gestureHoldRef.current = { name: null, count: 0 };
              }
            }
          }

          // --- FORMED: 胜利脉冲与拇指主题切换 ---
          if (currentState === 'FORMED') {
            // Victory 长按 -> 灯光脉冲 + 加速
            if (isVictoryGesture && meetsHold('Victory') && victoryPulseCooldownRef.current === 0) {
              // 更强的脉冲与旋转加速
              setRotationBoost(prev => Math.max(prev, 2.0));
              setLightPulse(Date.now());
              victoryPulseCooldownRef.current = COOLDOWNS.pulse;
              detectedColor = "rgba(255, 80, 80, 1.0)"; // 圣诞红脉冲提示
            }

            // 拇指点赞 + 左右快速移动 -> 装饰主题切换
            if (
              isThumbUpGesture &&
              themeCooldownRef.current === 0 &&
              Math.abs(movementDx) > THEME_FLICK_DX
            ) {
              setOrnamentTheme(prev => {
                const delta = movementDx > 0 ? 1 : -1;
                const next = (prev + delta + ORNAMENT_THEME_COUNT) % ORNAMENT_THEME_COUNT;
                return next;
              });
              themeCooldownRef.current = COOLDOWNS.theme;
              detectedColor = "rgba(255, 180, 120, 0.95)";
            }
          }

          // 旋转控制 (FORMED 模式)
          if (currentState === 'FORMED') {
            if (isFiveFingers) {
              if (Math.abs(dx) > 0.001) {
                setRotationBoost(prev => {
                  const newBoost = prev - dx * 8.0;
                  return Math.max(Math.min(newBoost, 3.0), -3.0);
                });
                detectedColor = "rgba(0, 200, 255, 0.9)";
              }
            } else {
              setRotationBoost(prev => {
                const decayed = prev * 0.95;
                if (Math.abs(decayed) < 0.001) return 0;
                return decayed;
              });
            }
          }

          // --- 逻辑分支 4: 双手缩放 (全状态生效) ---
          // 动作快则缩放快，增强操纵感
          if (results.landmarks.length === 2) {
            const hand1 = results.landmarks[0][0]; // Wrist of hand 1
            const hand2 = results.landmarks[1][0]; // Wrist of hand 2

            // 计算两手距离 (归一化坐标系)
            const dist = Math.hypot(hand1.x - hand2.x, hand1.y - hand2.y);

            if (lastHandDistance.current !== null) {
              const delta = dist - lastHandDistance.current;

              // 使用非线性映射增强快速动作的响应
              const speed = Math.abs(delta);
              const amplifiedDelta = Math.sign(delta) * speed * (1 + speed * 30);

              setZoomOffset(prev => {
                const next = prev - amplifiedDelta * 100.0;
                return Math.max(-20, Math.min(next, 40));
              });
              if (speed > 0.002) {
                detectedColor = "rgba(150, 255, 255, 0.9)";
              }
            }
            lastHandDistance.current = dist;
          } else {
            lastHandDistance.current = null;
          }

        } else {
          dwellTimerRef.current = 0;
          setHoverProgress(0);

          if (clickCooldownRef.current > 0) {
            clickCooldownRef.current -= delta;
            // Keep the last pointer if cooling down
          } else {
            setPointer(null);
            lastPalmPos.current = null;
          }

          // 手势丢失，重置所有状态
          gestureStreak.current = { name: null, count: 0, lastStable: null };
        }

        setPointer(currentPointer);

        // 照片浏览模式下，张开手左右划动切换照片
        if (isPhotoOpen && isFiveFingers && swipeCooldownRef.current === 0) {
          const list = photoListRef.current;
          if (list.length > 0) {
            const current = photoRef.current || '';
            const currentName = current.replace('/photos/', '');
            const idx = Math.max(0, list.findIndex(f => f === currentName));

            if (movementDx > SWIPE_DX) {
              // 向右划 -> 下一张
              const next = list[(idx + 1) % list.length];
              lastRandomPhotoRef.current = next;
              setSelectedPhotoUrl(`/photos/${next}`);
              swipeCooldownRef.current = COOLDOWNS.swipe;
            } else if (movementDx < -SWIPE_DX) {
              // 向左划 -> 上一张
              const prev = list[(idx - 1 + list.length) % list.length];
              lastRandomPhotoRef.current = prev;
              setSelectedPhotoUrl(`/photos/${prev}`);
              swipeCooldownRef.current = COOLDOWNS.swipe;
            }
          }
        }

        // 点赞手势：关闭照片并切回炸开形态
        if (isThumbUpGesture && thumbCooldownRef.current === 0) {
          const thumbActive = meetsHold('Thumb_Up') || (primaryGesture?.categoryName === 'Thumb_Up' && primaryGesture.score >= getThreshold('Thumb_Up', 0.55));
          if (thumbActive) {
            // 仅用于关闭照片；不再强制触发展开
            setSelectedPhotoUrl(null);
            if (currentState === 'CHAOS') {
              setState("CHAOS");
            }
            thumbCooldownRef.current = COOLDOWNS.thumb;
            gestureHoldRef.current = { name: null, count: 0 }; // 清空持有，避免阻塞后续识别
          }
        }

        // 收集调试信息
        if (setDebugInfo) {
          const debugData: GestureDebugInfo = {
            handsDetected: results.landmarks?.length || 0,
            gestures: results.gestures?.flat().map(g => ({
              name: g.categoryName,
              score: g.score
            })) || [],
            landmarks: (results.landmarks || []).map((landmarks, idx) => ({
              handIndex: idx,
              landmarks: landmarks.map(l => ({ x: l.x, y: l.y, z: l.z }))
            })),
            fingerStates: results.landmarks && results.landmarks.length > 0 ? {
              indexExtended,
              middleExtended,
              ringExtended,
              pinkyExtended,
              thumbExtended
            } : null,
            detectedActions: {
              isPointing,
              isPanning: false,
              isZooming,
              isPinching: pinch,
              isFiveFingers,
              isTwoFingers
            },
            palmPosition: lastPalmPos.current,
            movement: (movementDx !== 0 || movementDy !== 0) ? { dx: movementDx, dy: movementDy } : null
          };
          setDebugInfo(debugData);
        }

        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // 绘制右上角预览中的手势连线
        if (previewCtx) {
          const canvasW = previewCanvasRef.current!.width;
          const canvasH = previewCanvasRef.current!.height;
          previewCtx.save();
          previewCtx.clearRect(0, 0, canvasW, canvasH);
          // 镜像以匹配视频的 scaleX(-1)
          previewCtx.translate(canvasW, 0);
          previewCtx.scale(-1, 1);
          if (results.landmarks && results.landmarks.length > 0) {
            const drawingUtils = new DrawingUtils(previewCtx);
            for (const lm of results.landmarks) {
              drawingUtils.drawConnectors(lm, GestureRecognizer.HAND_CONNECTIONS, { color: "rgba(255, 255, 255, 0.9)", lineWidth: 2 });
              drawingUtils.drawLandmarks(lm, { color: "rgba(255, 215, 0, 0.9)", lineWidth: 1, radius: 3 });
            }
          }
          previewCtx.restore();
        }
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  return (
    // 全屏背景布局 - 最底层
    <div className="fixed inset-0 w-full h-full z-0 bg-black">
      {/* 摄像头视频背景层 - 隐藏但保留功能 */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-0 pointer-events-none"
        playsInline
        muted
        autoPlay
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* 手势骨架线画布 - 隐藏但保留功能 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover z-[2] opacity-0 pointer-events-none"
        style={{ transform: 'scaleX(-1)' }}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-2xl text-emerald-500 animate-pulse bg-black z-20 cinzel">
          SYSTEM INITIALIZING...
        </div>
      )}

      {/* 右上角摄像头预览区域 */}
      <div className="absolute top-4 right-4 w-[280px] aspect-video z-30 pointer-events-none">
        <div className="relative w-full h-full border-2 border-red-500/80 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(239,68,68,0.45)] bg-black/60 backdrop-blur-sm">
          <video
            ref={previewRef}
            className="w-full h-full object-cover opacity-80"
            playsInline
            muted
            autoPlay
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas
            ref={previewCanvasRef}
            className="absolute inset-0 w-full h-full"
          />
          <div className="absolute inset-0 border border-white/10 pointer-events-none" />
        </div>
      </div>
    </div>
  );
};

export default GestureInput;