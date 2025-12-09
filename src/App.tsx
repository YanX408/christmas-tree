import React, { useState, Suspense, useContext, useEffect } from 'react';
import { TreeContextType, AppState, TreeContext, PointerCoords, GestureDebugInfo } from './types';
import Experience from './components/Experience';
import GestureInput from './components/GestureInput';
import TechEffects from './components/TechEffects';
import PhotoManager from './components/PhotoManager';
import { AnimatePresence, motion } from 'framer-motion';


// --- 梦幻光标组件 ---
const DreamyCursor: React.FC<{ pointer: PointerCoords | null, progress: number }> = ({ pointer, progress }) => {
    if (!pointer) return null;
    return (
        <motion.div
            className="fixed top-0 left-0 pointer-events-none z-[200]"
            initial={{ opacity: 0, scale: 0 }}
            animate={{
                opacity: 1,
                scale: 1,
                left: `${pointer.x * 100}%`,
                top: `${pointer.y * 100}%`
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            style={{ x: "-50%", y: "-50%" }}
        >
            {/* 核心光点 */}
            <div className={`rounded-full transition-all duration-300 ${progress > 0.8 ? 'w-4 h-4 bg-emerald-400 shadow-[0_0_20px_#34d399]' : 'w-2 h-2 bg-amber-200 shadow-[0_0_15px_#fcd34d]'}`} />

            {/* 进度光环 - 魔法符文风格 */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-white/20 animate-spin-slow"></div>

            <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 -rotate-90 overflow-visible">
                <defs>
                    <linearGradient id="magicGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#fbbf24" />
                    </linearGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                        <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>
                {/* 倒计时圆环 */}
                <circle
                    cx="24" cy="24" r="20"
                    fill="none"
                    stroke="url(#magicGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="125.6"
                    strokeDashoffset={125.6 * (1 - progress)}
                    filter="url(#glow)"
                    className="transition-[stroke-dashoffset] duration-75 ease-linear"
                />
            </svg>

            {/* 粒子拖尾装饰 (CSS 动画) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-gradient-to-r from-emerald-500/10 to-amber-500/10 rounded-full blur-xl animate-pulse"></div>
        </motion.div>
    );
};

// --- 照片弹窗 ---
const PhotoModal: React.FC<{ url: string | null, onClose: () => void }> = ({ url, onClose }) => {
    if (!url) return null;
    return (
        <motion.div
            id="photo-modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-8 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.8, y: 50, rotate: -5 }}
                animate={{ scale: 1, y: 0, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0, y: 100 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="relative max-w-4xl max-h-full bg-white p-3 rounded shadow-[0_0_50px_rgba(255,215,0,0.3)] border-8 border-white"
                onClick={(e) => e.stopPropagation()}
            >
                <img src={url} alt="Memory" className="max-h-[80vh] object-contain rounded shadow-inner" />
                <div className="absolute -bottom-12 w-full text-center text-red-300/70 cinzel text-sm">
                    ❄️ Precious Moment ❄️ Tap to close
                </div>
            </motion.div>
        </motion.div>
    );
}

// --- 调试面板组件 ---
const DebugPanel: React.FC<{ debugInfo: GestureDebugInfo | null; isOpen: boolean; onClose: () => void }> = ({ debugInfo, isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-4 z-50 bg-black/90 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4 max-w-md max-h-[70vh] overflow-y-auto"
            style={{ fontFamily: 'monospace', fontSize: '11px' }}
        >
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-cyan-400 font-bold text-sm">Gesture Debug Info</h3>
                <button
                    onClick={onClose}
                    className="text-white/60 hover:text-white text-lg leading-none"
                >
                    ×
                </button>
            </div>

            {!debugInfo ? (
                <div className="text-white/50">No gesture data available</div>
            ) : (
                <div className="space-y-3 text-white/80">
                    {/* 手部检测 */}
                    <div>
                        <div className="text-cyan-400 font-semibold mb-1">Hands Detected: {debugInfo.handsDetected}</div>
                    </div>

                    {/* 手势识别 */}
                    {debugInfo.gestures.length > 0 && (
                        <div>
                            <div className="text-cyan-400 font-semibold mb-1">Gestures:</div>
                            {debugInfo.gestures.map((g, i) => (
                                <div key={i} className="ml-2 text-xs">
                                    {g.name}: {(g.score * 100).toFixed(1)}%
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 手指状态 */}
                    {debugInfo.fingerStates && (
                        <div>
                            <div className="text-cyan-400 font-semibold mb-1">Finger States:</div>
                            <div className="ml-2 text-xs space-y-0.5">
                                <div>Index: {debugInfo.fingerStates.indexExtended ? '✓' : '✗'}</div>
                                <div>Middle: {debugInfo.fingerStates.middleExtended ? '✓' : '✗'}</div>
                                <div>Ring: {debugInfo.fingerStates.ringExtended ? '✓' : '✗'}</div>
                                <div>Pinky: {debugInfo.fingerStates.pinkyExtended ? '✓' : '✗'}</div>
                                <div>Thumb: {debugInfo.fingerStates.thumbExtended ? '✓' : '✗'}</div>
                            </div>
                        </div>
                    )}

                    {/* 检测到的动作 */}
                    <div>
                        <div className="text-cyan-400 font-semibold mb-1">Detected Actions:</div>
                        <div className="ml-2 text-xs space-y-0.5">
                            <div>Pointing: {debugInfo.detectedActions.isPointing ? '✓' : '✗'}</div>
                            <div>Panning: {debugInfo.detectedActions.isPanning ? '✓' : '✗'}</div>
                            <div>Zooming: {debugInfo.detectedActions.isZooming ? '✓' : '✗'}</div>
                            <div>Pinching: {debugInfo.detectedActions.isPinching ? '✓' : '✗'}</div>
                            <div>Five Fingers: {debugInfo.detectedActions.isFiveFingers ? '✓' : '✗'}</div>
                            <div>Two Fingers: {debugInfo.detectedActions.isTwoFingers ? '✓' : '✗'}</div>
                        </div>
                    </div>

                    {/* 手掌位置 */}
                    {debugInfo.palmPosition && (
                        <div>
                            <div className="text-cyan-400 font-semibold mb-1">Palm Position:</div>
                            <div className="ml-2 text-xs">
                                X: {debugInfo.palmPosition.x.toFixed(3)}, Y: {debugInfo.palmPosition.y.toFixed(3)}
                            </div>
                        </div>
                    )}

                    {/* 移动 */}
                    {debugInfo.movement && (
                        <div>
                            <div className="text-cyan-400 font-semibold mb-1">Movement:</div>
                            <div className="ml-2 text-xs">
                                dX: {debugInfo.movement.dx.toFixed(4)}, dY: {debugInfo.movement.dy.toFixed(4)}
                            </div>
                        </div>
                    )}

                    {/* 关键点数量 */}
                    {debugInfo.landmarks.length > 0 && (
                        <div>
                            <div className="text-cyan-400 font-semibold mb-1">Landmarks:</div>
                            {debugInfo.landmarks.map((hand, i) => (
                                <div key={i} className="ml-2 text-xs">
                                    Hand {i + 1}: {hand.landmarks.length} points
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
};

const AppContent: React.FC = () => {
    const { state, setState, webcamEnabled, setWebcamEnabled, pointer, setPointer, hoverProgress, selectedPhotoUrl, setSelectedPhotoUrl, clickTrigger, debugInfo } = useContext(TreeContext) as TreeContextType;
    const [debugOpen, setDebugOpen] = useState(false);
    const [photoManagerOpen, setPhotoManagerOpen] = useState(false);
    const [mousePointer, setMousePointer] = useState<PointerCoords | null>(null);

    // 当照片管理界面打开时，使用鼠标位置作为光标
    useEffect(() => {
        if (!photoManagerOpen) {
            setMousePointer(null);
            return;
        }

        const handleMouseMove = (e: MouseEvent) => {
            const x = e.clientX / window.innerWidth;
            const y = e.clientY / window.innerHeight;
            setMousePointer({ x, y });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [photoManagerOpen]);

    // 当照片管理界面打开时，使用鼠标位置；否则使用手势识别的指针
    const currentPointer = photoManagerOpen ? mousePointer : pointer;

    useEffect(() => {
        if (selectedPhotoUrl && pointer) {
            const x = pointer.x * window.innerWidth;
            const y = pointer.y * window.innerHeight;
            const element = document.elementFromPoint(x, y);
            if (element) {
                const isImage = element.tagName === 'IMG';
                const isBackdrop = element.id === 'photo-modal-backdrop';
                if (isBackdrop || isImage) setSelectedPhotoUrl(null);
            }
        }
    }, [clickTrigger]);

    return (
        <main className="relative w-full h-screen bg-black text-white overflow-hidden cursor-none">
            {/* 手势识别层 (z-0) - 黑色背景 */}
            {webcamEnabled && <GestureInput />}

            {/* 3D 场景层 (z-10) */}
            <div className="absolute inset-0 z-10">
                <Suspense fallback={<div className="flex items-center justify-center h-full text-red-400 cinzel animate-pulse text-2xl">🎄 Loading Christmas Magic... ❄️</div>}>
                    <Experience />
                </Suspense>
            </div>

            {/* 科技感特效层 (z-20) */}
            {webcamEnabled && <TechEffects />}

            {/* UI 层 (z-30) */}
            <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-start items-center pt-12 md:pt-16 p-8">
                <header className="text-center">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl cinzel font-normal text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-100 to-amber-50 mb-2 tracking-[0.1em] drop-shadow-[0_0_30px_rgba(251,191,36,0.3)]">
                        Christmas Memories
                    </h1>
                    <p className="text-amber-100/70 cinzel font-light text-xs md:text-sm tracking-[0.2em] mt-1">
                        {state === 'CHAOS' ? 'Scattered Memories' : 'Memory Tree'}
                    </p>
                </header>
            </div>

            {/* 光标层 (z-200) */}
            <DreamyCursor pointer={currentPointer} progress={hoverProgress} />

            {/* 弹窗层 (z-100) */}
            <AnimatePresence>
                {selectedPhotoUrl && <PhotoModal url={selectedPhotoUrl} onClose={() => setSelectedPhotoUrl(null)} />}
            </AnimatePresence>

            {/* 调试按钮 (z-40) */}
            <div className="absolute bottom-4 left-4 z-40 pointer-events-auto">
                <motion.button
                    onClick={() => setDebugOpen(!debugOpen)}
                    className="px-4 py-2.5 bg-gradient-to-br from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-400/40 rounded-lg text-amber-200 text-sm font-light transition-all shadow-[0_0_15px_rgba(251,191,36,0.2)] hover:shadow-[0_0_20px_rgba(251,191,36,0.3)] backdrop-blur-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {debugOpen ? '隐藏调试' : '调试'}
                    </span>
                </motion.button>
            </div>

            {/* 调试面板 */}
            <AnimatePresence>
                {debugOpen && <DebugPanel debugInfo={debugInfo} isOpen={debugOpen} onClose={() => setDebugOpen(false)} />}
            </AnimatePresence>

            {/* 照片管理 */}
            <PhotoManager onOpenChange={setPhotoManagerOpen} />
        </main>
    );
};

const App: React.FC = () => {
    const [state, setState] = useState<AppState>('CHAOS');
    const [rotationSpeed, setRotationSpeed] = useState<number>(0.3); // 固定基础旋转速度
    const [rotationBoost, setRotationBoost] = useState<number>(0); // 额外加速度
    const [webcamEnabled, setWebcamEnabled] = useState<boolean>(true);
    const [pointer, setPointer] = useState<PointerCoords | null>(null);
    const [hoverProgress, setHoverProgress] = useState<number>(0);
    const [clickTrigger, setClickTrigger] = useState<number>(0);
    const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
    const [panOffset, setPanOffset] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [zoomOffset, setZoomOffset] = useState<number>(0);
    const [debugInfo, setDebugInfo] = useState<GestureDebugInfo | null>(null);

    return (
        <TreeContext.Provider value={{
            state, setState,
            rotationSpeed, setRotationSpeed,
            webcamEnabled, setWebcamEnabled,
            pointer, setPointer,
            hoverProgress, setHoverProgress,
            clickTrigger, setClickTrigger,
            selectedPhotoUrl, setSelectedPhotoUrl,
            panOffset, setPanOffset,
            rotationBoost, setRotationBoost,
            zoomOffset, setZoomOffset,
            debugInfo, setDebugInfo
        }}>
            <AppContent />
        </TreeContext.Provider>
    );
};

export default App;