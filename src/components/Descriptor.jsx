import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Descriptor = ({ isActive = false, onFieldHover }) => {
    const [hoveredField, setHoveredField] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

    // 64-bit descriptor fields based on NVIDIA PTX ISA
    // Reference: matrix_descriptor_encode in ThunderKittens
    const fields = [
        {
            name: 'Base Address',
            bits: '0-13',
            start: 0,
            length: 14,
            color: 'bg-cyber-blue',
            description: 'Shared memory base address bits. Encoded as (smem_ptr >> 4) & 0x3FFF. Points to tile start.'
        },
        {
            name: 'Leading Dim (byte)',
            bits: '16-29',
            start: 16,
            length: 14,
            color: 'bg-cyber-purple',
            description: 'Leading dimension in bytes (stride between rows). Typically 128 or 256 for swizzled layouts.'
        },
        {
            name: 'Stride Dim',
            bits: '32-45',
            start: 32,
            length: 14,
            color: 'bg-nvidia-green',
            description: 'Stride dimension. For WGMMA this encodes the outer-product iteration stride.'
        },
        {
            name: 'Base Offset',
            bits: '49-52',
            start: 49,
            length: 4,
            color: 'bg-yellow-500',
            description: 'Base offset for stacked tiles. Used when multiple tiles share descriptor.'
        },
        {
            name: 'Swizzle Mode',
            bits: '62-63',
            start: 62,
            length: 2,
            color: 'bg-conflict-red',
            description: '0=none, 1=128B, 2=64B, 3=32B. Critical! Tells hardware how to decode addresses.'
        },
    ];

    const handleMouseEnter = (field, event) => {
        setHoveredField(field);
        const rect = event.currentTarget.getBoundingClientRect();
        setTooltipPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 10
        });
        onFieldHover?.(field.name);
    };

    const handleMouseLeave = () => {
        setHoveredField(null);
        onFieldHover?.(null);
    };

    // Generate bit visualization - grouped by nibbles for readability
    const renderBits = () => {
        const bits = [];
        for (let i = 63; i >= 0; i--) {
            const field = fields.find(f => i >= f.start && i < f.start + f.length);
            const isHovered = hoveredField && i >= hoveredField.start && i < hoveredField.start + hoveredField.length;
            const isNibbleBoundary = i % 4 === 0 && i !== 0;

            bits.push(
                <motion.div
                    key={i}
                    className={`
                        w-2.5 h-6 flex items-center justify-center text-[7px] font-mono
                        ${field?.color || 'bg-gray-700'} 
                        ${isHovered ? 'ring-1 ring-white z-10' : ''}
                        ${isNibbleBoundary ? 'ml-0.5' : ''}
                        transition-all duration-150
                    `}
                    animate={{
                        scale: isHovered ? 1.15 : 1,
                        opacity: hoveredField && !isHovered ? 0.3 : 1,
                    }}
                    onMouseEnter={(e) => field && handleMouseEnter(field, e)}
                    onMouseLeave={handleMouseLeave}
                />
            );
        }
        return bits;
    };

    return (
        <div className="flex flex-col items-center gap-6">
            {/* Descriptor Label */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
            >
                <h3 className="text-xl font-mono text-nvidia-green text-glow-green mb-1">
                    st_descriptor (64-bit)
                </h3>
                <p className="text-sm text-gray-400">
                    The "Golden Ticket" - Tensor Core's permission to read from Shared Memory
                </p>
            </motion.div>

            {/* 64-bit Packet Visualization */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative"
            >
                {/* Glowing container */}
                <div className="absolute -inset-3 bg-gradient-to-r from-nvidia-green/20 via-cyber-blue/20 to-cyber-purple/20 rounded-lg blur-lg" />

                {/* Bit strip */}
                <div className="relative flex rounded overflow-hidden border border-nvidia-green/50">
                    {renderBits()}
                </div>

                {/* Bit range labels */}
                <div className="flex justify-between mt-1 text-[10px] font-mono text-gray-500">
                    <span>63</span>
                    <span>0</span>
                </div>
            </motion.div>

            {/* Field Legend */}
            <motion.div
                className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                {fields.map((field) => (
                    <motion.div
                        key={field.name}
                        className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-left
                            ${hoveredField?.name === field.name ? 'ring-2 ring-white bg-bg-elevated' : 'bg-bg-card'}
                            transition-all duration-200
                        `}
                        whileHover={{ scale: 1.02 }}
                        onMouseEnter={(e) => handleMouseEnter(field, e)}
                        onMouseLeave={handleMouseLeave}
                    >
                        <div className={`w-3 h-3 rounded flex-shrink-0 ${field.color}`} />
                        <div>
                            <div className="text-xs font-mono text-white">{field.name}</div>
                            <div className="text-[10px] text-gray-500">[{field.bits}]</div>
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            {/* Tooltip */}
            <AnimatePresence>
                {hoveredField && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="fixed z-50 px-4 py-3 bg-bg-elevated border border-nvidia-green rounded-lg shadow-glow-green max-w-xs"
                        style={{
                            left: tooltipPosition.x,
                            top: tooltipPosition.y,
                            transform: 'translate(-50%, -100%)',
                        }}
                    >
                        <div className="font-mono text-sm text-nvidia-green mb-1">{hoveredField.name}</div>
                        <div className="text-xs text-gray-300">{hoveredField.description}</div>
                        {hoveredField.name === 'Swizzle Mode' && (
                            <div className="mt-2 p-2 bg-gray-800 rounded text-[10px] font-mono text-conflict-red">
                                desc |= 1ULL {'<<'} 62; // 128B
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* C++ Code Reference */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="p-3 bg-bg-card rounded-lg border border-gray-800 font-mono text-xs max-w-lg"
            >
                <div className="text-gray-500 mb-1">// ThunderKittens descriptor encoding</div>
                <div>
                    <span className="text-cyber-purple">desc</span>
                    <span className="text-white"> = </span>
                    <span className="text-cyber-blue">matrix_descriptor_encode</span>
                    <span className="text-white">(</span>
                    <span className="text-nvidia-green">&tile[0]</span>
                    <span className="text-white">);</span>
                </div>
                <div className="mt-1">
                    <span className="text-cyber-purple">desc</span>
                    <span className="text-white"> |= </span>
                    <span className="text-conflict-red">1ULL {'<<'} 62</span>
                    <span className="text-gray-500">; // 128B swizzle</span>
                </div>
            </motion.div>
        </div>
    );
};

export default Descriptor;
