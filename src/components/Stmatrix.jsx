import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Stmatrix = ({ isAnimating = false }) => {
    const [animationPhase, setAnimationPhase] = useState(0);
    // Phases: 0=idle, 1=registers active, 2=data flowing, 3=re-swizzling in SMEM

    useEffect(() => {
        if (!isAnimating) {
            setAnimationPhase(0);
            return;
        }

        const phases = [1, 2, 3, 0];
        let phaseIndex = 0;

        const interval = setInterval(() => {
            setAnimationPhase(phases[phaseIndex]);
            phaseIndex = (phaseIndex + 1) % phases.length;
        }, 1500);

        return () => clearInterval(interval);
    }, [isAnimating]);

    const registers = Array.from({ length: 4 }, (_, i) => i);
    const memorySlots = Array.from({ length: 8 }, (_, i) => i);

    return (
        <div className="flex flex-col items-center gap-8">
            {/* Title */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
            >
                <div className="font-mono text-lg text-cyber-blue text-glow-blue mb-1">
                    stmatrix.sync.aligned.m8n8.x4
                </div>
                <div className="text-sm text-gray-400">
                    Store matrix tiles from registers back to shared memory
                </div>
            </motion.div>

            {/* Main visualization - stacks on mobile */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                {/* Registers (Source) */}
                <div className="flex flex-col items-center gap-2">
                    <h4 className="text-sm font-mono text-gray-500 mb-2">Registers (D)</h4>
                    <div className="grid grid-cols-2 gap-2">
                        {registers.map((reg) => (
                            <motion.div
                                key={reg}
                                className="w-20 h-16 rounded-lg flex flex-col items-center justify-center font-mono text-xs border-2"
                                animate={{
                                    borderColor: animationPhase >= 1
                                        ? 'rgba(0, 200, 255, 1)'
                                        : 'rgba(55, 65, 81, 1)',
                                    backgroundColor: animationPhase >= 1
                                        ? 'rgba(0, 200, 255, 0.1)'
                                        : 'rgba(26, 26, 32, 1)',
                                    boxShadow: animationPhase >= 1
                                        ? '0 0 20px rgba(0, 200, 255, 0.3)'
                                        : 'none',
                                    scale: animationPhase === 2 ? [1, 0.95, 1] : 1,
                                }}
                                transition={{
                                    scale: { repeat: animationPhase === 2 ? Infinity : 0, duration: 0.3 },
                                }}
                            >
                                <span className="text-gray-300">R{reg}</span>
                                <motion.span
                                    className="text-[10px] mt-1"
                                    animate={{
                                        color: animationPhase >= 1 ? 'rgba(0, 200, 255, 1)' : 'rgba(107, 114, 128, 1)',
                                    }}
                                >
                                    {animationPhase >= 1 ? 'FULL' : 'empty'}
                                </motion.span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Arrow with animation */}
                <svg className="w-32 h-48" viewBox="0 0 128 192">
                    {/* Main flow paths */}
                    {registers.map((_, i) => (
                        <motion.path
                            key={i}
                            d={`M 0 ${40 + i * 40} Q 64 ${60 + i * 30} 128 ${20 + i * 22}`}
                            fill="none"
                            stroke="rgba(0, 200, 255, 0.6)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{
                                pathLength: animationPhase >= 2 ? 1 : 0,
                                opacity: animationPhase >= 2 ? 0.8 : 0,
                            }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                        />
                    ))}

                    {/* Animated particles */}
                    <AnimatePresence>
                        {animationPhase === 2 && registers.map((_, i) => (
                            <motion.circle
                                key={`particle-${i}`}
                                r="5"
                                fill="rgba(0, 200, 255, 1)"
                                initial={{ cx: 0, cy: 40 + i * 40, opacity: 1 }}
                                animate={{ cx: 128, cy: 20 + i * 22, opacity: 0.5 }}
                                exit={{ opacity: 0 }}
                                transition={{
                                    duration: 0.8,
                                    delay: i * 0.1,
                                    repeat: Infinity,
                                    repeatDelay: 0.3,
                                }}
                                style={{ filter: 'drop-shadow(0 0 8px rgba(0, 200, 255, 0.8))' }}
                            />
                        ))}
                    </AnimatePresence>

                    {/* Label */}
                    <motion.text
                        x="64"
                        y="180"
                        textAnchor="middle"
                        className="text-xs font-mono"
                        fill="rgba(0, 200, 255, 0.8)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: animationPhase >= 2 ? 1 : 0 }}
                    >
                        stmatrix
                    </motion.text>
                </svg>

                {/* Shared Memory (Destination) */}
                <div className="flex flex-col items-center gap-2">
                    <h4 className="text-sm font-mono text-gray-500 mb-2">Shared Memory</h4>
                    <div className="relative">
                        {/* Memory grid */}
                        <div className="grid grid-cols-4 gap-1 p-3 bg-bg-card rounded-lg border border-gray-700">
                            {memorySlots.map((slot) => {
                                // Calculate swizzle effect - cells shift positions
                                const originalPos = slot;
                                const swizzledPos = animationPhase >= 3 ? (slot ^ ((slot >> 1) & 0x3)) : slot;

                                return (
                                    <motion.div
                                        key={slot}
                                        className="w-12 h-10 rounded flex items-center justify-center font-mono text-xs"
                                        animate={{
                                            backgroundColor: animationPhase >= 3
                                                ? `hsl(${swizzledPos * 45}, 70%, 40%)`
                                                : animationPhase >= 2
                                                    ? 'rgba(0, 200, 255, 0.3)'
                                                    : 'rgba(30, 30, 40, 1)',
                                            borderColor: animationPhase >= 3
                                                ? 'rgba(118, 185, 0, 1)'
                                                : 'rgba(55, 65, 81, 1)',
                                            boxShadow: animationPhase >= 3
                                                ? '0 0 10px rgba(118, 185, 0, 0.4)'
                                                : 'none',
                                        }}
                                        style={{ border: '1px solid' }}
                                        transition={{ delay: slot * 0.05 }}
                                    >
                                        <span className="text-white/80">
                                            {animationPhase >= 3 ? `S${swizzledPos}` : `M${slot}`}
                                        </span>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Re-swizzle indicator */}
                        <AnimatePresence>
                            {animationPhase >= 3 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 bg-nvidia-green/20 border border-nvidia-green rounded text-xs font-mono text-nvidia-green whitespace-nowrap"
                                >
                                    ✓ Re-swizzled for next op
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Code snippet */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6 p-4 bg-bg-card rounded-lg border border-gray-800 font-mono text-sm max-w-2xl"
            >
                <div className="text-gray-500 mb-2">// Store tile from registers to shared memory</div>
                <div className="flex flex-wrap">
                    <span className="text-cyber-purple">asm volatile</span>
                    <span className="text-white">(</span>
                    <span className="text-nvidia-green">"stmatrix.sync.aligned.m8n8.x4.shared::cta.b16 [%4], </span>
                    <span className="text-cyber-blue">{`{%0, %1, %2, %3}`}</span>
                    <span className="text-nvidia-green">;"</span>
                    <span className="text-white">);</span>
                </div>
            </motion.div>

            {/* Key insight */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="flex items-center gap-3 px-4 py-3 bg-nvidia-green/10 border border-nvidia-green/30 rounded-lg max-w-lg"
            >
                <div className="text-nvidia-green text-xl">💡</div>
                <div className="text-sm text-gray-300">
                    <span className="text-nvidia-green font-semibold">Key:</span> stmatrix writes data back in a layout compatible with next ldmatrix/wgmma, preserving the swizzle pattern.
                </div>
            </motion.div>
        </div>
    );
};

export default Stmatrix;
