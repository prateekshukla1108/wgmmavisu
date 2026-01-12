/**
 * @file
 * @brief The ThunderKittens shared tile struct.
 */

#pragma once

#include "../../common/common.cuh"
#include "sv.cuh"

/* ----------  MAIN TILE STRUCT  ---------- */

// these are helper structs for type inference
namespace kittens {
namespace ducks {
/**
 * @namespace rt
 * 
 * @brief The namespace where concepts and abstract types for shared tiles live.
 */
namespace st {
/**
 * @brief A dummy type used to identify shared tiles.
 * 
 * For a type to quack like an st, it should define its identifier as ducks::st::identifier.
 * If a type quacks like ducks::st::identifier, it will be treated as an st by compiler checks.
 * This is particularly useful for subtiles.
 */
struct identifier {};
/**
* @brief Concept for all shared tiles.
* @tparam T The type to check against the concept requirements.
*
* Requires:
* - T has a nested type identifier that is the same as st::identifier.
*/
template<typename T> concept all = requires {
    typename T::identifier; // Checks if T::identifier exists
} && std::is_same_v<typename T::identifier, identifier>; // Checks if T::identifier is ducks::st::identifier
}
} // namespace ducks

// Forward declaration of subtile
template<
    typename ST,
    int _subtile_height,
    int _subtile_width
>
struct st_subtile;

/**
 * @brief Shared memory tile structure for various data types and layouts.
 *
 * @tparam T The data type of the elements in the tile. Not packed!
 * @tparam _rows The height of the tile.
 * @tparam _cols The width of the tile.
 */
template<typename _T, int _rows, int _cols>
struct KITTENS_DEFAULT_ALIGN st {
    using identifier = ducks::st::identifier; ///< Type identifier for shared memory tile.
    using T = base_types::packing<_T>::unpacked_type;
    using T2 = base_types::packing<_T>::packed_type;
    using dtype = T; ///< Data type of the elements in the tile.

    // define underlying data as same as that projected, to make clear that this is *not* a subtile.
    static constexpr int underlying_rows          = _rows;
    static constexpr int underlying_cols          = _cols;
    static constexpr int underlying_height        = _rows / kittens::TILE_ROW_DIM<T>;
    static constexpr int underlying_width         = _cols / kittens::TILE_COL_DIM<T>;
    static constexpr int underlying_num_elements  = underlying_rows * underlying_cols;

    static constexpr int rows                = _rows; ///< Total number of rows in the tile.
    static_assert(rows % kittens::TILE_ROW_DIM<T> == 0, "Rows must be divisible by the tile dimension");
    static constexpr int cols                = _cols; ///< Total number of cols in the tile.
    static_assert(cols % kittens::TILE_COL_DIM<T> == 0, "Cols must be divisible by the tile dimension");
    static constexpr int height              = _rows / kittens::TILE_ROW_DIM<T>; ///< Height of the tile in terms of 16-element subtiles.
    static constexpr int width               = _cols / kittens::TILE_COL_DIM<T>; ///< Width of the tile in terms of 16-element subtiles.
    static constexpr int num_elements        = rows * cols; ///< Total number of elements in the tile.

    static_assert(base_types::packing<dtype>::num() == 1 || std::is_same_v<dtype, fp4_2>); // must be a 1-packed type (e.g. float, bf16, etc)

    static constexpr int swizzle_bytes = (
        sizeof(dtype) == 1 ? (  // Add FP8 case
            underlying_width%4 == 0 ? 128 :
            underlying_width%2 == 0 ?  64 : 32
        ) :
        sizeof(dtype) == 2 ? (
            underlying_width%4 == 0 ? 128 :
            underlying_width%2 == 0 ?  64 : 32
        ) :
        sizeof(dtype) == 4 ? (
            underlying_width%2 == 0 ? 128 : 64
        ) : -1
    );

    // wgmma layout with swizzling
    dtype data[rows*cols]; ///< Raw data storage for the tile.

    __device__ static inline T* idx(T *ptr, int2 coord) { // naive row-major coord default
        int r = coord.x, c = coord.y; // alias
        static constexpr int swizzle_repeat = swizzle_bytes * 8;
        static constexpr int subtile_cols   = swizzle_bytes / sizeof(T);
        const int outer_idx = c/subtile_cols;
        const uint64_t addr = (uint64_t)(&ptr[outer_idx*rows*subtile_cols + r*subtile_cols + c%subtile_cols]);
        const int swizzle = ((addr % swizzle_repeat) >> 7) << 4;
        return (T*)(addr ^ swizzle);
    }
    __device__ static inline uint32_t idx(uint32_t ptr, int2 coord) {
        int r = coord.x, c = coord.y; // alias
        static constexpr int swizzle_repeat = swizzle_bytes * 8;
        static constexpr int subtile_cols   = swizzle_bytes / sizeof(T);
        const int outer_idx = c/subtile_cols;
        const uint32_t addr = ptr + sizeof(T)*(outer_idx*rows*subtile_cols + r*subtile_cols + c%subtile_cols);
        const int swizzle = ((addr % swizzle_repeat) >> 7) << 4;
        return (addr ^ swizzle);
    }
    /**
     * @brief Access a shared tile element using a row and column, as if the tile were row-major.
     *
     * This is the preferred way to access memory within a shared tile, which abstracts
     * indexing calculations for swizzled layouts.
     */
    __device__ inline       dtype& operator[](const int2 &rowcol)       {
        return *idx(data, rowcol);
    }
    __device__ inline const dtype& operator[](const int2 &rowcol) const {
        return *(const dtype*)idx((dtype*)data, rowcol);
    }
    __device__ inline       dtype& operator[](int idx)       {
        return data[idx];
    }
    __device__ inline const dtype& operator[](int idx) const {
        return data[idx];
    }

    template<int subtile_rows, int subtile_cols>
    __device__ inline st_subtile<st<_T, _rows, _cols>, subtile_rows, subtile_cols> subtile(int2 rowcol);

    // vector types
    using col_vec = sv<dtype, rows>; ///< Column vector type for this tile
    using row_vec = sv<dtype, cols>; ///< Row vector type for this tile
};



/**
 * @brief A reference into a chunk of shared tile memory.
 *
 * The st_subtile is a drop-in replacement for an st which internally
 * references the appropriate memory while performing minimal address
 * calculations. You should never create this directly, but instead
 * have subtile_inplace return it for you instead. (`auto` is nice.)
 *
 * You can generally just pretend this is an st. But not for wgmma's.
 */
template<
    typename _ST,
    int _subtile_rows,
    int _subtile_cols
>
struct st_subtile {
    using identifier = ducks::st::identifier; // i quack like an st, gcc will never know the difference
    using ST = _ST;
    using T = ST::T;
    using T2 = ST::T2;
    using dtype = T; ///< Data type of the elements in the tile.

    static constexpr int underlying_rows          = ST::underlying_rows;
    static_assert(underlying_rows % kittens::TILE_ROW_DIM<T> == 0, "Underlying rows must be divisible by the tile dimension");
    static constexpr int underlying_cols          = ST::underlying_cols;
    static_assert(underlying_cols % kittens::TILE_COL_DIM<T> == 0, "Underlying cols must be divisible by the tile dimension");
    static constexpr int underlying_height        = ST::underlying_height;
    static constexpr int underlying_width         = ST::underlying_width;
    static constexpr int underlying_num_elements  = ST::underlying_num_elements;

    static constexpr int rows                = _subtile_rows;
    static_assert(rows % kittens::TILE_ROW_DIM<T> == 0, "Rows must be divisible by the tile dimension");
    static constexpr int cols                = _subtile_cols;
    static_assert(cols % kittens::TILE_COL_DIM<T> == 0, "Cols must be divisible by the tile dimension");
    static constexpr int height              = rows / kittens::TILE_ROW_DIM<T>;
    static constexpr int width               = cols / kittens::TILE_COL_DIM<T>;
    static constexpr int num_elements        = rows * cols;

    static constexpr int swizzle_bytes = ST::swizzle_bytes;

    dtype *data;
    int row_offset, col_offset;

    __device__ st_subtile(ST &src, int2 rowcol) {
        data = &src.data[0];
        row_offset = rowcol.x * rows;
        col_offset = rowcol.y * cols;
    }

