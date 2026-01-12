import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * SharedMemoryOverview - Big picture view of A and B tiles in shared memory
 * A tile: 128 rows × 64 cols (bf16)
 * B tile: 64 rows × 256 cols (bf16)
 * Shows 128-byte swizzle boundaries
 */
const SharedMemoryOverview = ({ onSelectMicroTile }) => {
    const [hoveredRegion, setHoveredRegion] = useState(null);
    const [selectedMicroTile, setSelectedMicroTile] = useState({ row: 0, col: 0 });

    // Tile dimensions (in elements, bf16 = 2 bytes each)
    const tileA = { rows: 128, cols: 64, color: 'nvidia-green', label: 'Matrix A' };
    const tileB = { rows: 64, cols: 256, color: 'cyber-blue', label: 'Matrix B' };

    // 128-byte swizzle boundary = 64 bf16 elements per "subtile"
    const SWIZZLE_COLS = 64;

    // Calculate how many 128B subtiles each tile has
    const aSubtiles = Math.ceil(tileA.cols / SWIZZLE_COLS); // 1 subtile
    const bSubtiles = Math.ceil(tileB.cols / SWIZZLE_COLS); // 4 subtiles

    // Micro tile dimensions (what we'll zoom into)
    const MICRO_ROWS = 64;
    const MICRO_COLS = 16;

    // Generate micro tile grid for A tile
    const microTileGridA = useMemo(() => {
        const grid = [];
        const microTileRows = Math.ceil(tileA.rows / MICRO_ROWS); // 2
        const microTileCols = Math.ceil(tileA.cols / MICRO_COLS); // 4
        for (let r = 0; r < microTileRows; r++) {
            for (let c = 0; c < microTileCols; c++) {
                grid.push({
                    row: r,
                    col: c,
                    startRow: r * MICRO_ROWS,
                    startCol: c * MICRO_COLS,
                    endRow: Math.min((r + 1) * MICRO_ROWS, tileA.rows),
                    endCol: Math.min((c + 1) * MICRO_COLS, tileA.cols),
                });
            }
        }
        return grid;
    }, []);

    const handleMicroTileClick = (microTile) => {
        setSelectedMicroTile({ row: microTile.row, col: microTile.col });
        if (onSelectMicroTile) {
            onSelectMicroTile(microTile);
        }
    };

    return (
        <div className="flex flex-col items-center gap-6">
            {/* Title */}
            <div className="text-center">
                <h3 className="text-lg font-mono text-nvidia-green mb-1">Shared Memory Layout</h3>
                <p className="text-xs text-gray-500">128-byte swizzle boundaries shown as dashed lines</p>
            </div>

            {/* Memory Layout Visualization */}
            <div className="flex gap-8 items-start">
                {/* Matrix A */}
                <div className="flex flex-col items-center">
                    <div className="text-sm font-mono text-nvidia-green mb-2">
                        Matrix A (128×64)
                    </div>
                    <div
                        className="relative border-2 border-nvidia-green/60 rounded bg-nvidia-green/10"
                        style={{ width: '160px', height: '320px' }}
                    >
                        {/* Swizzle boundary line at 64 cols (only one subtile, so at edge) */}
                        <div
                            className="absolute top-0 bottom-0 border-l-2 border-dashed border-nvidia-green/40"
                            style={{ left: '100%' }}
                        />

                        {/* Micro tile grid overlay */}
                        <div className="absolute inset-0 grid" style={{
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gridTemplateRows: 'repeat(2, 1fr)',
                        }}>
                            {microTileGridA.map((mt) => (
                                <motion.div
                                    key={`${mt.row}-${mt.col}`}
                                    className={`border border-nvidia-green/30 cursor-pointer flex items-center justify-center text-[8px] font-mono
                                        ${selectedMicroTile.row === mt.row && selectedMicroTile.col === mt.col
                                            ? 'bg-nvidia-green/40 border-nvidia-green'
                                            : 'hover:bg-nvidia-green/20'}`}
                                    onClick={() => handleMicroTileClick(mt)}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="text-nvidia-green/80">
                                        {mt.startRow}-{mt.endRow - 1}
                                        <br />
                                        ×{mt.startCol}-{mt.endCol - 1}
                                    </span>
                                </motion.div>
                            ))}
                        </div>

                        {/* Dimension labels */}
                        <div className="absolute -left-8 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-mono -rotate-90">
                            128 rows
                        </div>
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 font-mono">
                            64 cols
                        </div>
                    </div>

                    {/* A tile details */}
                    <div className="mt-4 p-2 bg-bg-card rounded text-[10px] font-mono text-gray-400">
                        <div>bf16: 2 bytes/elem</div>
                        <div>Row stride: 128 bytes</div>
                        <div>1× 128B subtile wide</div>
                    </div>
                </div>

                {/* Matrix B */}
                <div className="flex flex-col items-center">
                    <div className="text-sm font-mono text-cyber-blue mb-2">
                        Matrix B (64×256)
                    </div>
                    <div
                        className="relative border-2 border-cyber-blue/60 rounded bg-cyber-blue/10"
                        style={{ width: '320px', height: '160px' }}
                    >
                        {/* Swizzle boundary lines every 64 cols */}
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="absolute top-0 bottom-0 border-l-2 border-dashed border-cyber-blue/40"
                                style={{ left: `${(i / 4) * 100}%` }}
                            />
                        ))}

                        {/* Subtile labels */}
                        <div className="absolute inset-0 grid grid-cols-4">
                            {[0, 1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-center text-[10px] font-mono text-cyber-blue/60"
                                >
                                    128B#{i}
                                </div>
                            ))}
                        </div>

                        {/* Dimension labels */}
                        <div className="absolute -left-8 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-mono -rotate-90">
                            64 rows
                        </div>
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 font-mono">
                            256 cols (4× 128B subtiles)
                        </div>
                    </div>

                    {/* B tile details */}
                    <div className="mt-4 p-2 bg-bg-card rounded text-[10px] font-mono text-gray-400">
                        <div>bf16: 2 bytes/elem</div>
                        <div>Row stride: 512 bytes</div>
                        <div>4× 128B subtiles wide</div>
                    </div>
                </div>
            </div>

            {/* Selected micro tile indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-2 bg-nvidia-green/20 border border-nvidia-green/40 rounded-lg text-sm font-mono"
            >
                <span className="text-gray-400">Selected A Micro Tile: </span>
                <span className="text-nvidia-green">
                    rows {selectedMicroTile.row * MICRO_ROWS}-{(selectedMicroTile.row + 1) * MICRO_ROWS - 1},
                    cols {selectedMicroTile.col * MICRO_COLS}-{(selectedMicroTile.col + 1) * MICRO_COLS - 1}
                </span>
            </motion.div>

            {/* Swizzle formula reminder */}
            <div className="p-3 bg-bg-card border border-gray-700 rounded text-center max-w-lg">
                <div className="text-xs text-gray-500 font-mono mb-1">ThunderKittens idx() formula:</div>
                <code className="text-nvidia-green text-sm">
                    addr = outer_idx×rows×64 + r×64 + c%64
                    <br />
                    swizzle = ((addr % 1024) {'>'}{'>'}7) {'<'}{'<'}4
                    <br />
                    final = addr ^ swizzle
                </code>
            </div>
        </div>
    );
};

export default SharedMemoryOverview;
