#pragma once

#ifdef __cplusplus
extern "C" {
#endif

#include <setjmp.h>
#include <stdint.h>

/*
 * Bridge to patched FFmpeg fftools.
 *
 * When FFmpeg is built with our patch (scripts/patches/ffmpeg-as-library.patch),
 * it exposes ffmpeg_execute_main() and ffprobe_execute_main() as callable
 * library functions instead of standalone executables.
 *
 * Thread-local globals allow per-session state for:
 * - Return code capture (instead of exit())
 * - longjmp-based error recovery (instead of exit())
 * - Progress callbacks injected into the encode loop
 * - Cancellation flag checked between frames
 */

// Declared in the patched FFmpeg fftools
extern __thread int ffmpegkit_return_code;
extern __thread int ffmpegkit_longjmp_active;
extern __thread jmp_buf ffmpegkit_longjmp_buf;
extern __thread volatile int ffmpegkit_cancelled;

// Progress callback set by the wrapper before calling ffmpeg_execute_main
typedef void (*ffmpegkit_progress_fn)(
    int64_t frame,
    double fps,
    double bitrate,
    int64_t total_size,
    int64_t time_ms,
    double speed,
    void* user_data
);
extern __thread ffmpegkit_progress_fn ffmpegkit_progress_callback;
extern __thread void* ffmpegkit_progress_user_data;

// Log callback
typedef void (*ffmpegkit_log_fn)(int level, const char* message, void* user_data);
extern __thread ffmpegkit_log_fn ffmpegkit_log_callback;
extern __thread void* ffmpegkit_log_user_data;

/*
 * Execute FFmpeg as a library call.
 * This is the patched version of FFmpeg's main() that returns instead of calling exit().
 * Returns the FFmpeg return code (0 = success, 255 = cancelled/signal).
 */
int ffmpeg_execute_main(int argc, char** argv);

/*
 * Execute FFprobe as a library call.
 * Returns the FFprobe return code.
 */
int ffprobe_execute_main(int argc, char** argv);

#ifdef __cplusplus
}
#endif
