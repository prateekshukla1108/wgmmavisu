import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TensorCore = ({ isAnimating = false }) => {
    const [animationPhase, setAnimationPhase] = useState(0);
    const [mode, setMode] = useState('rt_st'); // 'rt_st' = A from Regs, 'st_st' = A from SMEM
    const [dataPackets, setDataPackets] = useState([]);

    // Animation phases: 0=idle, 1=ldmatrix/descriptor, 2=data streaming, 3=accumulating
    useEffect(() => {
        if (!isAnimating) {
            setAnimationPhase(0);
            setDataPackets([]);
            return;
        }

        const phases = [1, 2, 3, 0];
        let phaseIndex = 0;

        const interval = setInterval(() => {
            setAnimationPhase(phases[phaseIndex]);
            phaseIndex = (phaseIndex + 1) % phases.length;
        }, 2500);

        return () => clearInterval(interval);
    }, [isAnimating]);

    // Generate data packets for streaming animation
    useEffect(() => {
        if (animationPhase !== 2) {
            setDataPackets([]);
            return;
        }

        const packets = [];
        for (let i = 0; i < 8; i++) {
            packets.push({ id: i, delay: i * 0.1 });
        }
        setDataPackets(packets);
    }, [animationPhase]);

    const banks = Array.from({ length: 8 }, (_, i) => i);
    const registers = Array.from({ length: 4 }, (_, i) => i);
    const aRegisters = Array.from({ length: 4 }, (_, i) => i); // A operand registers for rt_st mode

    return (
        <div className="flex flex-col items-center gap-6">
            {/* Mode Toggle */}
            <div className="flex items-center gap-4 p-4 bg-bg-card rounded-lg border border-gray-700">
                <span className="text-sm font-mono text-gray-400">WGMMA Mode:</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setMode('rt_st')}
                        className={`px-4 py-2 rounded-lg font-mono text-sm transition-all ${mode === 'rt_st'
                                ? 'bg-nvidia-green text-black font-semibold shadow-glow-green'
                                : 'bg-bg-elevated text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        rt_st (A: Registers)
                    </button>
                    <button
                        onClick={() => setMode('st_st')}
                        className={`px-4 py-2 rounded-lg font-mono text-sm transition-all ${mode === 'st_st'
                                ? 'bg-cyber-purple text-white font-semibold shadow-glow-purple'
                                : 'bg-bg-elevated text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        st_st (A: SMEM)
                    </button>
                </div>
            </div>

            {/* Mode Description */}
            <motion.div
                key={mode}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-center p-3 rounded-lg border ${mode === 'rt_st'
                        ? 'bg-nvidia-green/10 border-nvidia-green/30'
                        : 'bg-cyber-purple/10 border-cyber-purple/30'
                    }`}
            >
                <div className={`font-mono font-semibold ${mode === 'rt_st' ? 'text-nvidia-green' : 'text-cyber-purple'}`}>
                    {mode === 'rt_st'
                        ? 'Matrix A from Registers (via ldmatrix) + Matrix B from SMEM (via Descriptor)'
                        : 'Both A & B from Shared Memory (via Descriptors)'}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                    {mode === 'rt_st'
                        ? 'Uses 4 register values {%64, %65, %66, %67} for A operand'
                        : 'Uses two 64-bit descriptors for A and B operands'}
                </div>
            </motion.div>

            {/* Main visualization */}
            <div className="flex items-center justify-center gap-4 py-8">

                {/* Left Side: Source of Matrix A */}
                <div className="flex flex-col items-center gap-2 w-32">
                    <AnimatePresence mode="wait">
                        {mode === 'rt_st' ? (
                            /* Matrix A from Registers (ldmatrix path) */
                            <motion.div
                                key="rt-source"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col items-center gap-2"
                            >
                                <h4 className="text-sm font-mono text-nvidia-green mb-2">A (Registers)</h4>

                                {/* ldmatrix indicator */}
                                <motion.div
                                    className="w-full px-2 py-1 text-xs font-mono text-center rounded border border-dashed"
                                    animate={{
                                        borderColor: animationPhase >= 1 ? 'rgba(0, 200, 255, 1)' : 'rgba(55, 65, 81, 1)',
                                        color: animationPhase >= 1 ? 'rgba(0, 200, 255, 1)' : 'rgba(156, 163, 175, 1)',
                                    }}
                                >
                                    ldmatrix
                                </motion.div>

                                {/* A Registers */}
                                <div className="flex flex-col gap-1 mt-2">
                                    {aRegisters.map((reg) => (
                                        <motion.div
                                            key={reg}
                                            className="w-24 h-8 bg-bg-card border rounded flex items-center justify-center font-mono text-xs"
                                            animate={{
                                                borderColor: animationPhase >= 1 ? 'rgba(118, 185, 0, 1)' : 'rgba(55, 65, 81, 1)',
                                                boxShadow: animationPhase >= 1
                                                    ? '0 0 10px rgba(118, 185, 0, 0.3)'
                                                    : 'none',
                                            }}
                                            transition={{ delay: reg * 0.05 }}
                                        >
                                            <span className="text-nvidia-green">%{64 + reg}</span>
                                        </motion.div>
                                    ))}
                                </div>

                                <div className="text-xs text-gray-500 font-mono mt-1">a_rt.data[0-3]</div>
                            </motion.div>
                        ) : (
                            /* Matrix A from SMEM (descriptor path) */
                            <motion.div
                                key="st-source"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col items-center gap-2"
                            >
                                <h4 className="text-sm font-mono text-cyber-purple mb-2">A (SMEM)</h4>

                                {/* A Descriptor */}
                                <motion.div
                                    className="w-28 h-12 rounded-lg flex flex-col items-center justify-center font-mono text-xs border-2"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(180, 100, 255, 0.2) 0%, rgba(180, 100, 255, 0.05) 100%)',
                                    }}
                                    animate={{
                                        borderColor: animationPhase >= 1 ? 'rgba(180, 100, 255, 1)' : 'rgba(55, 65, 81, 1)',
                                        boxShadow: animationPhase >= 1
                                            ? '0 0 15px rgba(180, 100, 255, 0.4)'
                                            : 'none',
                                    }}
                                >
                                    <span className="text-cyber-purple">a_st_desc</span>
                                    <span className="text-[10px] text-gray-500">64-bit</span>
                                </motion.div>

                                {/* A SMEM Banks */}
                                <div className="flex flex-col gap-0.5 mt-2">
                                    {banks.slice(0, 4).map((bank) => (
                                        <motion.div
                                            key={bank}
                                            className="w-20 h-6 bg-bg-card border border-gray-700 rounded flex items-center justify-center font-mono text-[10px]"
                                            animate={{
                                                borderColor: animationPhase >= 2 ? 'rgba(180, 100, 255, 0.6)' : 'rgba(55, 65, 81, 1)',
                                            }}
                                        >
                                            <span className="text-gray-400">Bank {bank}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Data Flow: A to Tensor Core */}
                <svg className="w-20 h-64" viewBox="0 0 80 256">
                    {mode === 'rt_st' ? (
                        /* Register path - direct */
                        <>
                            {aRegisters.map((_, i) => (
                                <motion.path
                                    key={`a-reg-${i}`}
                                    d={`M 0 ${60 + i * 35} L 80 ${90 + i * 20}`}
                                    fill="none"
                                    stroke="rgba(118, 185, 0, 0.7)"
                                    strokeWidth="2"
                                    strokeDasharray="6 3"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{
                                        pathLength: animationPhase >= 2 ? 1 : 0,
                                        opacity: animationPhase >= 2 ? 0.8 : 0,
                                    }}
                                    transition={{ duration: 0.5, delay: i * 0.1 }}
                                />
                            ))}
                            <motion.text
                                x="40"
                                y="230"
                                textAnchor="middle"
                                className="text-[9px] font-mono"
                                fill="rgba(118, 185, 0, 0.8)"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: animationPhase >= 2 ? 1 : 0 }}
                            >
                                From Regs
                            </motion.text>
                        </>
                    ) : (
                        /* SMEM path with descriptor */
                        <>
                            <motion.path
                                d="M 0 100 Q 40 100 80 128"
                                fill="none"
                                stroke="rgba(180, 100, 255, 0.7)"
                                strokeWidth="3"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{
                                    pathLength: animationPhase >= 2 ? 1 : 0,
                                    opacity: animationPhase >= 2 ? 0.8 : 0,
                                }}
                                transition={{ duration: 0.6 }}
                            />
                            <motion.text
                                x="40"
                                y="230"
                                textAnchor="middle"
                                className="text-[9px] font-mono"
                                fill="rgba(180, 100, 255, 0.8)"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: animationPhase >= 2 ? 1 : 0 }}
                            >
                                Via Desc
                            </motion.text>
                        </>
                    )}
                </svg>

                {/* Center: Tensor Core */}
                <div className="flex flex-col items-center gap-3">
                    <h4 className="text-sm font-mono text-gray-400">WGMMA Unit</h4>

                    {/* Main Tensor Core block */}
                    <motion.div
                        className="relative w-44 h-44 rounded-lg flex flex-col items-center justify-center"
                        style={{
                            background: 'linear-gradient(135deg, #1a2a1a 0%, #0f1f0f 100%)',
                            border: '2px solid rgba(118, 185, 0, 0.5)',
                        }}
                        animate={{
                            boxShadow: animationPhase >= 2
                                ? ['0 0 30px rgba(118, 185, 0, 0.3)', '0 0 60px rgba(118, 185, 0, 0.5)', '0 0 30px rgba(118, 185, 0, 0.3)']
                                : '0 0 20px rgba(118, 185, 0, 0.1)',
                        }}
                        transition={{
                            boxShadow: { repeat: Infinity, duration: 1.5 },
                        }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-nvidia-green/10 to-transparent rounded-lg" />

                        <motion.div
                            className="text-nvidia-green text-glow-green font-mono font-bold text-base"
                            animate={{
                                scale: animationPhase >= 2 ? [1, 1.05, 1] : 1,
                            }}
                            transition={{ repeat: Infinity, duration: 0.8 }}
                        >
                            TENSOR CORE
                        </motion.div>

                        <motion.div
                            className="text-xs font-mono mt-2 px-2 py-1 rounded"
                            animate={{
                                backgroundColor: mode === 'rt_st' ? 'rgba(118, 185, 0, 0.2)' : 'rgba(180, 100, 255, 0.2)',
                                color: mode === 'rt_st' ? 'rgba(118, 185, 0, 1)' : 'rgba(180, 100, 255, 1)',
                            }}
                        >
                            {mode === 'rt_st' ? 'rt_st mode' : 'st_st mode'}
                        </motion.div>

                        <motion.div
                            className="mt-3 text-sm font-mono text-gray-400"
                            animate={{
                                opacity: animationPhase >= 2 ? 1 : 0.3,
                                color: animationPhase >= 3 ? 'rgba(118, 185, 0, 1)' : 'rgba(156, 163, 175, 1)',
                            }}
                        >
                            D = A × B + C
                        </motion.div>
                    </motion.div>
                </div>

                {/* Data Flow: B to Tensor Core */}
                <svg className="w-20 h-264" viewBox="0 0 80 256">
                    {banks.map((bank, i) => (
                        <motion.path
                            key={bank}
                            d={`M 80 ${40 + i * 28} L 0 ${90 + i * 20}`}
                            fill="none"
                            stroke="rgba(0, 200, 255, 0.6)"
                            strokeWidth="2"
                            strokeDasharray="8 4"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{
                                pathLength: animationPhase >= 2 ? 1 : 0,
                                opacity: animationPhase >= 2 ? 0.8 : 0,
                            }}
                            transition={{ duration: 0.5, delay: i * 0.08 }}
                            className="data-path"
                        />
                    ))}

                    {/* Data packets for B */}
                    <AnimatePresence>
                        {dataPackets.map((packet) => (
                            <motion.circle
                                key={packet.id}
                                r="3"
                                fill="rgba(0, 200, 255, 1)"
                                initial={{ cx: 80, cy: 40 + packet.id * 28, opacity: 1 }}
                                animate={{ cx: 0, cy: 90 + packet.id * 20, opacity: 0.5 }}
                                exit={{ opacity: 0 }}
                                transition={{
                                    duration: 0.8,
                                    delay: packet.delay,
                                    repeat: Infinity,
                                    repeatDelay: 0.5,
                                }}
                                style={{ filter: 'drop-shadow(0 0 4px rgba(0, 200, 255, 0.8))' }}
                            />
                        ))}
                    </AnimatePresence>

                    <motion.text
                        x="40"
                        y="245"
                        textAnchor="middle"
                        className="text-[9px] font-mono"
                        fill="rgba(0, 200, 255, 0.8)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: animationPhase >= 2 ? 1 : 0 }}
                    >
                        B via Desc
                    </motion.text>
                </svg>

                {/* Right Side: Matrix B from SMEM + Descriptor */}
                <div className="flex flex-col items-center gap-2 w-32">
                    <h4 className="text-sm font-mono text-cyber-blue mb-2">B (SMEM)</h4>

                    {/* B Descriptor */}
                    <motion.div
                        className="w-28 h-12 rounded-lg flex flex-col items-center justify-center font-mono text-xs border-2"
                        style={{
                            background: 'linear-gradient(135deg, rgba(0, 200, 255, 0.2) 0%, rgba(0, 200, 255, 0.05) 100%)',
                        }}
                        animate={{
                            borderColor: animationPhase >= 1 ? 'rgba(0, 200, 255, 1)' : 'rgba(55, 65, 81, 1)',
                            boxShadow: animationPhase >= 1
                                ? '0 0 15px rgba(0, 200, 255, 0.4)'
                                : 'none',
                        }}
                    >
                        <span className="text-cyber-blue">b_st_desc</span>
                        <span className="text-[10px] text-gray-500">64-bit</span>
                    </motion.div>

                    {/* B SMEM Banks */}
                    <div className="flex flex-col gap-0.5 mt-2">
                        {banks.map((bank) => (
                            <motion.div
                                key={bank}
                                className="w-20 h-6 bg-bg-card border border-gray-700 rounded flex items-center justify-center font-mono text-[10px]"
                                animate={{
                                    borderColor: animationPhase >= 2 ? 'rgba(0, 200, 255, 0.6)' : 'rgba(55, 65, 81, 1)',
                                    boxShadow: animationPhase >= 2
                                        ? '0 0 8px rgba(0, 200, 255, 0.2)'
                                        : 'none',
                                }}
                                transition={{ delay: bank * 0.05 }}
                            >
                                <span className="text-gray-400">Bank {bank}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Output arrow */}
                <svg className="w-16 h-64" viewBox="0 0 64 256">
                    {registers.map((reg, i) => (
                        <motion.path
                            key={reg}
                            d={`M 0 ${100 + i * 20} L 64 ${70 + i * 45}`}
                            fill="none"
                            stroke="rgba(255, 200, 100, 0.6)"
                            strokeWidth="2"
                            strokeDasharray="6 3"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{
                                pathLength: animationPhase >= 3 ? 1 : 0,
                                opacity: animationPhase >= 3 ? 0.8 : 0,
                            }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                        />
                    ))}
                </svg>

                {/* Far Right: Output Accumulators */}
                <div className="flex flex-col items-center gap-2 w-28">
                    <h4 className="text-sm font-mono text-gray-400 mb-2">D (Accum)</h4>
                    <div className="flex flex-col gap-1">
                        {registers.map((reg) => (
                            <motion.div
                                key={reg}
                                className="w-24 h-10 bg-bg-card border border-gray-700 rounded flex flex-col items-center justify-center font-mono text-xs"
                                animate={{
                                    borderColor: animationPhase >= 3 ? 'rgba(255, 200, 100, 1)' : 'rgba(55, 65, 81, 1)',
                                    boxShadow: animationPhase >= 3
                                        ? '0 0 12px rgba(255, 200, 100, 0.3)'
                                        : 'none',
                                    backgroundColor: animationPhase >= 3 ? 'rgba(255, 200, 100, 0.1)' : 'rgba(26, 26, 32, 1)',
                                }}
                                transition={{ delay: reg * 0.1 }}
                            >
                                <span className="text-gray-300">dst[{reg}]</span>
                                <motion.span
                                    className="text-[10px]"
                                    animate={{
                                        color: animationPhase >= 3 ? 'rgba(255, 200, 100, 1)' : 'rgba(107, 114, 128, 1)',
                                    }}
                                >
                                    {animationPhase >= 3 ? '✓ FP32' : '...'}
                                </motion.span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Code snippet showing the difference */}
            <motion.div
                key={mode + '-code'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-bg-card rounded-lg border border-gray-800 font-mono text-xs max-w-3xl overflow-x-auto"
            >
                <div className="text-gray-500 mb-2">// {mode === 'rt_st' ? 'Register × Shared' : 'Shared × Shared'} mode</div>
                {mode === 'rt_st' ? (
                    <div className="space-y-1">
                        <div>
                            <span className="text-gray-500">// A operand: </span>
                            <span className="text-nvidia-green">registers</span>
                            <span className="text-gray-500"> (loaded via ldmatrix)</span>
                        </div>
                        <div>
                            <span className="text-cyber-purple">wgmma.mma_async</span>
                            <span className="text-white">...</span>
                            <span className="text-nvidia-green">{` {%64, %65, %66, %67}`}</span>
                            <span className="text-white">, </span>
                            <span className="text-cyber-blue">b_st_desc</span>
                            <span className="text-white">;</span>
                        </div>
                        <div className="mt-2 text-gray-500">
              // Uses: "r"(*(uint32_t*)&a_rt.data[0..3])
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <div>
                            <span className="text-gray-500">// Both operands: </span>
                            <span className="text-cyber-purple">descriptors</span>
                            <span className="text-gray-500"> (direct SMEM read)</span>
                        </div>
                        <div>
                            <span className="text-cyber-purple">wgmma.mma_async</span>
                            <span className="text-white">...</span>
                            <span className="text-cyber-purple">a_st_desc</span>
                            <span className="text-white">, </span>
                            <span className="text-cyber-blue">b_st_desc</span>
                            <span className="text-white">;</span>
                        </div>
                        <div className="mt-2 text-gray-500">
              // Uses: "l"(a_st_desc), "l"(b_st_desc)
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default TensorCore;
