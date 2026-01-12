/**
 * Swizzle utilities based on NVIDIA Hopper/ThunderKittens implementation
 * Core formula: addr ^ (((addr % swizzle_repeat) >> 7) << 4)
 * 
 * Key insight: Swizzle operates on 128-BYTE boundaries, not per-row.
 * With 32-byte rows (16 cols × 2 bytes for bf16), the pattern shifts every 4 rows.
 */

/**
 * Calculate the swizzled address for 128-byte swizzle mode
 * Uses XOR pattern to distribute bank accesses
 * For 32 banks (4 bytes each), swizzle affects bits 2-6
 */
export const calculateSwizzle = (addr, swizzleStride = 128) => {
    // Which 128-byte "line" are we in?
    const swizzleLineIndex = Math.floor(addr / swizzleStride);

    // The "phase" of the swizzle (bits 0-4 of line index for 32-bank XOR)
    const phase = swizzleLineIndex & 0x1F; // 5 bits for 32 banks

    // Shift phase to bits 2-6 (bank bits for 4-byte aligned banks)
    const swizzleMask = phase << 2;

    return addr ^ swizzleMask;
};

/**
 * Bank Index for 32-bank shared memory
 * Each bank is 4 bytes wide (32 bits)
 * Bank = (addr >> 2) & 0x1F
 */
export const getBankIndex = (addr) => (addr >> 2) & 0x1F;

/**
 * Get the swizzled bank index
 */
export const getSwizzledBankIndex = (addr, swizzleStride = 128) => {
    const swizzledAddr = calculateSwizzle(addr, swizzleStride);
    return getBankIndex(swizzledAddr);
};

/**
 * Generate a color based on bank index (0-31)
 * Uses a perceptually distinct palette for 32 banks
 */
export const getBankColor = (bank) => {
    // 32 distinct colors using hue rotation with varying saturation/lightness
    const hue = (bank * 11.25) % 360; // 360/32 = 11.25 degrees apart
    const saturation = 65 + (bank % 4) * 8; // Vary saturation 65-89%
    const lightness = 40 + ((bank >> 2) % 4) * 5; // Vary lightness 40-55%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * Extract bits from address for XOR visualization
 */
export const extractSwizzleBits = (addr, swizzleStride = 128) => {
    const linearBank = getBankIndex(addr);
    const swizzleLineIndex = Math.floor(addr / swizzleStride);
    const phase = swizzleLineIndex & 0x1F; // 5 bits for 32 banks
    const xorResult = linearBank ^ phase;

    return {
        original: addr,
        linearBank,
        swizzleLineIndex,
        phase,
        xorResult,
        swizzledAddr: calculateSwizzle(addr, swizzleStride),
    };
};

/**
 * Generate a 16x32 memory grid with addresses
 * Shows 16 rows × 32 columns for full 32-bank visualization
 * Each cell represents a 4-byte element (one bank width)
 * Row stride = 128 bytes (32 cols × 4 bytes)
 */
export const generateMemoryGrid = (baseAddr = 0) => {
    const grid = [];
    const rows = 16;
    const cols = 32; // 32 banks
    const bytesPerElement = 4; // 4 bytes per bank (32-bit word)
    const rowStride = cols * bytesPerElement; // 128 bytes per row
    const swizzleStride = 128; // Hopper WGMMA swizzle boundary

    for (let row = 0; row < rows; row++) {
        const rowData = [];
        for (let col = 0; col < cols; col++) {
            const linearAddr = baseAddr + (row * rowStride) + (col * bytesPerElement);
            const swizzledAddr = calculateSwizzle(linearAddr, swizzleStride);

            rowData.push({
                row,
                col,
                linearAddr,
                swizzledAddr,
                linearBank: getBankIndex(linearAddr),
                swizzledBank: getBankIndex(swizzledAddr),
                // Useful for showing which 128-byte group this belongs to
                swizzleGroup: Math.floor(linearAddr / swizzleStride),
            });
        }
        grid.push(rowData);
    }
    return grid;
};
