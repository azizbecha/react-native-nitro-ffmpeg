#pragma once

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>

typedef struct FFmpegProgress {
    int64_t frame;
    double fps;
    double bitrate;
    int64_t total_size;
    int64_t time_ms;
    double speed;
} FFmpegProgress;

typedef struct FFmpegLogEntry {
    int level;
    const char* message;
} FFmpegLogEntry;

typedef void (*ffmpeg_progress_callback)(const char* session_id, FFmpegProgress progress, void* user_data);
typedef void (*ffmpeg_log_callback)(const char* session_id, FFmpegLogEntry log, void* user_data);

typedef struct FFmpegConfig {
    const char* session_id;
    ffmpeg_progress_callback on_progress;
    ffmpeg_log_callback on_log;
    void* user_data;
    int log_level;
} FFmpegConfig;

typedef struct FFmpegResult {
    int return_code;
    double duration_ms;
    char* logs;
    char* failure_message;
} FFmpegResult;

/**
 * Execute an FFmpeg command.
 * @param argc Number of arguments
 * @param argv Array of argument strings
 * @param config Execution configuration with callbacks
 * @return Result with return code and logs. Caller must free logs and failure_message.
 */
FFmpegResult ffmpeg_execute(int argc, const char** argv, FFmpegConfig config);

/**
 * Execute an FFprobe command and return JSON output.
 * @param path Path to the media file
 * @return JSON string. Caller must free the returned string.
 */
char* ffprobe_execute(const char* path);

/**
 * Cancel a running FFmpeg session.
 * @param session_id The session ID to cancel
 */
void ffmpeg_cancel(const char* session_id);

/**
 * Cancel all running FFmpeg sessions.
 */
void ffmpeg_cancel_all(void);

/**
 * Get the FFmpeg version string.
 * @return Version string (static, do not free)
 */
const char* ffmpeg_version(void);

/**
 * Free an FFmpegResult's allocated strings.
 */
void ffmpeg_result_free(FFmpegResult* result);

/**
 * Free a string allocated by ffprobe_execute.
 */
void ffmpeg_string_free(char* str);

#ifdef __cplusplus
}
#endif
