import React from 'react';
import { motion } from 'framer-motion';

const CodeOverlay = ({ code, highlights = [], showBitVisualization = false }) => {
    // Parse and highlight code
    const highlightCode = (text) => {
        const tokens = [];
        let remaining = text;
        let index = 0;

        const patterns = [
            { regex: /\/\/.*$/gm, className: 'code-comment' },
            { regex: /\b(const|int|uint64_t|return|static|constexpr)\b/g, className: 'code-keyword' },
            { regex: /\b(0x[0-9a-fA-F]+|\d+)\b/g, className: 'code-number' },
            { regex: /(\^|>>|<<|&|\|)/g, className: 'code-operator' },
        ];

        // Simple tokenization - split by spaces and operators while preserving them
        const parts = text.split(/(\s+|[(){}[\],;])/);

        return parts.map((part, i) => {
            const isHighlighted = highlights.some(h => part.includes(h));
            let className = '';

            // Check patterns
            for (const { regex, className: cls } of patterns) {
                if (new RegExp(regex.source).test(part)) {
                    className = cls;
                    break;
                }
            }

            if (isHighlighted) {
                return (
                    <span key={i} className={`${className} code-highlight`}>
                        {part}
                    </span>
                );
            }

            return (
                <span key={i} className={className}>
                    {part}
                </span>
            );
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="code-block relative overflow-hidden"
        >
            {/* Scan line effect */}
            <div className="scan-overlay">
                <div className="scan-line" />
            </div>

            {/* Code content */}
            <pre className="relative z-10 whitespace-pre-wrap">
                <code>{highlightCode(code)}</code>
            </pre>

            {/* Bit visualization */}
            {showBitVisualization && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 pt-4 border-t border-gray-700"
                >
                    <BitVisualization />
                </motion.div>
            )}
        </motion.div>
    );
};

const BitVisualization = () => {
    const exampleAddr = 0x180; // Example address for visualization
    const bits = (exampleAddr >>> 0).toString(2).padStart(16, '0').split('').reverse();

    // Highlight groups: bits 4-6 (bank) and bits 7-9 (row)
    const getBitColor = (index) => {
        if (index >= 4 && index <= 6) return 'bg-cyber-blue'; // Bank bits
        if (index >= 7 && index <= 9) return 'bg-cyber-purple'; // Row bits  
        return 'bg-gray-700';
    };

    const getBitGlow = (index) => {
        if (index >= 4 && index <= 6) return 'shadow-glow-blue';
        if (index >= 7 && index <= 9) return 'shadow-glow-purple';
        return '';
    };

    return (
        <div className="space-y-3">
            <div className="text-xs text-gray-400 font-mono">
                Address: 0x{exampleAddr.toString(16).toUpperCase()} = {exampleAddr}
            </div>

            {/* Bit display */}
            <div className="flex gap-0.5 flex-row-reverse">
                {bits.map((bit, i) => (
                    <motion.div
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={`
              w-6 h-8 flex flex-col items-center justify-center rounded text-xs font-mono
              ${getBitColor(i)} ${getBitGlow(i)}
            `}
                    >
                        <span className="text-white">{bit}</span>
                        <span className="text-white/50 text-[8px]">{i}</span>
                    </motion.div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex gap-4 text-xs font-mono">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-cyber-blue" />
                    <span className="text-gray-400">Bits 4-6 (Bank)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-cyber-purple" />
                    <span className="text-gray-400">Bits 7-9 (Row)</span>
                </div>
            </div>

            {/* XOR Operation Visualization */}
            <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                <div className="text-xs font-mono space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-32">addr >> 7:</span>
                        <span className="text-cyber-purple">{(exampleAddr >> 7).toString(2).padStart(8, '0')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-32">(addr >> 7) {'<<'} 4:</span>
                        <span className="text-nvidia-green">{((exampleAddr >> 7) << 4).toString(2).padStart(8, '0')}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
                        <span className="text-gray-500 w-32">addr ^ swizzle:</span>
                        <span className="text-nvidia-green">{(exampleAddr ^ ((exampleAddr >> 7) << 4)).toString(2).padStart(16, '0')}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CodeOverlay;
