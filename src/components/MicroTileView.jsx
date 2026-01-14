import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';

/**
 * MicroTileView - Zoomed view of A micro tile (64×16) with reverse swizzling
 * Shows element-level addressing and bank assignments
 */
const MicroTileView = ({ microTile = { startRow: 0, startCol: 0 }, isSwizzled = true }) => {
    const [hoveredCell, setHoveredCell] = useState(null);
    const [showAddresses, setShowAddresses] = useState(false);

    // Micro tile dimensions
    const MICRO_ROWS = 64;
    const MICRO_COLS = 16;
    const BYTES_PER_ELEM = 2; // bf16
    const SWIZZLE_BYTES = 128;
    const SWIZZLE_REPEAT = SWIZZLE_BYTES * 8; // 1024
    const SUBTILE_COLS = SWIZZLE_BYTES / BYTES_PER_ELEM; // 64

    // Parent tile dimensions (for address calculation)
    const PARENT_ROWS = 128;

    // Calculate the idx function from ThunderKittens
    const calculateAddress = (row, col, baseAddr = 0) => {
        const r = row;
        const c = col;
        const outer_idx = Math.floor(c / SUBTILE_COLS);
        const linearAddr = baseAddr + BYTES_PER_ELEM * (
            outer_idx * PARENT_ROWS * SUBTILE_COLS +
            r * SUBTILE_COLS +
            c % SUBTILE_COLS
        );
        return linearAddr;
    };

    const calculateSwizzle = (addr) => {
        const swizzle = ((addr % SWIZZLE_REPEAT) >> 7) << 4;
        return swizzle;
    };

    const calculateSwizzledAddress = (row, col, baseAddr = 0) => {
        const linearAddr = calculateAddress(row, col, baseAddr);
        const swizzle = calculateSwizzle(linearAddr);
        return linearAddr ^ swizzle;
    };

    // Get bank from address (32 banks, 4 bytes each)
    const getBankFromAddr = (addr) => (addr >> 2) & 0x1F;

    // Generate color for bank (0-31)
    const getBankColor = (bank) => {
        const hue = (bank * 11.25) % 360;
        const saturation = 65 + (bank % 4) * 8;
        const lightness = 40 + ((bank >> 2) % 4) * 5;
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    };

    // Generate the grid data
    const gridData = useMemo(() => {
        const data = [];
        for (let row = 0; row < MICRO_ROWS; row++) {
            const rowData = [];
            for (let col = 0; col < MICRO_COLS; col++) {
                const globalRow = microTile.startRow + row;
                const globalCol = microTile.startCol + col;
                const linearAddr = calculateAddress(globalRow, globalCol);
                const swizzle = calculateSwizzle(linearAddr);
                const swizzledAddr = linearAddr ^ swizzle;
                const linearBank = getBankFromAddr(linearAddr);
                const swizzledBank = getBankFromAddr(swizzledAddr);

                rowData.push({
                    row,
                    col,
                    globalRow,
                    globalCol,
                    linearAddr,
                    swizzle,
                    swizzledAddr,
                    linearBank,
                    swizzledBank,
                    phase: Math.floor(linearAddr / SWIZZLE_BYTES) & 0x7,
                });
            }
            data.push(rowData);
        }
        return data;
    }, [microTile.startRow, microTile.startCol]);

    // Check for bank conflicts in a column
    const getColumnBanks = (col) => {
        const banks = new Set();
        const conflicts = [];
        for (let row = 0; row < MICRO_ROWS; row++) {
            const cell = gridData[row][col];
            const bank = isSwizzled ? cell.swizzledBank : cell.linearBank;
            if (banks.has(bank)) {
                conflicts.push(row);
            }
            banks.add(bank);
        }
        return { uniqueBanks: banks.size, hasConflicts: conflicts.length > 0 };
    };

    return (
        <div className="flex flex-col items-center gap-4">
            {/* Header */}
            <div className="text-center">
                <h3 className="text-lg font-mono text-nvidia-green mb-1">
                    A Micro Tile (64×16)
                </h3>
                <p className="text-xs text-gray-500">
                    Rows {microTile.startRow}-{microTile.startRow + MICRO_ROWS - 1},
                    Cols {microTile.startCol}-{microTile.startCol + MICRO_COLS - 1}
                </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-6">
                {/* Swizzle toggle info */}
                <div className={`px-3 py-1 rounded text-xs font-mono ${isSwizzled
                    ? 'bg-nvidia-green/20 text-nvidia-green border border-nvidia-green/30'
                    : 'bg-conflict-red/20 text-conflict-red border border-conflict-red/30'
                    }`}>
                    {isSwizzled ? '✓ Swizzled addressing' : '✗ Linear addressing'}
                </div>

                {/* Show addresses toggle */}
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showAddresses}
                        onChange={(e) => setShowAddresses(e.target.checked)}
                        className="accent-nvidia-green"
                    />
                    Show addresses
                </label>
            </div>

            {/* Grid visualization - scrollable container for space saving */}
            <div className="relative max-w-full">
                {/* Scroll container with fixed height */}
                <div
                    className="overflow-auto max-h-80 border border-gray-700 rounded-lg bg-bg-card"
                    style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#76b900 #1a1a2e',
                    }}
                >
                    {/* Inner grid wrapper */}
                    <div className="relative">
                        {/* Column headers - sticky at top, using grid to match cell layout */}
                        <div className="flex sticky top-0 bg-bg-card z-20 border-b border-gray-700/50 py-1">
                            {/* Spacer for row header column */}
                            <div className="w-8 flex-shrink-0" />
                            {/* Column header grid - matches cell grid exactly */}
                            <div
                                className="grid gap-px p-px"
                                style={{ gridTemplateColumns: `repeat(${MICRO_COLS}, 20px)` }}
                            >
                                {Array.from({ length: MICRO_COLS }, (_, i) => (
                                    <div
                                        key={i}
                                        className="w-5 h-4 flex items-center justify-center text-[7px] font-mono text-gray-500"
                                    >
                                        {microTile.startCol + i}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Grid with row headers */}
                        <div className="flex">
                            {/* Row headers - sticky at left, using grid to match cell row gaps */}
                            <div
                                className="grid gap-px sticky left-0 bg-bg-card z-10 p-px"
                                style={{ gridTemplateRows: `repeat(${MICRO_ROWS}, 14px)` }}
                            >
                                {Array.from({ length: MICRO_ROWS }, (_, i) => (
                                    <div
                                        key={i}
                                        className="w-8 flex items-center justify-end pr-1 text-[6px] font-mono text-gray-600"
                                    >
                                        {microTile.startRow + i}
                                    </div>
                                ))}
                            </div>

                            {/* Grid cells - smaller for compact view */}
                            <div
                                className="grid gap-px bg-gray-800 p-px rounded"
                                style={{ gridTemplateColumns: `repeat(${MICRO_COLS}, 20px)` }}
                                onMouseLeave={() => setHoveredCell(null)}
                            >
                                {gridData.flat().map((cell) => {
                                    const bank = isSwizzled ? cell.swizzledBank : cell.linearBank;
                                    const isHovered = hoveredCell?.row === cell.row && hoveredCell?.col === cell.col;

                                    return (
                                        <div
                                            key={`${cell.row}-${cell.col}`}
                                            className={`w-5 h-3.5 flex items-center justify-center text-[5px] font-mono font-bold cursor-pointer
                                                ${isHovered ? 'ring-1 ring-white z-20' : ''}`}
                                            style={{
                                                backgroundColor: getBankColor(bank),
                                                opacity: isHovered ? 1 : 0.85,
                                            }}
                                            onMouseEnter={() => setHoveredCell(cell)}
                                        >
                                            <span className="text-white drop-shadow-sm">
                                                {showAddresses ? (cell.linearAddr % 256).toString(16) : bank}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scroll hint */}
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-bg-card to-transparent pointer-events-none rounded-b-lg" />
                <div className="text-center mt-1 text-[9px] text-gray-600 font-mono">↕ Scroll to view all 64 rows</div>
            </div>

            {/* Hover tooltip */}
            {hoveredCell && (
                <div className="p-4 bg-bg-elevated border border-nvidia-green/50 rounded-lg shadow-lg min-w-64">
                    <div className="font-mono text-xs space-y-2">
                        <div className="text-gray-400 border-b border-gray-700 pb-1 mb-2">
                            Cell [{hoveredCell.globalRow}, {hoveredCell.globalCol}]
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <span className="text-gray-500">Linear Addr:</span>
                            <span className="text-white font-bold">0x{hoveredCell.linearAddr.toString(16)}</span>

                            <span className="text-gray-500">Swizzle XOR:</span>
                            <span className="text-cyber-purple">0x{hoveredCell.swizzle.toString(16).padStart(2, '0')}</span>

                            <span className="text-gray-500">Final Addr:</span>
                            <span className="text-nvidia-green font-bold">0x{hoveredCell.swizzledAddr.toString(16)}</span>

                            <span className="text-gray-500">Linear Bank:</span>
                            <span className="text-white">{hoveredCell.linearBank}</span>

                            <span className="text-gray-500">Swizzled Bank:</span>
                            <span className="text-nvidia-green font-bold">{hoveredCell.swizzledBank}</span>

                            <span className="text-gray-500">Phase:</span>
                            <span className="text-cyber-blue">{hoveredCell.phase}</span>
                        </div>

                        {/* Bit visualization */}
                        <div className="mt-2 pt-2 border-t border-gray-700">
                            <div className="text-[10px] text-gray-500 mb-1">Address bits:</div>
                            <div className="flex gap-1 font-mono text-[9px]">
                                <span className="text-gray-600">[</span>
                                <span className="text-gray-400">{(hoveredCell.linearAddr >> 8).toString(2).padStart(8, '0')}</span>
                                <span className="text-nvidia-green">{((hoveredCell.linearAddr >> 4) & 0xF).toString(2).padStart(4, '0')}</span>
                                <span className="text-cyber-purple">{(hoveredCell.linearAddr & 0xF).toString(2).padStart(4, '0')}</span>
                                <span className="text-gray-600">]</span>
                            </div>
                            <div className="text-[8px] text-gray-600 mt-0.5">
                                {'               '}bank bits{'    '}offset
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend - compact bank colors */}
            <div className="flex flex-wrap gap-0.5 justify-center max-w-[500px]">
                {Array.from({ length: 32 }, (_, i) => (
                    <div
                        key={i}
                        className="w-4 h-3 rounded text-[6px] font-mono font-bold flex items-center justify-center"
                        style={{ backgroundColor: getBankColor(i) }}
                    >
                        <span className="text-white drop-shadow-sm">{i}</span>
                    </div>
                ))}
            </div>

            {/* idx() code breakdown */}
            <div className="p-3 bg-bg-card border border-gray-700 rounded text-xs font-mono max-w-lg">
                <div className="text-gray-500 mb-2">// ThunderKittens idx() - reverse swizzle</div>
                <pre className="text-[10px] leading-relaxed">
                    <span className="text-gray-400">outer_idx</span> = c / 64 = <span className="text-nvidia-green">{Math.floor(microTile.startCol / SUBTILE_COLS)}</span>{'\n'}
                    <span className="text-gray-400">addr</span> = outer_idx×128×64 + r×64 + c%64{'\n'}
                    <span className="text-gray-400">swizzle</span> = ((addr % 1024) {'>'}{'>'}7) {'<'}{'<'}4{'\n'}
                    <span className="text-gray-400">final</span> = addr ^ swizzle
                </pre>
            </div>
        </div>
    );
};

export default MicroTileView;