    __device__ inline T* idx(T *ptr, const int2 coord) { // naive row-major coord default
        int r = coord.x+row_offset, c = coord.y+col_offset; // alias
        static constexpr int swizzle_repeat = swizzle_bytes * 8;
        static constexpr int subtile_cols   = swizzle_bytes / sizeof(T);
        const int outer_idx = c/subtile_cols;
        const uint64_t addr = (uint64_t)(&ptr[outer_idx*underlying_rows*subtile_cols + r*subtile_cols + c%subtile_cols]);
        const int swizzle = ((addr % swizzle_repeat) >> 7) << 4;
        return (T*)(addr ^ swizzle);
    }
    __device__ inline uint32_t idx(uint32_t ptr, const int2 coord) const { // naive row-major coord default
        int r = coord.x+row_offset, c = coord.y+col_offset; // alias
        static constexpr int swizzle_repeat = swizzle_bytes * 8;
        static constexpr int subtile_cols   = swizzle_bytes / sizeof(T);
        const int outer_idx = c/subtile_cols;
        const uint32_t addr = ptr + sizeof(T)*(outer_idx*underlying_rows*subtile_cols + r*subtile_cols + c%subtile_cols);
        const int swizzle = ((addr % swizzle_repeat) >> 7) << 4;
        return (addr ^ swizzle);
    }
    /**
     * @brief Access a shared tile element using a row and column, as if the tile were row-major.
     *
     * This is the preferred way to access memory within a shared tile, which abstracts
     * indexing calculations for swizzled layouts.
     */
    __device__ inline       dtype& operator[](const int2 &rowcol)       {
        return *idx(data, rowcol);
    }
    __device__ inline const dtype& operator[](const int2 &rowcol) const {
        return *(const dtype*)idx((dtype*)data, rowcol);
    }

    // single-coord operator[] is left undefined as it would likely be an improper use of st_subtile type.
    // can of course be end-run by just accessing .data directly.

    // vector types
    using col_vec = sv<dtype, rows>;
    using row_vec = sv<dtype, cols>;

    __device__ inline void operator=(const dtype &value) { // runs at warp scope by default
        #pragma unroll
        for(int i = kittens::laneid(); i < num_elements; i += WARP_THREADS) {
            data[i] = value;
        }
    }
};

template <typename _T, int _rows, int _cols> // Class template parameters
template <int subtile_rows, int subtile_cols> // Function template parameters
__device__ inline st_subtile<st<_T, _rows, _cols>, subtile_rows, subtile_cols> // Return type
st<_T, _rows, _cols>::subtile(int2 rowcol) // Qualified function name and parameters
{
    // Type aliases for convenience within the function body
    using ST_t = st<_T, _rows, _cols>; // Alias for the parent tile type
    using dtype = typename ST_t::dtype;  // Alias for the data type

    // Static assertions (as provided in the initial request)
    static_assert(subtile_rows > 0 && subtile_cols > 0, "Subtile dimensions must be positive.");
    static_assert(subtile_rows % kittens::TILE_ROW_DIM<dtype> == 0,
        "Subtile rows must be divisible by the base tile row dimension.");
    static_assert(subtile_cols % kittens::TILE_COL_DIM<dtype> == 0,
        "Subtile cols must be divisible by the base tile col dimension.");

    // Calculate height/width in terms of base tiles for further checks
    constexpr int subtile_height = subtile_rows / kittens::TILE_ROW_DIM<dtype>;
    constexpr int subtile_width = subtile_cols / kittens::TILE_COL_DIM<dtype>;
    static_assert(subtile_height > 0 && subtile_width > 0, "Subtile height/width in base tiles must be positive.");

    // Check divisibility of parent height/width by subtile height/width
    static_assert(ST_t::height % subtile_height == 0,
        "Parent tile height (in base tiles) must be divisible by subtile height (in base tiles).");
    static_assert(ST_t::width % subtile_width == 0,
        "Parent tile width (in base tiles) must be divisible by subtile width (in base tiles).");

    // Ensure the parent st object is not itself a subtile view by comparing its
    // dimensions to its underlying dimensions.
    static_assert(ST_t::height == ST_t::underlying_height && ST_t::width == ST_t::underlying_width,
        "Cannot create a subtile from an object that appears to be a subtile view (height/width mismatch underlying).");
    // Also check rows/cols directly for robustness, though height/width check might suffice.
    static_assert(ST_t::rows == ST_t::underlying_rows && ST_t::cols == ST_t::underlying_cols,
        "Cannot create a subtile from an object that appears to be a subtile view (rows/cols mismatch underlying).");


    // Construct and return the st_subtile object using its constructor:
    // st_subtile(ST &src, int2 rowcol)
    // Here, 'src' is the current 'st' object (*this)
    return st_subtile<ST_t, subtile_rows, subtile_cols>(*this, rowcol);
}

/* ----------  WRAPPERS FOR PRETTINESS  ---------- */

template<int _height, int _width> using st_bf = st<bf16,  _height, _width>;
template<int _height, int _width> using st_hf = st<half,  _height, _width>;
template<int _height, int _width> using st_fl = st<float, _height, _width>;
#ifdef KITTENS_HOPPER
template<int _height, int _width> using st_fp8e4m3 = st<fp8e4m3, _height, _width>;
template<int _height, int _width> using st_fp8e5m2 = st<fp8e5m2, _height, _width>;
#ifdef KITTENS_BLACKWELL
template<int _height, int _width> using st_fp8e8m0 = st<fp8e8m0, _height, _width>;
template<int _height, int _width> using st_fp4_2 = st<fp4_2, _height, _width>;
#endif
#endif

/* ----------  PRINTOUTS  ---------- */

/**
 * @brief Print the contents of a shared tile as a formatted table.
 * 
 * This function should be called by a single thread in the warp.
 * It will print the entire tile atomically to avoid interleaved output.
 * 
 * @param tile The shared tile to print
 */
template<ducks::st::all ST>
__device__ inline void print(const ST& tile) {
    printf("Shared Tile %dx%d:\n", ST::rows, ST::cols);
    
    // Print column headers
    printf("     "); // Padding for row indices
    for (int c = 0; c < ST::cols; c++) {
        printf("%8d ", c);
    }
    printf("\n");
    
    // Print separator line
    printf("     ");
    for (int c = 0; c < ST::cols; c++) {
        printf("--------+");
    }
    printf("\n");
    
    // Print data rows
    for (int r = 0; r < ST::rows; r++) {
        printf("%3d |", r); // Row index
        for (int c = 0; c < ST::cols; c++) {
            if constexpr (std::is_same_v<typename ST::dtype, fp8e4m3>) {
                printf("%8.3f ", static_cast<float>(tile[{r,c}]));
#ifdef KITTENS_BLACKWELL
            } else if constexpr (std::is_same_v<typename ST::dtype, fp8e8m0>) {
                printf("%8.3f ", static_cast<float>(tile[{r,c}]));
#endif
            } else if constexpr (std::is_same_v<typename ST::dtype, float>) {
                printf("%8.3f ", tile[{r,c}]);
            } else if constexpr (std::is_same_v<typename ST::dtype, __nv_bfloat16>) {
                printf("%8.3f ", __bfloat162float(tile[{r,c}]));
            } else if constexpr (std::is_integral_v<typename ST::dtype>) {
                printf("%8d ", (int)tile[{r,c}]);
            } else {
                printf("%8.3f ", (float)tile[{r,c}]);
            }
        }
        printf("\n");
    }
    printf("\n");
}

}
/**
 * @file
 * @brief Functions for a warpgroup to collaboratively transfer data directly between shared memory and registers and back.
 */

/**
 * @brief Collaboratively load data from a shared tile into register tiles split across a warpgroup.
 *
 * @tparam RT The register tile type
 * @tparam ST The shared tile type
 * @param dst[out] The destination register tile.
 * @param src[in]  The source shared tile.
 */
