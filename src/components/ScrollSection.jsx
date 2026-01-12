import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

const ScrollSection = ({
    children,
    id,
    title,
    subtitle,
    className = '',
    showHUD = true,
}) => {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"]
    });

    const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
    const y = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [100, 0, 0, -100]);

    return (
        <section
            ref={ref}
            id={id}
            className={`section-container ${className}`}
        >
            {/* HUD Corner decorations */}
            {showHUD && (
                <>
                    <div className="hud-corner hud-corner-tl" />
                    <div className="hud-corner hud-corner-tr" />
                    <div className="hud-corner hud-corner-bl" />
                    <div className="hud-corner hud-corner-br" />
                </>
            )}

            {/* Scan line overlay */}
            <div className="scan-overlay">
                <div className="scan-line" />
            </div>

            <motion.div
                style={{ opacity, y }}
                className="w-full max-w-7xl mx-auto"
            >
                {/* Section Header */}
                {title && (
                    <motion.h2
                        className="section-title text-nvidia-green text-glow-green text-center"
                        initial={{ opacity: 0, y: -20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        {title}
                    </motion.h2>
                )}

                {subtitle && (
                    <motion.p
                        className="section-subtitle"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        {subtitle}
                    </motion.p>
                )}

                {/* Section Content */}
                <div className="mt-8">
                    {children}
                </div>
            </motion.div>
        </section>
    );
};

export default ScrollSection;
