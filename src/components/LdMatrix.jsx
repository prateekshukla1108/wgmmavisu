import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

const LdMatrix = ({ isAnimating = false }) => {
    const [selectedThread, setSelectedThread] = useState(0);

    const STRIDE = 32;
    const BASE_ADDR = 0x400;

    const calculateThreadAddress = (tid) => {
        // T0-7: top-left (rows 0-7, cols 0-7)
        // T8-15: bottom-left (rows 8-15, cols 0-7)
        // T16-23: top-right (rows 0-7, cols 8-15)
        // T24-31: bottom-right (rows 8-15, cols 8-15)
        const group = Math.floor(tid / 8); // 4 groups of 8 threads
        const laneInGroup = tid % 8;

        // Threads 0-15 = left cols, Threads 16-31 = right cols
        const isRightHalf = tid >= 16;
        // Within each half, first 8 threads = top rows, next 8 = bottom rows
        const isBottomHalf = (tid >= 8 && tid < 16) || (tid >= 24);

        const rowIndex = (isBottomHalf ? 8 : 0) + laneInGroup;
        const rowOffset = rowIndex * STRIDE;
        const colOffset = isRightHalf ? 16 : 0; // 16 bytes = 8 fp16 columns

        return {
            tid, group, laneInGroup, rowIndex,
            colOffset: colOffset / 2, // Column index (0 or 8)
            rowOffset,
            colOffsetBytes: colOffset,
            finalAddr: BASE_ADDR + rowOffset + colOffset,
            destReg: group,
            subMatrixName: ['Top-Left', 'Bot-Left', 'Top-Right', 'Bot-Right'][group],
        };
    };

    const threadData = useMemo(() =>
        Array.from({ length: 32 }, (_, i) => calculateThreadAddress(i)), []
    );

    const selectedData = threadData[selectedThread];

    const groupColors = [
        '#76b900', '#b464ff', '#00c8ff', '#ffb432', // TL, BL, TR, BR
    ];

    return (
        <div className="flex flex-col items-center gap-4 max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center">
                <div className="font-mono text-lg text-nvidia-green">ldmatrix.sync.aligned.m8n8.x4</div>
                <div className="text-xs text-gray-500 mt-1">Each thread → ONE addr | Hardware → ALL threads get data</div>
            </div>

            {/* Equation */}
            <div className="font-mono text-base flex items-center gap-2">
                <span className="text-nvidia-green">{`{%r0,%r1,%r2,%r3}`}</span>
                <span className="text-white">=</span>
                <span className="text-cyber-blue">[%addr]</span>
            </div>

            {/* Thread Selector */}
            <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Thread:</span>
                <input
                    type="range"
                    min="0"
                    max="31"
                    value={selectedThread}
                    onChange={(e) => setSelectedThread(parseInt(e.target.value))}
                    className="w-32 accent-nvidia-green"
                />
                <span className="font-mono font-bold text-sm" style={{ color: groupColors[selectedData.group] }}>
                    T{selectedThread}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                    Group {String.fromCharCode(65 + selectedData.group)} ({selectedData.subMatrixName})
                </span>
            </div>

            {/* Main content - 3 columns, stacks on mobile */}
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4 w-full">

                {/* Left: Compact 16x16 SMEM Grid */}
                <div className="flex flex-col items-center">
                    <div className="text-xs text-gray-500 mb-1">Shared Memory (16×16)</div>
                    <div className="relative">
                        {/* Column labels */}
                        <div className="flex ml-4">
                            {Array.from({ length: 16 }, (_, i) => (
                                <div key={i} className="w-4 h-3 text-[7px] font-mono text-gray-600 text-center">
                                    {i}
                                </div>
                            ))}
                        </div>

                        {/* Grid */}
                        <div className="flex">
                            {/* Row labels */}
                            <div className="flex flex-col">
                                {Array.from({ length: 16 }, (_, i) => (
                                    <div
                                        key={i}
                                        className={`w-4 h-4 text-[7px] font-mono flex items-center justify-end pr-0.5 ${i === selectedData.rowIndex ? 'text-white font-bold' : 'text-gray-600'
                                            }`}
                                    >
                                        {i}
                                    </div>
                                ))}
                            </div>

                            {/* Grid cells - COMPACT */}
                            <div className="grid gap-px" style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}>
                                {Array.from({ length: 16 * 16 }, (_, idx) => {
                                    const row = Math.floor(idx / 16);
                                    const col = idx % 16;

                                    // 4 quadrants: TL(0), BL(1), TR(2), BR(3)
                                    let cellGroup;
                                    if (row < 8 && col < 8) cellGroup = 0;      // Top-Left
                                    else if (row >= 8 && col < 8) cellGroup = 1; // Bottom-Left
                                    else if (row < 8 && col >= 8) cellGroup = 2; // Top-Right
                                    else cellGroup = 3;                          // Bottom-Right

                                    const isSelectedRow = row === selectedData.rowIndex;
                                    const isSelectedCols = (selectedData.colOffset === 0 && col < 8) ||
                                        (selectedData.colOffset === 8 && col >= 8);
                                    const isSelected = isSelectedRow && isSelectedCols;

                                    return (
                                        <div
                                            key={idx}
                                            className="w-4 h-4 rounded-sm"
                                            style={{
                                                backgroundColor: isSelected
                                                    ? groupColors[selectedData.group]
                                                    : `${groupColors[cellGroup]}30`,
                                                border: isSelected ? `1px solid white` : 'none',
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2 text-[8px] font-mono">
                        <span style={{ color: groupColors[0] }}>T0-7: TL</span>
                        <span style={{ color: groupColors[2] }}>T16-23: TR</span>
                        <span style={{ color: groupColors[1] }}>T8-15: BL</span>
                        <span style={{ color: groupColors[3] }}>T24-31: BR</span>
                    </div>
                </div>

                {/* Middle: Address Calculation */}
                <div className="flex-1 max-w-xs">
                    <div className="p-3 bg-bg-card rounded-lg border border-gray-700 space-y-2">
                        <div className="flex justify-between border-b border-gray-700 pb-1">
                            <span className="text-xs" style={{ color: groupColors[selectedData.group] }}>
                                Thread {selectedThread}
                            </span>
                            <span className="text-[10px] text-gray-500">{selectedData.subMatrixName}</span>
                        </div>

                        <div className="space-y-1 text-xs font-mono">
                            <div className="flex justify-between">
                                <span className="text-gray-500">group =</span>
                                <span className="text-white">{selectedData.group}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">lane =</span>
                                <span className="text-white">{selectedData.laneInGroup}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">row =</span>
                                <span className="text-nvidia-green">{selectedData.rowIndex}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">row_off =</span>
                                <span className="text-nvidia-green">{selectedData.rowOffset}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">col_off =</span>
                                <span className="text-cyber-blue">{selectedData.colOffsetBytes}</span>
                            </div>
                            <hr className="border-gray-700" />
                            <div className="flex justify-between pt-1">
                                <span className="text-gray-400 font-bold">%addr =</span>
                                <span className="font-bold" style={{ color: groupColors[selectedData.group] }}>
                                    0x{selectedData.finalAddr.toString(16).toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Formula */}
                    <div className="mt-2 p-2 bg-nvidia-green/10 border border-nvidia-green/30 rounded text-[10px] font-mono text-center">
                        <span className="text-nvidia-green">addr = base + row×{STRIDE} + col_off</span>
                    </div>
                </div>

                {/* Right: Destination Registers */}
                <div className="flex flex-col items-center">
                    <div className="text-xs text-gray-500 mb-1">Registers</div>
                    <div className="space-y-1">
                        {[0, 1].map((reg) => (
                            <motion.div
                                key={reg}
                                className="flex items-center gap-2 px-2 py-1 rounded border text-xs font-mono"
                                style={{
                                    borderColor: selectedData.destReg === reg ? groupColors[reg] : 'rgb(55, 65, 81)',
                                    backgroundColor: selectedData.destReg === reg ? `${groupColors[reg]}20` : 'transparent',
                                }}
                            >
                                <span style={{ color: groupColors[reg] }}>%r{reg}</span>
                                <span className="text-gray-500 text-[10px]">
                                    ← {['Left', 'Right'][reg]}
                                </span>
                            </motion.div>
                        ))}
                    </div>

                    {/* Warning */}
                    <div className="mt-2 p-2 bg-gray-800/50 rounded text-[9px] text-gray-400 max-w-32">
                        <span className="text-yellow-400">⚠️</span> T{selectedThread}'s %r{selectedData.destReg} ≠ data@0x{selectedData.finalAddr.toString(16)}
                        <br />
                        <span className="text-gray-500">It's a fragment for Tensor Core.</span>
                    </div>
                </div>
            </div>

            {/* Code */}
            <div className="text-[10px] font-mono text-gray-400 bg-bg-card p-2 rounded border border-gray-800 max-w-md">
                <span className="text-gray-500">// Per-thread:</span>{' '}
                row = tid%16; col_off = (tid≥16)?16:0
            </div>
        </div>
    );
};

export default LdMatrix;