template<ducks::rt::all RT, ducks::st::all ST>
__device__ inline static void load(RT &dst, const ST &src) {
    constexpr int height = ST::height;
    constexpr int warp_height = RT::height;
    static_assert(height%GROUP_WARPS == 0, "Group load / store requires tile height to be a multiple of GROUP_WARPS.");
    static_assert(height%warp_height == 0, "Group load / store requires tile height to be a multiple of the RT height.");
    static_assert(ST::width==RT::width, "Group load / store requires tile widths to match.");
    int local_warpid;
    if constexpr(GROUP_WARPS % 4 == 0) local_warpid = (warpid()/4+(warpid()%4)*(GROUP_WARPS/4));
    else local_warpid = warpid();
    using T2 = RT::dtype;
    using U  = ST::dtype;
    using T  = base_types::packing<T2>::unpacked_type;
    using U2 = base_types::packing<U>::packed_type;
    int warp_laneid = ::kittens::laneid();

    // convert to shared state space
    uint32_t shared_addr = static_cast<uint32_t>(__cvta_generic_to_shared(&src.data[0]));

    #pragma unroll
    for(int i = 0; i < dst.height; i++) {
        #pragma unroll
        for(int j = 0; j < dst.width; j++) {
            if constexpr (sizeof(typename ST::dtype) == 2) {
                // handle the row-major layout for 16-bit types
                U2 tmp[4];
                int row = (local_warpid*warp_height + i)*dst.tile_size_row + (warp_laneid % 16);
                int col = j*dst.tile_size_col + (warp_laneid / 16) * 8;
                if constexpr (std::is_same_v<typename RT::layout, ducks::rt_layout::row>) {
                    move<U2>::ldsm4(tmp[0], tmp[1], tmp[2], tmp[3], src.idx(shared_addr, {row, col}));
                }
                else {
                    move<U2>::ldsm4t(tmp[0], tmp[2], tmp[1], tmp[3], src.idx(shared_addr, {row, col}));
                }
                dst.tiles[i][j].data[0] = base_types::convertor<T2, U2>::convert(tmp[0]);
                dst.tiles[i][j].data[1] = base_types::convertor<T2, U2>::convert(tmp[1]);
                dst.tiles[i][j].data[2] = base_types::convertor<T2, U2>::convert(tmp[2]);
                dst.tiles[i][j].data[3] = base_types::convertor<T2, U2>::convert(tmp[3]);
            }
            else if constexpr (std::is_same_v<typename RT::layout, ducks::rt_layout::row> && sizeof(typename ST::dtype) == 1) {
                // handle the row-major layout for 8-bit types
                int warp_group_16 = (warp_laneid / 16);  // divide each warp into two groups of 16 threads
                int lane_in_16 = warp_laneid % 16;       // position in group of 16 threads
                int row = (local_warpid*warp_height + i)*dst.tile_size_row + (lane_in_16 % 16); // find base row for warp in warpgroup and then distribute the 16 threads in the warp across the rows
                int col = j*dst.tile_size_col + warp_group_16 * 16; // find base column and then *16 for second half of the warp

                U2 tmp[4];
                if constexpr (std::is_same_v<typename RT::layout, ducks::rt_layout::row>) {
                    move<U2>::ldsm4(tmp[0], tmp[1], tmp[2], tmp[3], src.idx(shared_addr, {row, col}));
                }
                else {
                    move<U2>::ldsm4t(tmp[0], tmp[2], tmp[1], tmp[3], src.idx(shared_addr, {row, col}));
                }
                dst.tiles[i][j].data[0] = base_types::convertor<T2, U2>::convert(tmp[0]);
                dst.tiles[i][j].data[1] = base_types::convertor<T2, U2>::convert(tmp[1]);
                dst.tiles[i][j].data[2] = base_types::convertor<T2, U2>::convert(tmp[2]);
                dst.tiles[i][j].data[3] = base_types::convertor<T2, U2>::convert(tmp[3]);
            }
            else if constexpr (std::is_same_v<typename RT::layout, ducks::rt_layout::row> && sizeof(typename ST::dtype) == 4) {
                // handle the row-major layout for 32-bit types
                int row = (local_warpid*warp_height + i)*dst.tile_size_row + (warp_laneid / 4);
                int col = j*dst.tile_size_col + 2*(warp_laneid % 4);
                if constexpr (ST::rows != ST::underlying_rows || ST::cols != ST::underlying_cols) { // subtile case
                    row += src.row_offset;
                    col += src.col_offset;
                }
                int blit = sizeof(typename ST::dtype) * ((warp_laneid%4) / 2);
                U2 tmp[4];
                static constexpr int swizzle_repeat = ST::swizzle_bytes * 8;
                static constexpr int subtile_cols   = ST::swizzle_bytes / sizeof(U);
                const int outer_idx = col/subtile_cols;
                const uint32_t addr_1 = shared_addr + sizeof(U)*(outer_idx*ST::underlying_rows*subtile_cols + (row+0)*subtile_cols + col%subtile_cols);
                const uint32_t addr_2 = shared_addr + sizeof(U)*(outer_idx*ST::underlying_rows*subtile_cols + (row+8)*subtile_cols + col%subtile_cols);
                const int swizzle_1 = blit ^ ((addr_1 % swizzle_repeat) >> 7) << 4;
                const int swizzle_2 = blit ^ ((addr_2 % swizzle_repeat) >> 7) << 4;
                move<U>::lds(tmp[0].x, (addr_1+ 0)^swizzle_1);
                move<U>::lds(tmp[0].y, (addr_1+ 4)^swizzle_1);
                move<U>::lds(tmp[2].x, (addr_1+32)^swizzle_1);
                move<U>::lds(tmp[2].y, (addr_1+36)^swizzle_1);
                move<U>::lds(tmp[1].x, (addr_2+ 0)^swizzle_2);
                move<U>::lds(tmp[1].y, (addr_2+ 4)^swizzle_2);
                move<U>::lds(tmp[3].x, (addr_2+32)^swizzle_2);
                move<U>::lds(tmp[3].y, (addr_2+36)^swizzle_2);
                dst.tiles[i][j].data[0] = base_types::convertor<T2, U2>::convert(tmp[0]);
                dst.tiles[i][j].data[1] = base_types::convertor<T2, U2>::convert(tmp[1]);
                dst.tiles[i][j].data[2] = base_types::convertor<T2, U2>::convert(tmp[2]);
                dst.tiles[i][j].data[3] = base_types::convertor<T2, U2>::convert(tmp[3]);
                if(blit) {
                    #pragma unroll
                    for(int k = 0; k < 4; k++) {
                        dst.tiles[i][j].data[k] = T2{dst.tiles[i][j].data[k].y, dst.tiles[i][j].data[k].x};
                    }
                }
            }
            else {
                // handle the column-major layout
                int row = (local_warpid*warp_height + i)*dst.tile_size_row + 2*(warp_laneid % 4);
                int col = j*dst.tile_size_col + (warp_laneid / 4);
                U2 tmp[4];
                move<U>::lds(tmp[0].x, src.idx(shared_addr, {row+0, col+0}));
                move<U>::lds(tmp[0].y, src.idx(shared_addr, {row+1, col+0}));
                move<U>::lds(tmp[1].x, src.idx(shared_addr, {row+0, col+8}));
                move<U>::lds(tmp[1].y, src.idx(shared_addr, {row+1, col+8}));
                move<U>::lds(tmp[2].x, src.idx(shared_addr, {row+8, col+0}));
                move<U>::lds(tmp[2].y, src.idx(shared_addr, {row+9, col+0}));
                move<U>::lds(tmp[3].x, src.idx(shared_addr, {row+8, col+8}));
                move<U>::lds(tmp[3].y, src.idx(shared_addr, {row+9, col+8}));
                dst.tiles[i][j].data[0] = base_types::convertor<T2, U2>::convert(tmp[0]);
                dst.tiles[i][j].data[1] = base_types::convertor<T2, U2>::convert(tmp[1]);
                dst.tiles[i][j].data[2] = base_types::convertor<T2, U2>::convert(tmp[2]);
                dst.tiles[i][j].data[3] = base_types::convertor<T2, U2>::convert(tmp[3]);
            }
        }
    }
}


/**
 * @brief Collaboratively store data into a shared tile from register tiles split across a warpgroup.
 *
 * @tparam RT The register tile type
 * @tparam ST The shared tile type
 * @param dst[out] The destination shared tile.
 * @param src[in]  The source register tile.
 */
