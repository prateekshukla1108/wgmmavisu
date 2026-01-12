import React, { useState, useRef } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import ScrollSection from './components/ScrollSection';
import MemoryGrid from './components/MemoryGrid';
import SharedMemoryOverview from './components/SharedMemoryOverview';
import MicroTileView from './components/MicroTileView';
import CodeOverlay from './components/CodeOverlay';
import Descriptor from './components/Descriptor';
import LdMatrix from './components/LdMatrix';
import TensorCore from './components/TensorCore';
import Stmatrix from './components/Stmatrix';

function App() {
    const [isSwizzled, setIsSwizzled] = useState(true);
    const [highlightColumn, setHighlightColumn] = useState(2);
    const [activeSection, setActiveSection] = useState(0);
    const [selectedMicroTile, setSelectedMicroTile] = useState({ startRow: 0, startCol: 0, row: 0, col: 0 });

    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll({ container: containerRef });

    // Navigation dots click handler
    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        element?.scrollIntoView({ behavior: 'smooth' });
    };

    const sections = [
        { id: 'intro', title: 'WGMMA Lifecycle' },
        { id: 'swizzle', title: 'Swizzled Layout' },
        { id: 'descriptor', title: 'The Descriptor' },
        { id: 'ldmatrix', title: 'ldmatrix (A→Regs)' },
        { id: 'execution', title: 'WGMMA Execution' },
        { id: 'writeback', title: 'Stmatrix' },
    ];

    const swizzleCode = `// ThunderKittens Swizzle Logic
const int swizzle_repeat = 1024; // 128B × 8 rows
const int swizzle = ((addr % swizzle_repeat) >> 7) << 4;
return (T*)(addr ^ swizzle);

// Bit manipulation breakdown:
// addr >> 7  → Extract bits 7-9 (row index)
// << 4       → Shift to bits 4-6 (bank bits)
// ^ swizzle  → XOR to distribute banks`;

    return (
        <div className="min-h-screen bg-bg-dark text-white overflow-x-hidden">
            {/* Navigation Sidebar - hidden on mobile */}
            <nav className="fixed left-4 top-1/2 -translate-y-1/2 z-50 hidden md:flex flex-col gap-3">
                {sections.map((section, i) => (
                    <motion.button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className="group flex items-center gap-3"
                        whileHover={{ x: 5 }}
                    >
                        <motion.div
                            className="w-3 h-3 rounded-full border-2 border-nvidia-green transition-all duration-300"
                            animate={{
                                backgroundColor: activeSection === i ? 'rgba(118, 185, 0, 1)' : 'transparent',
                                scale: activeSection === i ? 1.2 : 1,
                            }}
                        />
                        <span className="text-xs font-mono text-gray-500 group-hover:text-nvidia-green opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {section.title}
                        </span>
                    </motion.button>
                ))}
            </nav>

            {/* Progress Bar */}
            <motion.div
                className="fixed top-0 left-0 right-0 h-1 bg-nvidia-green origin-left z-50"
                style={{ scaleX: scrollYProgress }}
            />

            {/* Hero Section */}
            <section id="intro" className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
                {/* Background grid effect */}
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `linear-gradient(rgba(118, 185, 0, 0.3) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(118, 185, 0, 0.3) 1px, transparent 1px)`,
                        backgroundSize: '50px 50px',
                    }} />
                </div>

                {/* Floating particles */}
                {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-nvidia-green rounded-full"
                        initial={{
                            x: Math.random() * window.innerWidth,
                            y: Math.random() * window.innerHeight,
                            opacity: 0.3,
                        }}
                        animate={{
                            y: [null, Math.random() * -200],
                            opacity: [0.3, 0.8, 0.3],
                        }}
                        transition={{
                            duration: 3 + Math.random() * 2,
                            repeat: Infinity,
                            delay: Math.random() * 2,
                        }}
                    />
                ))}

                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1 }}
                    className="text-center z-10"
                >
                    <motion.h1
                        className="text-6xl md:text-8xl font-bold font-mono mb-4"
                        style={{
                            background: 'linear-gradient(135deg, #76b900 0%, #00c8ff 50%, #b464ff 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        WGMMA
                    </motion.h1>
                    <motion.p
                        className="text-xl md:text-2xl text-gray-400 font-mono mb-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        Warpgroup Matrix Multiply-Accumulate
                    </motion.p>
                    <motion.p
                        className="text-lg text-gray-500 mb-8"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        A visual journey through NVIDIA Hopper's Tensor Core pipeline
                    </motion.p>

                    {/* Architecture badges */}
                    <motion.div
                        className="flex gap-4 justify-center flex-wrap"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                    >
                        {['Hopper SM90', 'Tensor Core', 'ldmatrix', 'stmatrix', 'Swizzle'].map((badge, i) => (
                            <span
                                key={badge}
                                className="px-3 py-1 bg-bg-card border border-gray-700 rounded-full text-sm font-mono text-gray-300"
                            >
                                {badge}
                            </span>
                        ))}
                    </motion.div>
                </motion.div>

                {/* Scroll indicator */}
                <motion.div
                    className="absolute bottom-8 flex flex-col items-center gap-2"
                    animate={{ y: [0, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                >
                    <span className="text-sm text-gray-500 font-mono">Scroll to explore</span>
                    <svg className="w-6 h-6 text-nvidia-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                </motion.div>
            </section>

            {/* Section 1: Swizzled Layout */}
            <ScrollSection
                id="swizzle"
                title="1. The Swizzled Layout"
                subtitle="Why memory arrangement matters for avoiding bank conflicts and maximizing throughput"
            >
                {/* Part 1: Big Picture - Shared Memory Layout */}
                <div className="mb-16">
                    <SharedMemoryOverview
                        onSelectMicroTile={(mt) => setSelectedMicroTile(mt)}
                    />
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4 my-8">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-nvidia-green/50 to-transparent" />
                    <span className="text-sm font-mono text-gray-500">Scroll for micro tile details</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-nvidia-green/50 to-transparent" />
                </div>

                {/* Part 2: Zoomed Micro Tile View */}
                <div className="grid lg:grid-cols-2 gap-8 items-start">
                    {/* Left: Micro Tile Grid */}
                    <div className="flex flex-col items-center">
                        <MicroTileView
                            microTile={selectedMicroTile}
                            isSwizzled={isSwizzled}
                        />

                        {/* Swizzle toggle */}
                        <div className="mt-6 flex items-center gap-4">
                            <span className={`font-mono text-sm transition-colors ${!isSwizzled ? 'text-conflict-red' : 'text-gray-500'}`}>
                                Linear
                            </span>
                            <button
                                onClick={() => setIsSwizzled(!isSwizzled)}
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
                    </div>

                    {/* Right: Code and explanation */}
                    <div className="space-y-6">
                        <CodeOverlay
                            code={swizzleCode}
                            highlights={['>> 7', '<< 4', '^']}
                            showBitVisualization={true}
                        />

                        {/* Key insight card */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="p-4 bg-bg-card border-l-4 border-nvidia-green rounded-r-lg"
                        >
                            <h4 className="text-nvidia-green font-mono font-semibold mb-2">The "Staircase" Effect</h4>
                            <p className="text-sm text-gray-300">
                                Without swizzling, vertical column accesses hit the same bank (conflict).
                                The XOR logic creates a "staircase" pattern where each row maps to a different bank,
                                enabling conflict-free parallel access.
                            </p>
                        </motion.div>

                        {/* Tile dimensions info */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="p-4 bg-bg-card border-l-4 border-cyber-blue rounded-r-lg"
                        >
                            <h4 className="text-cyber-blue font-mono font-semibold mb-2">WGMMA Tile Dimensions</h4>
                            <div className="text-xs font-mono text-gray-400 space-y-1">
                                <div>• <span className="text-nvidia-green">A tile:</span> 128×64 (bf16) → 2× micro tiles vertically</div>
                                <div>• <span className="text-cyber-blue">B tile:</span> 64×256 → 4× 128B subtiles horizontally</div>
                                <div>• <span className="text-cyber-purple">Micro tile:</span> 64×16 → what each warpgroup sees</div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </ScrollSection>

            {/* Section 2: The Descriptor */}
            <ScrollSection
                id="descriptor"
                title="2. The Golden Ticket"
                subtitle="How the 64-bit descriptor enables direct Tensor Core access to Shared Memory"
            >
                <Descriptor
                    isActive={activeSection === 2}
                    onFieldHover={(field) => console.log('Hovered:', field)}
                />

                {/* Metaphor explanation */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-12 max-w-2xl mx-auto text-center"
                >
                    <div className="text-5xl mb-4">🎫</div>
                    <h4 className="text-xl font-mono text-nvidia-green mb-3">The "Permission Slip"</h4>
                    <p className="text-gray-400">
                        The descriptor tells the Tensor Core exactly where to find data and how it's arranged.
                        For <span className="text-cyber-purple font-semibold">st_st mode</span>, both A and B use descriptors.
                        For <span className="text-nvidia-green font-semibold">rt_st mode</span>, A comes from registers (via ldmatrix).
                    </p>
                </motion.div>
            </ScrollSection>

            {/* Section 3: ldmatrix - Loading A to Registers */}
            <ScrollSection
                id="ldmatrix"
                title="3. The Load Path (rt_st Mode)"
                subtitle="Loading Matrix A from Shared Memory into Registers for the Register × Shared WGMMA mode"
            >
                <LdMatrix isAnimating={true} />

                {/* Mode comparison */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-12 grid md:grid-cols-2 gap-6 max-w-4xl mx-auto"
                >
                    <div className="p-4 bg-bg-card border border-nvidia-green/50 rounded-lg">
                        <h5 className="font-mono text-nvidia-green font-semibold mb-2">rt_st Mode (Register × Shared)</h5>
                        <ul className="text-sm text-gray-300 space-y-1">
                            <li>• A operand: <code className="text-nvidia-green">ldmatrix</code> → Registers</li>
                            <li>• B operand: Direct SMEM via descriptor</li>
                            <li>• Uses: {`{%64,%65,%66,%67}`} + b_st_desc</li>
                        </ul>
                    </div>
                    <div className="p-4 bg-bg-card border border-cyber-purple/50 rounded-lg">
                        <h5 className="font-mono text-cyber-purple font-semibold mb-2">st_st Mode (Shared × Shared)</h5>
                        <ul className="text-sm text-gray-300 space-y-1">
                            <li>• A operand: Direct SMEM via descriptor</li>
                            <li>• B operand: Direct SMEM via descriptor</li>
                            <li>• Uses: a_st_desc + b_st_desc</li>
                        </ul>
                    </div>
                </motion.div>
            </ScrollSection>

            {/* Section 4: WGMMA Execution */}
            <ScrollSection
                id="execution"
                title="4. The Engine"
                subtitle="Watch data flow to the Tensor Core - toggle between rt_st and st_st modes"
            >
                <div className="flex flex-col items-center">
                    <TensorCore isAnimating={true} />

                    {/* Key callouts */}
                    <div className="grid md:grid-cols-3 gap-6 mt-8 max-w-4xl">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="p-4 bg-bg-card border border-nvidia-green/50 rounded-lg text-center"
                        >
                            <div className="text-3xl mb-2">📥</div>
                            <h5 className="text-nvidia-green font-mono text-sm mb-1">Operand A</h5>
                            <p className="text-xs text-gray-400">From Registers (rt_st) or SMEM Descriptor (st_st)</p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="p-4 bg-bg-card border border-nvidia-green rounded-lg text-center shadow-glow-green"
                        >
                            <div className="text-3xl mb-2">⚡</div>
                            <h5 className="text-nvidia-green font-mono text-sm mb-1">wgmma.mma_async</h5>
                            <p className="text-xs text-gray-400">Hardware handles swizzle decode automatically</p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="p-4 bg-bg-card border border-cyber-blue/50 rounded-lg text-center"
                        >
                            <div className="text-3xl mb-2">📤</div>
                            <h5 className="text-cyber-blue font-mono text-sm mb-1">Operand B</h5>
                            <p className="text-xs text-gray-400">Always from SMEM via Descriptor</p>
                        </motion.div>
                    </div>
                </div>
            </ScrollSection>

            {/* Section 5: Stmatrix Writeback */}
            <ScrollSection
                id="writeback"
                title="5. The Return Trip"
                subtitle="Writing computed results back to Shared Memory with preserved swizzle layout"
            >
                <Stmatrix isAnimating={true} />
            </ScrollSection>

            {/* Summary / Lifecycle Overview */}
            <section className="min-h-screen flex flex-col items-center justify-center px-8 py-16 bg-gradient-to-b from-bg-dark to-bg-card">
                <motion.h2
                    initial={{ opacity: 0, y: -20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-3xl font-mono font-bold text-nvidia-green text-glow-green mb-8"
                >
                    WGMMA Lifecycle Summary
                </motion.h2>

                {/* Pipeline visualization */}
                <div className="flex flex-wrap justify-center items-center gap-4 max-w-6xl">
                    {[
                        { step: '1', title: 'Swizzle', desc: 'addr ^ ((addr>>7)<<4)', color: 'nvidia-green' },
                        { step: '2', title: 'Describe', desc: 'st_descriptor', color: 'cyber-purple' },
                        { step: '3', title: 'Load A', desc: 'ldmatrix (rt_st)', color: 'nvidia-green' },
                        { step: '4', title: 'Compute', desc: 'wgmma.mma_async', color: 'nvidia-green' },
                        { step: '5', title: 'Store', desc: 'stmatrix', color: 'cyber-blue' },
                    ].map((item, i) => (
                        <React.Fragment key={item.step}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="flex flex-col items-center p-5 bg-bg-dark border-2 rounded-xl"
                                style={{
                                    borderColor: item.color === 'nvidia-green' ? 'rgba(118, 185, 0, 1)' :
                                        item.color === 'cyber-blue' ? 'rgba(0, 200, 255, 1)' : 'rgba(180, 100, 255, 1)',
                                    boxShadow: item.color === 'nvidia-green' ? '0 0 20px rgba(118, 185, 0, 0.3)' :
                                        item.color === 'cyber-blue' ? '0 0 20px rgba(0, 200, 255, 0.3)' : '0 0 20px rgba(180, 100, 255, 0.3)',
                                }}
                            >
                                <span className="text-xl font-bold font-mono text-white mb-1">{item.step}</span>
                                <span className="text-base font-mono" style={{
                                    color: item.color === 'nvidia-green' ? 'rgba(118, 185, 0, 1)' :
                                        item.color === 'cyber-blue' ? 'rgba(0, 200, 255, 1)' : 'rgba(180, 100, 255, 1)',
                                }}>{item.title}</span>
                                <span className="text-[10px] text-gray-500 font-mono mt-1">{item.desc}</span>
                            </motion.div>

                            {i < 4 && (
                                <motion.div
                                    initial={{ opacity: 0, scaleX: 0 }}
                                    whileInView={{ opacity: 1, scaleX: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 + 0.2 }}
                                    className="hidden md:block w-8 h-0.5 bg-gradient-to-r from-nvidia-green to-cyber-blue"
                                />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                    className="mt-16 text-center text-sm text-gray-500"
                >
                    <p>Based on NVIDIA Hopper Architecture & ThunderKittens Implementation</p>
                    <p className="mt-2 font-mono">PTX ISA 9.7 • SM_90 • CUDA C++</p>
                </motion.div>
            </section>
        </div>
    );
}

export default App;
