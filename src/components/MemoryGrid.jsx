import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateMemoryGrid, getBankColor } from '../utils/swizzle';

const MemoryGrid = ({ isSwizzled, onToggle, highlightColumn = null }) => {
    const [hoveredCell, setHoveredCell] = useState(null);
    const grid = useMemo(() => generateMemoryGrid(0), []);

    // Check for bank conflicts in a column
    const getConflictingCells = (col) => {
        if (col === null) return [];
        const columnCells = grid.map(row => row[col]);
        const bankCounts = {};

        columnCells.forEach(cell => {
            const bank = isSwizzled ? cell.swizzledBank : cell.linearBank;
            bankCounts[bank] = (bankCounts[bank] || 0) + 1;
        });

        return columnCells.filter(cell => {
            const bank = isSwizzled ? cell.swizzledBank : cell.linearBank;
            return bankCounts[bank] > 1;
        });
    };

    const conflictingCells = useMemo(
        () => getConflictingCells(highlightColumn),
        [highlightColumn, isSwizzled, grid]
    );

    const hasConflict = !isSwizzled && conflictingCells.length > 0;

    return (
        <div className="flex flex-col items-center gap-4">
            {/* Toggle Switch */}
            <div className="flex items-center gap-4">
                <span className={`font-mono text-sm transition-colors ${!isSwizzled ? 'text-conflict-red' : 'text-gray-500'}`}>
                    Linear
                </span>
                <button
                    onClick={() => onToggle(!isSwizzled)}
                    className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${isSwizzled ? 'bg-nvidia-green' : 'bg-gray-600'
                        }`}
                >
                    <motion.div
                        className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                        animate={{ left: isSwizzled ? '32px' : '4px' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                </button>
                <span className={`font-mono text-sm transition-colors ${isSwizzled ? 'text-nvidia-green' : 'text-gray-500'}`}>
                    Swizzled
                </span>
            </div>

            {/* Status indicator */}
            <div className={`px-3 py-1 rounded text-xs font-mono text-center ${isSwizzled
                ? 'bg-nvidia-green/20 text-nvidia-green border border-nvidia-green/30'
                : 'bg-conflict-red/20 text-conflict-red border border-conflict-red/30'
                }`}>
                {isSwizzled
                    ? '✓ XOR swizzle pattern: 32 banks conflict-free'
                    : '✗ Linear: Bank conflicts on column access'}
            </div>

            {/* Memory Grid - Compact */}
            <div className="relative">
                {/* Column Headers */}
                <div className="flex ml-10">
                    {Array.from({ length: 32 }, (_, i) => (
                        <div
                            key={i}
                            className={`w-5 h-5 flex items-center justify-center text-[8px] font-mono ${highlightColumn === i ? 'text-white font-bold' : 'text-gray-600'
                                }`}
                        >
                            {i}
                        </div>
                    ))}
                </div>

                {/* Grid with Row Headers */}
                <div className="flex">
                    {/* Row Headers */}
                    <div className="flex flex-col">
                        {Array.from({ length: 16 }, (_, i) => (
                            <div
                                key={i}
                                className="w-10 h-5 flex items-center justify-end pr-2 text-[8px] font-mono text-gray-600"
                            >
                                {i}
                            </div>
                        ))}
                    </div>

                    {/* Grid Cells */}
                    <div
                        className="grid gap-px bg-gray-800 p-px rounded"
                        style={{ gridTemplateColumns: 'repeat(32, 20px)' }}
                    >
                        {grid.flat().map((cell) => {
                            const bank = isSwizzled ? cell.swizzledBank : cell.linearBank;
                            const isHighlighted = highlightColumn === cell.col;
                            const isHovered = hoveredCell?.row === cell.row && hoveredCell?.col === cell.col;

                            return (
                                <div
                                    key={`${cell.row}-${cell.col}`}
                                    className={`
                                        w-5 h-5 flex items-center justify-center text-[7px] font-mono font-bold
                                        cursor-pointer transition-opacity duration-200
                                        ${isHighlighted ? 'ring-1 ring-white' : ''}
                                        ${isHovered ? 'ring-1 ring-white' : ''}
                                    `}
                                    style={{
                                        backgroundColor: getBankColor(bank),
                                        opacity: isHighlighted || isHovered ? 1 : 0.8,
                                    }}
                                    onMouseEnter={() => setHoveredCell(cell)}
                                    onMouseLeave={() => setHoveredCell(null)}
                                >
                                    <span className="text-white drop-shadow-sm">{bank}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Hover Tooltip */}
                <AnimatePresence>
                    {hoveredCell && (
                        <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="absolute left-full ml-3 top-0 p-3 bg-bg-elevated border border-nvidia-green/50 rounded-lg shadow-lg z-20 min-w-48"
                        >
                            <div className="font-mono text-xs space-y-1">
                                <div className="text-gray-400">
                                    Cell [{hoveredCell.row}, {hoveredCell.col}]
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Linear:</span>
                                    <span className="text-white">Bank {hoveredCell.linearBank}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Swizzled:</span>
                                    <span className="text-nvidia-green">Bank {hoveredCell.swizzledBank}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Phase:</span>
                                    <span className="text-cyber-blue">{hoveredCell.swizzleGroup}</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bank Legend - Compact 32 banks */}
            <div className="flex flex-wrap gap-0.5 justify-center max-w-[680px] mt-2">
                {Array.from({ length: 32 }, (_, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-center w-5 h-4 rounded text-[7px] font-mono font-bold"
                        style={{ backgroundColor: getBankColor(i) }}
                    >
                        <span className="text-white drop-shadow-sm">{i}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MemoryGrid;