template<ducks::st::all ST, ducks::rt::all RT>
__device__ inline static void store(ST &dst, const RT &src) {
    constexpr int height = ST::height;
    constexpr int warp_height = RT::height;
    static_assert(height%GROUP_WARPS == 0, "Group load / store requires tile height to be a multiple of GROUP_WARPS.");
    static_assert(height%warp_height == 0, "Group load / store requires tile height to be a multiple of the RT height.");
    static_assert(ST::width==RT::width, "Group load / store requires tile widths to match.");
    int local_warpid;
    if constexpr(GROUP_WARPS % 4 == 0) local_warpid = (warpid()/4+(warpid()%4)*(GROUP_WARPS/4));
    else local_warpid = warpid();
    using T2 = RT::dtype;
    using U  = ST::dtype;
    using T  = base_types::packing<T2>::unpacked_type;
    using U2 = base_types::packing<U>::packed_type;
    int warp_laneid = ::kittens::laneid();

    // convert to shared state space
    uint32_t shared_addr = static_cast<uint32_t>(__cvta_generic_to_shared(&dst.data[0]));

    #pragma unroll
    for(int i = 0; i < warp_height; i++) {
        #pragma unroll
        for(int j = 0; j < src.width; j++) {
            if constexpr (sizeof(typename ST::dtype) == 2) {
                // handle the row-major layout
                U2 tmp[4];
                tmp[0] = base_types::convertor<U2, T2>::convert(src.tiles[i][j].data[0]);
                tmp[1] = base_types::convertor<U2, T2>::convert(src.tiles[i][j].data[1]);
                tmp[2] = base_types::convertor<U2, T2>::convert(src.tiles[i][j].data[2]);
                tmp[3] = base_types::convertor<U2, T2>::convert(src.tiles[i][j].data[3]);
#ifdef KITTENS_HOPPER
                int row = (local_warpid*warp_height + i)*src.tile_size_row + (warp_laneid % 16);
                int col = j*src.tile_size_col + (warp_laneid / 16) * 8;
                if constexpr (std::is_same_v<typename RT::layout, ducks::rt_layout::row>) {
                    move<U2>::stsm4(dst.idx(shared_addr, {row, col}), tmp[0], tmp[1], tmp[2], tmp[3]);
                }
                else {
                    move<U2>::stsm4t(dst.idx(shared_addr, {row, col}), tmp[0], tmp[2], tmp[1], tmp[3]);
                }
#else
                if constexpr (std::is_same_v<typename RT::layout, ducks::rt_layout::row>) {
                    int row = (local_warpid*warp_height + i)*src.tile_size_row + (warp_laneid / 4);
                    int col = j*src.tile_size_col + 2*(warp_laneid % 4);
                    move<U2>::sts(dst.idx(shared_addr, {row+0, col+0}), tmp[0]);
                    move<U2>::sts(dst.idx(shared_addr, {row+8, col+0}), tmp[1]);
                    move<U2>::sts(dst.idx(shared_addr, {row+0, col+8}), tmp[2]);
                    move<U2>::sts(dst.idx(shared_addr, {row+8, col+8}), tmp[3]);
                }
                else {
                    int row = (local_warpid*warp_height + i)*src.tile_size_row + 2*(warp_laneid % 4);
                    int col = j*src.tile_size_col + (warp_laneid / 4);
                    move<U>::sts(dst.idx(shared_addr, {row+0, col+0}), tmp[0].x);
                    move<U>::sts(dst.idx(shared_addr, {row+1, col+0}), tmp[0].y);
                    move<U>::sts(dst.idx(shared_addr, {row+0, col+8}), tmp[1].x);
                    move<U>::sts(dst.idx(shared_addr, {row+1, col+8}), tmp[1].y);
                    move<U>::sts(dst.idx(shared_addr, {row+8, col+0}), tmp[2].x);
                    move<U>::sts(dst.idx(shared_addr, {row+9, col+0}), tmp[2].y);
                    move<U>::sts(dst.idx(shared_addr, {row+8, col+8}), tmp[3].x);
                    move<U>::sts(dst.idx(shared_addr, {row+9, col+8}), tmp[3].y);
                }
#endif
            }
            else if constexpr (std::is_same_v<typename RT::layout, ducks::rt_layout::row> && sizeof(typename ST::dtype) == 1) { 
                // handle the row-major layout for 8-bit types

                int warp_group_16 = (warp_laneid / 16);  // divide each warp into two groups of 16 threads
                int lane_in_16 = warp_laneid % 16;       // position in group of 16 threads
                int row = (local_warpid*warp_height + i)*src.tile_size_row + (lane_in_16 % 16); // find base row for warp in warpgroup and then distribute the 16 threads in the warp across the rows
                int col = j*src.tile_size_col + warp_group_16 * 16; // find base column and then *16 for second half of the warp

                U2 tmp[4];
                tmp[0] = base_types::convertor<U2, T2>::convert(src.tiles[i][j].data[0]);
                tmp[1] = base_types::convertor<U2, T2>::convert(src.tiles[i][j].data[1]);
                tmp[2] = base_types::convertor<U2, T2>::convert(src.tiles[i][j].data[2]);
                tmp[3] = base_types::convertor<U2, T2>::convert(src.tiles[i][j].data[3]);
                if constexpr (std::is_same_v<typename RT::layout, ducks::rt_layout::row>) {
                    move<U2>::stsm4(dst.idx(shared_addr, {row, col}), tmp[0], tmp[1], tmp[2], tmp[3]);
                }
                else {
                    move<U2>::stsm4t(dst.idx(shared_addr, {row, col}), tmp[0], tmp[2], tmp[1], tmp[3]);
                }
            }
            else if constexpr (std::is_same_v<typename RT::layout, ducks::rt_layout::row> && sizeof(typename ST::dtype) == 4) {
                // handle the row-major layout for 32-bit types
                int row = (local_warpid*warp_height + i)*src.tile_size_row + (warp_laneid / 4);
                int col = j*src.tile_size_col + 2*(warp_laneid % 4);
                if constexpr (ST::rows != ST::underlying_rows || ST::cols != ST::underlying_cols) { // subtile case
                    row += dst.row_offset;
                    col += dst.col_offset;
                }
                int blit = sizeof(typename ST::dtype) * ((warp_laneid%4) / 2);
                T2 reg_tmp[4];
                if(blit) {
                    #pragma unroll
                    for(int k = 0; k < 4; k++) {
                        reg_tmp[k] = T2{src.tiles[i][j].data[k].y, src.tiles[i][j].data[k].x};
                    }
                }
                else {
                    #pragma unroll
                    for(int k = 0; k < 4; k++) {
                        reg_tmp[k] = src.tiles[i][j].data[k];
                    }
                }
                U2 tmp[4];
                tmp[0] = base_types::convertor<U2, T2>::convert(reg_tmp[0]);
                tmp[1] = base_types::convertor<U2, T2>::convert(reg_tmp[1]);
                tmp[2] = base_types::convertor<U2, T2>::convert(reg_tmp[2]);
                tmp[3] = base_types::convertor<U2, T2>::convert(reg_tmp[3]);
                static constexpr int swizzle_repeat = ST::swizzle_bytes * 8;
                static constexpr int subtile_cols   = ST::swizzle_bytes / sizeof(U);
                const int outer_idx = col/subtile_cols;
                const uint32_t addr_1 = shared_addr + sizeof(U)*(outer_idx*ST::underlying_rows*subtile_cols + (row+0)*subtile_cols + col%subtile_cols);
                const uint32_t addr_2 = shared_addr + sizeof(U)*(outer_idx*ST::underlying_rows*subtile_cols + (row+8)*subtile_cols + col%subtile_cols);
                const int swizzle_1 = blit ^ ((addr_1 % swizzle_repeat) >> 7) << 4;
                const int swizzle_2 = blit ^ ((addr_2 % swizzle_repeat) >> 7) << 4;
                move<U>::sts((addr_1+ 0)^swizzle_1, tmp[0].x);
                move<U>::sts((addr_1+ 4)^swizzle_1, tmp[0].y);
                move<U>::sts((addr_1+32)^swizzle_1, tmp[2].x);
                move<U>::sts((addr_1+36)^swizzle_1, tmp[2].y);
                move<U>::sts((addr_2+ 0)^swizzle_2, tmp[1].x);
                move<U>::sts((addr_2+ 4)^swizzle_2, tmp[1].y);
                move<U>::sts((addr_2+32)^swizzle_2, tmp[3].x);
                move<U>::sts((addr_2+36)^swizzle_2, tmp[3].y);
            }
            else {
                // handle the column-major layout
                int row = (local_warpid*warp_height + i)*src.tile_size_row + 2*(warp_laneid % 4);
                int col = j*src.tile_size_col + (warp_laneid / 4);
                U2 tmp[4];
                tmp[0] = base_types::convertor<U2, T2>::convert(src.tiles[i][j].data[0]);
                tmp[1] = base_types::convertor<U2, T2>::convert(src.tiles[i][j].data[1]);
                tmp[2] = base_types::convertor<U2, T2>::convert(src.tiles[i][j].data[2]);
                tmp[3] = base_types::convertor<U2, T2>::convert(src.tiles[i][j].data[3]);
                move<U>::sts(dst.idx(shared_addr, {row+0, col+0}), tmp[0].x);
                move<U>::sts(dst.idx(shared_addr, {row+1, col+0}), tmp[0].y);
                move<U>::sts(dst.idx(shared_addr, {row+0, col+8}), tmp[1].x);
                move<U>::sts(dst.idx(shared_addr, {row+1, col+8}), tmp[1].y);
                move<U>::sts(dst.idx(shared_addr, {row+8, col+0}), tmp[2].x);
                move<U>::sts(dst.idx(shared_addr, {row+9, col+0}), tmp[2].y);
                move<U>::sts(dst.idx(shared_addr, {row+8, col+8}), tmp[3].x);
                move<U>::sts(dst.idx(shared_addr, {row+9, col+8}), tmp[3].y);
            }
        }
    }
}

// Load and store of vectors from/to shared tiles.

template<ducks::rv::naive_layout RV, ducks::st::all ST>
__device__ inline static auto load(RV &dst, const ST &src, int2 row_col) {
    KITTENS_CHECK_WARP;
    static_assert(ST::cols>=RV::length, "Shared tile must be at least as wide as the vector.");
    using T = RV::T;
    using U = ST::T;
    int warp_laneid = ::kittens::laneid();

    // convert to shared state space
    uint32_t shared_addr = static_cast<uint32_t>(__cvta_generic_to_shared(&src.data[0]));

    #pragma unroll
    for(int col = warp_laneid; col < dst.length; col+=WARP_THREADS) {
        U tmp;
        move<U>::lds(tmp, src.idx(shared_addr, {row_col.x, row_col.y + col}));
        dst.data[col/WARP_THREADS][0] = base_types::convertor<T, U>::convert(tmp);
    }
}

template<ducks::rv::naive_layout RV, ducks::st::all ST>
__device__ inline static auto store(ST &dst, const RV &src, int2 row_col) {
    KITTENS_CHECK_WARP;
    static_assert(ST::cols>=RV::length, "Shared tile must be at least as wide as the vector.");
    using T = RV::T;
    using U = ST::T;
    int warp_laneid = ::kittens::laneid();

    // convert to shared state space
    uint32_t shared_addr = static_cast<uint32_t>(__cvta_generic_to_shared(&dst.data[0]));

    #pragma unroll
    for(int col = warp_laneid; col < src.length; col+=WARP_THREADS) {
        U tmp = base_types::convertor<U, T>::convert(src.data[col/WARP_THREADS][0]);
        move<U>::sts(dst.idx(shared_addr, {row_col.x, row_col.y + col}), tmp);
    }
}
/**
 * @file
 * @brief The ThunderKittens shared tile descriptors, used for Hopper and Blackwell tensor cores.
 */

#pragma once

#if defined(KITTENS_HOPPER) || defined(KITTENS_BLACKWELL)

#include "../../common/common.cuh"
#include "st.cuh"
#include "cst.cuh"

namespace kittens {
namespace ducks {
namespace st_descriptor {
struct identifier {};
}
}

namespace detail {
// see https://docs.nvidia.com/cuda/parallel-thread-execution/index.html#asynchronous-warpgroup-level-matrix-shared-memory-layout-matrix-descriptor
__device__ static inline uint64_t matrix_descriptor_encode(uint64_t x) { return (((x) & 0x3FFFF) >> 0x4); }
}

template<kittens::ducks::st::all _ST, int transpose>
struct st_descriptor {
    using identifier = ducks::st_descriptor::identifier;
    using ST = _ST;
    static constexpr int height = ST::height;
    static constexpr int width  = ST::width;
    using T = ST::T;
    uint64_t base_desc;
    __device__ inline st_descriptor(const ST &tile) {
#ifdef KITTENS_BLACKWELL
        base_desc = detail::matrix_descriptor_encode((uint64_t)(&tile.data[0])) | (1llu<<46); // needed for blackwell shared memory descriptors.
#else
        base_desc = detail::matrix_descriptor_encode((uint64_t)(&tile.data[0]));
#endif
        if constexpr (transpose) { // transpose mode
            if constexpr (ST::width%4 == 0) {
                base_desc |= detail::matrix_descriptor_encode((uint64_t)2048*ST::height) << 16;
                base_desc |= detail::matrix_descriptor_encode((uint64_t)1024) << 32;
                base_desc |= 1llu << 62; // set wgmma_swizzle mode
            }
            else if constexpr (ST::width%2 == 0) {
                base_desc |= detail::matrix_descriptor_encode((uint64_t)1024*ST::height) << 16;
                base_desc |= detail::matrix_descriptor_encode((uint64_t)512) << 32;
                base_desc |= 2llu << 62; // set wgmma_swizzle mode
            }
            else {
                base_desc |= detail::matrix_descriptor_encode((uint64_t)512*ST::height) << 16;
                base_desc |= detail::matrix_descriptor_encode((uint64_t)256) << 32;
                base_desc |= 3llu << 62; // set wgmma_swizzle mode
            }
        }
        else { // normal mode
            if constexpr (ST::width%4 == 0) {
                base_desc |= detail::matrix_descriptor_encode((uint64_t)16) << 16;   // this line doesn't matter
                base_desc |= detail::matrix_descriptor_encode((uint64_t)1024) << 32; // 128 byte swizzle x 8 for core matrix rows
                base_desc |= 1llu << 62; // set wgmma_swizzle mode
            }
            else if constexpr (ST::width%2 == 0) {
                base_desc |= detail::matrix_descriptor_encode((uint64_t)16) << 16;  // this line doesn't matter
                base_desc |= detail::matrix_descriptor_encode((uint64_t)512) << 32; // 64 byte swizzle x 8 for core matrix rows
                base_desc |= 2llu << 62; // set wgmma_swizzle mode
            }
            else {
                base_desc |= detail::matrix_descriptor_encode((uint64_t)16) << 16;  // this line doesn't matter
                base_desc |= detail::matrix_descriptor_encode((uint64_t)256) << 32; // 32 byte swizzle x 8 for core matrix rows
                base_desc |= 3llu << 62; // set wgmma_swizzle mode
            }
        }
    }
    __device__ inline st_descriptor(const st_descriptor<ST, transpose> &other) : base_desc(other.base_desc) {} // copy constructor
    __device__ inline uint64_t chunk_descriptor(int chunk_idx) {
        if constexpr (transpose) { // transpose mode
            if constexpr (ST::width%4 == 0) {
                return base_desc + detail::matrix_descriptor_encode(chunk_idx*2048);
            }
            else if constexpr (ST::width%2 == 0) {
                return base_desc + detail::matrix_descriptor_encode(chunk_idx*1024);
            }
            else {
                return base_desc + detail::matrix_descriptor_encode(chunk_idx*512);
            }
        }
        else { // normal mode
            if constexpr (ST::width%4 == 0) {
                return base_desc + detail::matrix_descriptor_encode((chunk_idx%4)*32 + (chunk_idx/4)*ST::height*2048);
            }
            else if constexpr (ST::width%2 == 0) {
                return base_desc + detail::matrix_descriptor_encode((chunk_idx%2)*32 + (chunk_idx/2)*ST::height*1024);
            }
            else {
                return base_desc + detail::matrix_descriptor_encode(chunk_idx*ST::height*512);
            }
        }
    }
};

namespace ducks {
namespace st_descriptor {
// input refers to either an ST directly or to a pre-generated descriptor, which can save cycles in certain situations.
template<typename T> concept input = ducks::st::all<T> || (requires {typename T::identifier;} && std::is_same_v<typename T::identifier, ducks::st_descriptor::identifier>);
template<typename T> concept complex_input = ducks::cst::all<T>;
namespace detail {
template<typename T> struct st_getter { using type = typename T::ST; };
template<ducks::st::all T> struct st_getter<T> { using type = T; };
template<ducks::cst::all T> struct st_getter<T> { using type = T::component; };
template<typename T> using get_st = typename st_getter<T>::type;
} // namespace detail
} // namespace st_descriptor
} // namespace ducks

} // namespace kittens

#endif
/**
 * @file
 * @brief General memory utilities not specialized for either tiles or vectors.
 */

#pragma once

namespace kittens {

/* ----------   To prevent generic addressing, PTX  ---------- */

template<typename T> struct move {
    __device__ static inline void lds(T& dst, uint32_t src);
    __device__ static inline void sts(uint32_t dst, const T& src);
    __device__ static inline void ldg(T& dst, T* src);
    __device__ static inline void stg(T* dst, const T& src);
};
// unpacked types
template<> struct move<bf16> {
    __device__ static inline void lds(bf16& dst, uint32_t src) {
        asm volatile("ld.shared.b16 %0, [%1];\n" : "=h"(*(uint16_t*)&dst) : "r"(src));
    }
    __device__ static inline void sts(uint32_t dst, const bf16& src) {
        asm volatile("st.shared.b16 [%1], %0;\n" : : "h"(*(uint16_t*)&src), "r"(dst));
    }
    __device__ static inline void ldg(bf16& dst, bf16* src) {
        asm volatile("ld.global.b16 %0, [%1];\n" : "=h"(*(uint16_t*)&dst) : "l"(src));
    }
    __device__ static inline void stg(bf16* dst, const bf16& src) {
        asm volatile("st.global.b16 [%1], %0;\n" : : "h"(*(uint16_t*)&src), "l"(dst));
    }
};
template<> struct move<half> {
    __device__ static inline void lds(half& dst, uint32_t src) {
        asm volatile("ld.shared.b16 %0, [%1];\n" : "=h"(*(uint16_t*)&dst) : "r"(src));
    }
    __device__ static inline void sts(uint32_t dst, const half& src) {
        asm volatile("st.shared.b16 [%1], %0;\n" : : "h"(*(uint16_t*)&src), "r"(dst));
    }
    __device__ static inline void ldg(half& dst, half* src) {
        asm volatile("ld.global.b16 %0, [%1];\n" : "=h"(*(uint16_t*)&dst) : "l"(src));
    }
    __device__ static inline void stg(half* dst, const half& src) {
        asm volatile("st.global.b16 [%1], %0;\n" : : "h"(*(uint16_t*)&src), "l"(dst));
    }
};
template<> struct move<float> {
    __device__ static inline void lds(float& dst, uint32_t src) {
        asm volatile("ld.shared.f32 %0, [%1];\n" : "=f"(dst) : "r"(src));
    }
    __device__ static inline void sts(uint32_t dst, const float& src) {
        asm volatile("st.shared.f32 [%1], %0;\n" : : "f"(src), "r"(dst));
    }
    __device__ static inline void ldg(float& dst, float* src) {
        asm volatile("ld.global.f32 %0, [%1];\n" : "=f"(dst) : "l"(src));
    }
    __device__ static inline void stg(float* dst, const float& src) {
        asm volatile("st.global.f32 [%1], %0;\n" : : "f"(src), "l"(dst));
    }
};
template<> struct move<int> {
    __device__ static inline void lds(int& dst, uint32_t src) {
        asm volatile("ld.shared.u32 %0, [%1];\n" : "=r"(dst) : "r"(src));
    }
    __device__ static inline void sts(uint32_t dst, const int& src) {
        asm volatile("st.shared.u32 [%1], %0;\n" : : "r"(src), "r"(dst));
    }
    __device__ static inline void ldg(int& dst, int* src) {
        asm volatile("ld.global.u32 %0, [%1];\n" : "=r"(dst) : "l"(src));
    }
    __device__ static inline void stg(int* dst, const int& src) {
        asm volatile("st.global.u32 [%1], %0;\n" : : "r"(src), "l"(dst));
    }
};
// packed types
template<> struct move<bf16_2> {
    __device__ static inline void lds(bf16_2& dst, uint32_t src) {
        asm volatile("ld.shared.b32 %0, [%1];\n" : "=r"(*(uint32_t*)&dst) : "r"(src));
    }
    __device__ static inline void sts(uint32_t dst, const bf16_2& src) {
        asm volatile("st.shared.b32 [%1], %0;\n" : : "r"(*(uint32_t*)&src), "r"(dst));
    }
    __device__ static inline void ldg(bf16_2& dst, bf16_2* src) {
        asm volatile("ld.global.b32 %0, [%1];\n" : "=r"(*(uint32_t*)&dst) : "l"(src));
    }
    __device__ static inline void stg(bf16_2* dst, const bf16_2& src) {
        asm volatile("st.global.b32 [%1], %0;\n" : : "r"(*(uint32_t*)&src), "l"(dst));
    }
    __device__ static inline void ldsm4(bf16_2& dst1, bf16_2& dst2, bf16_2& dst3, bf16_2& dst4, uint32_t src) {
        asm volatile("ldmatrix.sync.aligned.m8n8.x4.shared::cta.b16 {%0, %1, %2, %3}, [%4];\n" :
                     "=r"(*(uint32_t*)&dst1), "=r"(*(uint32_t*)&dst2), "=r"(*(uint32_t*)&dst3), "=r"(*(uint32_t*)&dst4) : "r"(src));
    }
    __device__ static inline void ldsm4t(bf16_2& dst1, bf16_2& dst2, bf16_2& dst3, bf16_2& dst4, uint32_t src) {
        asm volatile("ldmatrix.sync.aligned.m8n8.x4.trans.shared::cta.b16 {%0, %1, %2, %3}, [%4];\n" :
                     "=r"(*(uint32_t*)&dst1), "=r"(*(uint32_t*)&dst2), "=r"(*(uint32_t*)&dst3), "=r"(*(uint32_t*)&dst4) : "r"(src));
    }
    __device__ static inline void stsm4(uint32_t dst, bf16_2& src1, bf16_2& src2, bf16_2& src3, bf16_2& src4) {
        asm volatile("stmatrix.sync.aligned.m8n8.x4.shared::cta.b16 [%4], {%0, %1, %2, %3};\n" ::
                     "r"(*(uint32_t*)&src1), "r"(*(uint32_t*)&src2), "r"(*(uint32_t*)&src3), "r"(*(uint32_t*)&src4), "r"(dst));
    }
    __device__ static inline void stsm4t(uint32_t dst, bf16_2& src1, bf16_2& src2, bf16_2& src3, bf16_2& src4) {
        asm volatile("stmatrix.sync.aligned.m8n8.x4.trans.shared::cta.b16 [%4], {%0, %1, %2, %3};\n" ::
                     "r"(*(uint32_t*)&src1), "r"(*(uint32_t*)&src2), "r"(*(uint32_t*)&src3), "r"(*(uint32_t*)&src4), "r"(dst));
    }
};
template<> struct move<half_2> {
    __device__ static inline void lds(half_2& dst, uint32_t src) {
        asm volatile("ld.shared.b32 %0, [%1];\n" : "=r"(*(uint32_t*)&dst) : "r"(src));
    }
    __device__ static inline void sts(uint32_t dst, const half_2& src) {
        asm volatile("st.shared.b32 [%1], %0;\n" : : "r"(*(uint32_t*)&src), "r"(dst));
    }
    __device__ static inline void ldg(half_2& dst, half_2* src) {
        asm volatile("ld.global.b32 %0, [%1];\n" : "=r"(*(uint32_t*)&dst) : "l"(src));
    }
    __device__ static inline void stg(half_2* dst, const half_2& src) {
        asm volatile("st.global.b32 [%1], %0;\n" : : "r"(*(uint32_t*)&src), "l"(dst));
    }
    __device__ static inline void ldsm4(half_2& dst1, half_2& dst2, half_2& dst3, half_2& dst4, uint32_t src) {
        asm volatile("ldmatrix.sync.aligned.m8n8.x4.shared::cta.b16 {%0, %1, %2, %3}, [%4];\n" :
                     "=r"(*(uint32_t*)&dst1), "=r"(*(uint32_t*)&dst2), "=r"(*(uint32_t*)&dst3), "=r"(*(uint32_t*)&dst4) : "r"(src));
    }
    __device__ static inline void ldsm4t(half_2& dst1, half_2& dst2, half_2& dst3, half_2& dst4, uint32_t src) {
        asm volatile("ldmatrix.sync.aligned.m8n8.x4.trans.shared::cta.b16 {%0, %1, %2, %3}, [%4];\n" :
                     "=r"(*(uint32_t*)&dst1), "=r"(*(uint32_t*)&dst2), "=r"(*(uint32_t*)&dst3), "=r"(*(uint32_t*)&dst4) : "r"(src));
    }
    __device__ static inline void stsm4(uint32_t dst, half_2& src1, half_2& src2, half_2& src3, half_2& src4) {
        asm volatile("stmatrix.sync.aligned.m8n8.x4.shared::cta.b16 [%4], {%0, %1, %2, %3};\n" ::
                     "r"(*(uint32_t*)&src1), "r"(*(uint32_t*)&src2), "r"(*(uint32_t*)&src3), "r"(*(uint32_t*)&src4), "r"(dst));
    }
    __device__ static inline void stsm4t(uint32_t dst, half_2& src1, half_2& src2, half_2& src3, half_2& src4) {
        asm volatile("stmatrix.sync.aligned.m8n8.x4.trans.shared::cta.b16 [%4], {%0, %1, %2, %3};\n" ::
                     "r"(*(uint32_t*)&src1), "r"(*(uint32_t*)&src2), "r"(*(uint32_t*)&src3), "r"(*(uint32_t*)&src4), "r"(dst));
    }
};
template<> struct move<float2> {
    __device__ static inline void lds(float2& dst, uint32_t src) {
        asm volatile("ld.shared.v2.f32 {%0, %1}, [%2];\n" : "=f"(dst.x), "=f"(dst.y) : "r"(src));
    }
    __device__ static inline void sts(uint32_t dst, const float2& src) {
        asm volatile("st.shared.v2.f32 [%2], {%0, %1};\n" : : "f"(src.x), "f"(src.y), "r"(dst));
    }
    __device__ static inline void ldg(float2& dst, float2* src) {
        asm volatile("ld.global.v2.f32 {%0, %1}, [%2];\n" : "=f"(dst.x), "=f"(dst.y) : "l"(src));
    }
    __device__ static inline void stg(float2* dst, const float2& src) {
        asm volatile("st.global.v2.f32 [%2], {%0, %1};\n" : : "f"(src.x), "f"(src.y), "l"(dst));
    }
};
template<> struct move<float4> {
    __device__ static inline void lds(float4& dst, uint32_t src) {
        asm volatile("ld.shared.v4.f32 {%0, %1, %2, %3}, [%4];\n" : "=f"(dst.x), "=f"(dst.y), "=f"(dst.z), "=f"(dst.w) : "r"(src));
    }
    __device__ static inline void sts(uint32_t dst, const float4& src) {
        asm volatile("st.shared.v4.f32 [%4], {%0, %1, %2, %3};\n" : : "f"(src.x), "f"(src.y), "f"(src.z), "f"(src.w), "r"(dst));
    }
    __device__ static inline void ldg(float4& dst, float4* src) {
        asm volatile("ld.global.v4.f32 {%0, %1, %2, %3}, [%4];\n" : "=f"(dst.x), "=f"(dst.y), "=f"(dst.z), "=f"(dst.w) : "l"(src));
    }
    __device__ static inline void stg(float4* dst, const float4& src) {
        asm volatile("st.global.v4.f32 [%4], {%0, %1, %2, %3};\n" : : "f"(src.x), "f"(src.y), "f"(src.z), "f"(src.w), "l"(dst));
    }
};
#ifdef KITTENS_HOPPER
template<> struct move<fp8e4m3_4> {
    __device__ static inline void ldsm4(fp8e4m3_4& dst1, fp8e4m3_4& dst2, fp8e4m3_4& dst3, fp8e4m3_4& dst4, uint32_t src) {
        asm volatile("ldmatrix.sync.aligned.m8n8.x4.shared::cta.b16 {%0, %1, %2, %3}, [%4];\n" :
                     "=r"(*(uint32_t*)&dst1),  "=r"(*(uint32_t*)&dst2), "=r"(*(uint32_t*)&dst3), "=r"(*(uint32_t*)&dst4) : "r"(src));
    }
    __device__ static inline void stsm4(uint32_t dst, fp8e4m3_4& src1, fp8e4m3_4& src2, fp8e4m3_4& src3, fp8e4m3_4& src4) {
        asm volatile("stmatrix.sync.aligned.m8n8.x4.shared::cta.b16 [%4], {%0, %1, %2, %3};\n" ::
                     "r"(*(uint32_t*)&src1), "r"(*(uint32_t*)&src2), "r"(*(uint32_t*)&src3), "r"(*(uint32_t*)&src4), "r"(dst));
    }

};
template<> struct move<fp8e5m2_4> {
    __device__ static inline void ldsm4(fp8e5m2_4& dst1, fp8e5m2_4& dst2, fp8e5m2_4& dst3, fp8e5m2_4& dst4, uint32_t src) {
        asm volatile("ldmatrix.sync.aligned.m8n8.x4.shared::cta.b16 {%0, %1, %2, %3}, [%4];\n" :
                     "=r"(*(uint32_t*)&dst1),  "=r"(*(uint32_t*)&dst2), "=r"(*(uint32_t*)&dst3), "=r"(*(uint32_t*)&dst4) : "r"(src));
    }
    __device__ static inline void stsm4(uint32_t dst, fp8e5m2_4& src1, fp8e5m2_4& src2, fp8e5m2_4& src3, fp8e5m2_4& src4) {
        asm volatile("stmatrix.sync.aligned.m8n8.x4.shared::cta.b16 [%4], {%0, %1, %2, %3};\n" ::
                     "r"(*(uint32_t*)&src1), "r"(*(uint32_t*)&src2), "r"(*(uint32_t*)&src3), "r"(*(uint32_t*)&src4), "r"(dst));
    }
};
#endif

/* ----------   Constants for Cache policies  ---------- */

enum cache_policy {
    NORMAL = 0,
    EVICT_FIRST = 1,
    EVICT_LAST = 2
};
template<cache_policy policy> __device__ inline uint64_t make_cache_policy() {
    uint64_t cache_policy_val;
    constexpr float fraction = 1.0f;
    static_assert(policy == cache_policy::EVICT_FIRST || policy == cache_policy::EVICT_LAST, "Unexpected cache policy");
    if constexpr (policy == cache_policy::EVICT_FIRST) {
        asm volatile("createpolicy.fractional.L2::evict_first.b64 %0, %1;\n" : "=l"(cache_policy_val) : "f"(fraction));
    }
    else {
        asm volatile("createpolicy.fractional.L2::evict_last.b64 %0, %1;\n" : "=l"(cache_policy_val) : "f"(fraction));
    }
    return cache_policy_val;
}
/* ----------   Generic (non-Hopper specific) semaphore functions  ---------- */

struct semaphore {
private:
    uint64_t value;
}; // note that this is an opaque type, so the value should not be accessed directly.
template<int num_warps> struct barrier {
    int barrier_id;
    __device__ __forceinline__ barrier(int _id) : barrier_id(_id) {}
    __device__ __forceinline__ barrier operator[](int i) {
        return barrier(barrier_id + i);
    }
};

/**
 * @brief Initializes a synchronization semaphore with a transaction count and sets the expected number of bytes.
 *
 * This function sets up a semaphore that is used to synchronize threads within a block during asynchronous operations.
 * It initializes the semaphore with a thread count semaphore.
 *
 * Additionally, if it is given a shared tile type, it will also call `set_bytes` to prepare for the memory transaction.
 *
 * @param[out] semaphore The semaphore variable to initialize.
 * @param[in] tc The thread counter for the semaphore.
 */
__device__ static inline void init_semaphore(semaphore& bar, int thread_count, int transaction_count=0) {
    void const* const ptr = &bar;
    uint32_t bar_ptr = static_cast<uint32_t>(__cvta_generic_to_shared(ptr)); 

    asm volatile (
        "mbarrier.init.shared::cta.b64 [%0], %1;\n"
        :: "r"(bar_ptr), "r"(thread_count+transaction_count)
    );
}
/**
 * @brief Invalidate an mbarrier
 *
 * @param[out] semaphore The semaphore variable to initialize.
 * @param[in] tc The thread counter for the semaphore.
 */
__device__ static inline void invalidate_semaphore(semaphore& bar) {
    void const* const ptr = &bar;
    uint32_t bar_ptr = static_cast<uint32_t>(__cvta_generic_to_shared(ptr)); 
    asm volatile (
        "mbarrier.inval.shared::cta.b64 [%0];\n"
        :: "r"(bar_ptr)
    );
}

/**
* @brief Arrives at a semaphore.
*
* Marks a warp arrival at an mbarrier
*
* @param semaphore Reference to the semaphore variable.
* @param kPhaseBit The phase bit used for the semaphore.
*/
__device__ static inline void arrive(semaphore& sem) {
    uint32_t mbar_ptr = static_cast<uint32_t>(__cvta_generic_to_shared(&sem)); 
    asm volatile (
        "mbarrier.arrive.release.cta.shared::cta.b64 _, [%0];\n"
        :
        : "r"(mbar_ptr)
        : "memory"
    );
}
template<int num_warps> __device__ static inline void arrive(barrier<num_warps> bar) {
    asm volatile("bar.arrive %0, %1;\n" :: "r"(bar.barrier_id), "n"(num_warps*WARP_THREADS) : "memory");
}

#ifdef KITTENS_HOPPER
/**
* @brief Arrives at a semaphore.
*
* Marks a warp arrival at an mbarrier
*
* @param semaphore Reference to the semaphore variable.
* @param kPhaseBit The phase bit used for the semaphore.
*/
__device__ static inline void arrive(semaphore& sem, uint32_t count) {
    uint32_t mbar_ptr = static_cast<uint32_t>(__cvta_generic_to_shared(&sem));
    asm volatile (
        "mbarrier.arrive.release.cta.shared::cta.b64 _, [%0], %1;\n"
        :
        : "r"(mbar_ptr), "r"(count)
        : "memory"
    );
}
#endif

/**
* @brief Waits for the requested semaphore phase.
*
* @param semaphore Reference to the semaphore variable.
* @param kPhaseBit The phase bit used for the semaphore.
*/
__device__ static inline void wait(semaphore& sem, int kPhaseBit) {
    void const* const ptr = &sem;
    uint32_t mbar_ptr = static_cast<uint32_t>(__cvta_generic_to_shared(ptr)); 

#ifdef KITTENS_HOPPER
    asm volatile (
        "{\n"
        ".reg .pred                P1;\n"
        "LAB_WAIT:\n"
        "mbarrier.try_wait.parity.shared::cta.b64 P1, [%0], %1;\n"
        "@P1                       bra.uni DONE;\n"
        "bra.uni                   LAB_WAIT;\n"
        "DONE:\n"
        "}\n"
        :: "r"(mbar_ptr),
        "r"(kPhaseBit)
    );
#else
    asm volatile (
        "{\n"
        ".reg .pred                P1;\n"
        "LAB_WAIT:\n"
        "mbarrier.test_wait.parity.shared::cta.b64 P1, [%0], %1;\n"
        "@P1                       bra.uni DONE;\n"
        "nanosleep.u32 5;\n" // wait a few nanoseconds on pre-Hopper architectures to save instruction issue slots
        "bra.uni                   LAB_WAIT;\n"
        "DONE:\n"
        "}\n"
        :: "r"(mbar_ptr),
        "r"(kPhaseBit)
    );
#endif
}

__device__ static inline void careful_wait(semaphore& sem, int kPhaseBit) {
    void const* const ptr = &sem;
    uint32_t mbar_ptr = static_cast<uint32_t>(__cvta_generic_to_shared(ptr));

#ifdef KITTENS_HOPPER
    asm volatile (
        "{\n"
        ".reg .b64                 start_clock, current_clock;\n"
        "mov.b64                   start_clock, %clock64;\n"
        ".reg .pred                P_CLOCK;\n"
        ".reg .pred                P1;\n"
        "LAB_WAIT:\n"
        "mbarrier.try_wait.parity.shared::cta.b64 P1, [%0], %1;\n"
        "@P1                       bra.uni DONE;\n"
        "mov.b64                   current_clock, %clock64;\n"
        "sub.u64                   current_clock, current_clock, start_clock;\n"
        "setp.ge.u64               P_CLOCK, current_clock, 1000000;\n"
        "@P_CLOCK                  trap;\n"
        "bra.uni                   LAB_WAIT;\n"
        "DONE:\n"
        "}\n"
        :: "r"(mbar_ptr),
        "r"(kPhaseBit)
    );
#else
    asm volatile (
        "{\n"
        ".reg .pred                P1;\n"
        "LAB_WAIT:\n"
        "mbarrier.test_wait.parity.shared::cta.b64 P1, [%0], %1;\n"
        "@P1                       bra.uni DONE;\n"
        "nanosleep.u32 5;\n" // wait a few nanoseconds on pre-Hopper architectures to save instruction issue slots
        "bra.uni                   LAB_WAIT;\n"
        "DONE:\n"
        "}\n"
        :: "r"(mbar_ptr),
        "r"(kPhaseBit)
    );
#endif
}

/**
* @brief Checks if the requested semaphore phase is ready.
*
* @param semaphore Reference to the semaphore variable.
* @param kPhaseBit The phase bit used for the semaphore.
*/
__device__ static inline int test_wait(semaphore& sem, int kPhaseBit) {
    void const* const ptr = &sem;
    uint32_t mbar_ptr = static_cast<uint32_t>(__cvta_generic_to_shared(ptr));
    int result;
    asm volatile (
        "{\n"
        ".reg .pred P1;\n"
        "mbarrier.test_wait.parity.shared::cta.b64 P1, [%1], %2;\n"
        "selp.u32 %0,1,0,P1;"
        "}\n"
        : "=r"(result)
        : "r"(mbar_ptr), "r"(kPhaseBit)
    );
    return result;
}

__device__ static inline void arrive_and_wait(semaphore& sem, int kPhaseBit) {
    arrive(sem);
    wait(sem, kPhaseBit);
}
template<int num_warps> __device__ static inline void arrive_and_wait(barrier<num_warps> bar) {
    asm volatile("bar.sync %0, %1;\n" :: "r"(bar.barrier_id), "n"(num_warps*WARP_THREADS) : "memory");
}

template<int N=0> __device__ static inline void load_async_wait() { // for completing (non-TMA) async loads
    if constexpr (N == 0) {
        asm volatile("cp.async.wait_all;\n" ::);
    } else {
        asm volatile("cp.async.wait_group %0;\n" :: "n"(N));
    }
    __syncwarp();
}

// meant to be used only with shared tiles and shared vectors
namespace detail {
template<typename T> struct size_info {
    static constexpr uint32_t bytes    = sizeof(std::remove_reference_t<T>);
};
template<ducks::st::all ST> struct size_info<ST> {
    static constexpr uint32_t elements = ST::num_elements;
    static constexpr uint32_t bytes    = ST::num_elements * sizeof(typename ST::dtype);
};
template<ducks::sv::all SV> struct size_info<SV> {
    static constexpr uint32_t elements = SV::length;
    static constexpr uint32_t bytes    = SV::length * sizeof(typename SV::dtype);
};
}
template<typename... Args>             inline constexpr uint32_t size_bytes             = 0; // base case
template<typename T, typename... Args> inline constexpr uint32_t size_bytes<T, Args...> = detail::size_info<T>::bytes + size_bytes<Args...>; // recursive case

} // namespace kittens

#ifdef KITTENS_HOPPER
#include "multimem.cuh"
#include "tma.cuh"
#endif

#ifdef KITTENS_BLACKWELL
#include "tensor.cuh"
#endif

