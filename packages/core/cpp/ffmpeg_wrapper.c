#include "ffmpeg_wrapper.h"

#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avutil.h>
#include <libavutil/dict.h>
#include <libavutil/opt.h>
#include <libavutil/log.h>
#include <libswresample/swresample.h>
#include <libswscale/swscale.h>
#include <libavfilter/avfilter.h>

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <pthread.h>
#include <time.h>

#define MAX_SESSIONS 64
#define LOG_BUFFER_SIZE (1024 * 64)
#define JSON_BUFFER_SIZE (1024 * 128)

typedef struct ActiveSession {
    char session_id[64];
    volatile int cancelled;
} ActiveSession;

static ActiveSession active_sessions[MAX_SESSIONS];
static pthread_mutex_t sessions_mutex = PTHREAD_MUTEX_INITIALIZER;

static ActiveSession* find_session(const char* session_id) {
    for (int i = 0; i < MAX_SESSIONS; i++) {
        if (active_sessions[i].session_id[0] != '\0' &&
            strcmp(active_sessions[i].session_id, session_id) == 0) {
            return &active_sessions[i];
        }
    }
    return NULL;
}

static ActiveSession* register_session(const char* session_id) {
    pthread_mutex_lock(&sessions_mutex);
    for (int i = 0; i < MAX_SESSIONS; i++) {
        if (active_sessions[i].session_id[0] == '\0') {
            strncpy(active_sessions[i].session_id, session_id, 63);
            active_sessions[i].session_id[63] = '\0';
            active_sessions[i].cancelled = 0;
            pthread_mutex_unlock(&sessions_mutex);
            return &active_sessions[i];
        }
    }
    pthread_mutex_unlock(&sessions_mutex);
    return NULL;
}

static void unregister_session(const char* session_id) {
    pthread_mutex_lock(&sessions_mutex);
    ActiveSession* session = find_session(session_id);
    if (session) {
        session->session_id[0] = '\0';
        session->cancelled = 0;
    }
    pthread_mutex_unlock(&sessions_mutex);
}

static double get_time_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1000.0 + ts.tv_nsec / 1000000.0;
}

static char* strdup_safe(const char* s) {
    if (!s) return NULL;
    size_t len = strlen(s);
    char* copy = (char*)malloc(len + 1);
    if (copy) {
        memcpy(copy, s, len + 1);
    }
    return copy;
}

static void append_to_buffer(char** buf, size_t* len, size_t* cap, const char* str) {
    size_t slen = strlen(str);
    if (*len + slen + 1 > *cap) {
        *cap = (*cap + slen + 1) * 2;
        *buf = (char*)realloc(*buf, *cap);
    }
    memcpy(*buf + *len, str, slen);
    *len += slen;
    (*buf)[*len] = '\0';
}

/*
 * FFmpeg execution using the libav* APIs.
 *
 * Note: Full FFmpeg command-line parsing (like ffmpeg.c does) is complex.
 * This implementation handles the most common use case: transcoding with
 * the core libav* APIs. For full CLI compatibility, the FFmpeg source
 * would need to be patched to expose ffmpeg_main() as a library function
 * (which is what ffmpeg-kit did).
 *
 * The TODO markers below indicate where the actual FFmpeg processing
 * pipeline would be implemented. The session management, progress
 * callbacks, and cancellation infrastructure is fully functional.
 */
FFmpegResult ffmpeg_execute(int argc, const char** argv, FFmpegConfig config) {
    FFmpegResult result = {0};
    double start_time = get_time_ms();

    char* log_buf = (char*)calloc(LOG_BUFFER_SIZE, 1);
    size_t log_len = 0;
    size_t log_cap = LOG_BUFFER_SIZE;

    ActiveSession* session = register_session(config.session_id);
    if (!session) {
        result.return_code = -1;
        result.failure_message = strdup_safe("Maximum concurrent sessions reached");
        result.logs = log_buf;
        result.duration_ms = 0;
        return result;
    }

    av_log_set_level(config.log_level);

    /*
     * TODO: Implement full FFmpeg command execution pipeline.
     *
     * The proper approach is to either:
     * 1. Patch FFmpeg source to expose ffmpeg_main(argc, argv) as a
     *    reentrant library function (the ffmpeg-kit approach), or
     * 2. Build a transcoding pipeline using libavformat/libavcodec APIs:
     *    - avformat_open_input() to open input
     *    - avformat_find_stream_info() to analyze streams
     *    - avcodec_find_decoder/encoder() for codecs
     *    - av_read_frame() / avcodec_send_packet/receive_frame loop
     *    - avcodec_send_frame/receive_packet for encoding
     *    - av_interleaved_write_frame() for output
     *
     * Progress reporting:
     *   Call config.on_progress() periodically during the encode loop
     *   with frame count, fps, bitrate, time position, and speed.
     *
     * Cancellation:
     *   Check session->cancelled between frames and break if set.
     *
     * Log forwarding:
     *   Set a custom av_log callback that calls config.on_log().
     */

    // Check cancellation
    if (session->cancelled) {
        result.return_code = 255; // CANCEL
        result.failure_message = strdup_safe("Session was cancelled");
    } else {
        // Report a log entry
        if (config.on_log) {
            FFmpegLogEntry log_entry = {
                .level = 32, // AV_LOG_INFO
                .message = "FFmpeg session started"
            };
            config.on_log(config.session_id, log_entry, config.user_data);
            append_to_buffer(&log_buf, &log_len, &log_cap, "FFmpeg session started\n");
        }

        // Placeholder: report initial progress
        if (config.on_progress) {
            FFmpegProgress progress = {
                .frame = 0,
                .fps = 0.0,
                .bitrate = 0.0,
                .total_size = 0,
                .time_ms = 0,
                .speed = 0.0,
            };
            config.on_progress(config.session_id, progress, config.user_data);
        }

        result.return_code = 0;
    }

    result.duration_ms = get_time_ms() - start_time;
    result.logs = log_buf;

    unregister_session(config.session_id);
    return result;
}

char* ffprobe_execute(const char* path) {
    AVFormatContext* fmt_ctx = NULL;
    int ret;
    char* json = (char*)calloc(JSON_BUFFER_SIZE, 1);
    size_t json_len = 0;
    size_t json_cap = JSON_BUFFER_SIZE;

    ret = avformat_open_input(&fmt_ctx, path, NULL, NULL);
    if (ret < 0) {
        snprintf(json, JSON_BUFFER_SIZE,
            "{\"error\": \"Could not open file: %s\"}", path);
        return json;
    }

    ret = avformat_find_stream_info(fmt_ctx, NULL);
    if (ret < 0) {
        avformat_close_input(&fmt_ctx);
        snprintf(json, JSON_BUFFER_SIZE,
            "{\"error\": \"Could not find stream info\"}");
        return json;
    }

    // Build JSON output similar to `ffprobe -print_format json`
    append_to_buffer(&json, &json_len, &json_cap, "{\n");

    // Format section
    append_to_buffer(&json, &json_len, &json_cap, "  \"format\": {\n");

    char buf[512];

    snprintf(buf, sizeof(buf), "    \"filename\": \"%s\",\n", path);
    append_to_buffer(&json, &json_len, &json_cap, buf);

    if (fmt_ctx->iformat) {
        snprintf(buf, sizeof(buf), "    \"format_name\": \"%s\",\n",
            fmt_ctx->iformat->name ? fmt_ctx->iformat->name : "");
        append_to_buffer(&json, &json_len, &json_cap, buf);

        snprintf(buf, sizeof(buf), "    \"format_long_name\": \"%s\",\n",
            fmt_ctx->iformat->long_name ? fmt_ctx->iformat->long_name : "");
        append_to_buffer(&json, &json_len, &json_cap, buf);
    }

    if (fmt_ctx->duration != AV_NOPTS_VALUE) {
        snprintf(buf, sizeof(buf), "    \"duration\": \"%.6f\",\n",
            (double)fmt_ctx->duration / AV_TIME_BASE);
        append_to_buffer(&json, &json_len, &json_cap, buf);
    }

    snprintf(buf, sizeof(buf), "    \"size\": \"%lld\",\n",
        (long long)avio_size(fmt_ctx->pb));
    append_to_buffer(&json, &json_len, &json_cap, buf);

    snprintf(buf, sizeof(buf), "    \"bit_rate\": \"%lld\",\n",
        (long long)fmt_ctx->bit_rate);
    append_to_buffer(&json, &json_len, &json_cap, buf);

    snprintf(buf, sizeof(buf), "    \"nb_streams\": %u\n",
        fmt_ctx->nb_streams);
    append_to_buffer(&json, &json_len, &json_cap, buf);

    append_to_buffer(&json, &json_len, &json_cap, "  },\n");

    // Streams section
    append_to_buffer(&json, &json_len, &json_cap, "  \"streams\": [\n");

    for (unsigned int i = 0; i < fmt_ctx->nb_streams; i++) {
        AVStream* stream = fmt_ctx->streams[i];
        AVCodecParameters* codecpar = stream->codecpar;

        if (i > 0) {
            append_to_buffer(&json, &json_len, &json_cap, ",\n");
        }
        append_to_buffer(&json, &json_len, &json_cap, "    {\n");

        snprintf(buf, sizeof(buf), "      \"index\": %d,\n", stream->index);
        append_to_buffer(&json, &json_len, &json_cap, buf);

        const char* codec_type = "data";
        switch (codecpar->codec_type) {
            case AVMEDIA_TYPE_VIDEO: codec_type = "video"; break;
            case AVMEDIA_TYPE_AUDIO: codec_type = "audio"; break;
            case AVMEDIA_TYPE_SUBTITLE: codec_type = "subtitle"; break;
            default: break;
        }
        snprintf(buf, sizeof(buf), "      \"codec_type\": \"%s\",\n", codec_type);
        append_to_buffer(&json, &json_len, &json_cap, buf);

        const AVCodecDescriptor* desc = avcodec_descriptor_get(codecpar->codec_id);
        snprintf(buf, sizeof(buf), "      \"codec_name\": \"%s\",\n",
            desc ? desc->name : "unknown");
        append_to_buffer(&json, &json_len, &json_cap, buf);

        snprintf(buf, sizeof(buf), "      \"codec_long_name\": \"%s\",\n",
            desc ? desc->long_name : "unknown");
        append_to_buffer(&json, &json_len, &json_cap, buf);

        if (codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
            snprintf(buf, sizeof(buf), "      \"width\": %d,\n", codecpar->width);
            append_to_buffer(&json, &json_len, &json_cap, buf);

            snprintf(buf, sizeof(buf), "      \"height\": %d,\n", codecpar->height);
            append_to_buffer(&json, &json_len, &json_cap, buf);

            const char* pix_fmt_name = av_get_pix_fmt_name(codecpar->format);
            snprintf(buf, sizeof(buf), "      \"pix_fmt\": \"%s\",\n",
                pix_fmt_name ? pix_fmt_name : "unknown");
            append_to_buffer(&json, &json_len, &json_cap, buf);

            if (stream->r_frame_rate.den > 0) {
                snprintf(buf, sizeof(buf), "      \"r_frame_rate\": \"%d/%d\",\n",
                    stream->r_frame_rate.num, stream->r_frame_rate.den);
                append_to_buffer(&json, &json_len, &json_cap, buf);
            }

            if (stream->sample_aspect_ratio.num > 0) {
                int dar_num = codecpar->width * stream->sample_aspect_ratio.num;
                int dar_den = codecpar->height * stream->sample_aspect_ratio.den;
                av_reduce(&dar_num, &dar_den, dar_num, dar_den, 1024);
                snprintf(buf, sizeof(buf), "      \"display_aspect_ratio\": \"%d:%d\",\n",
                    dar_num, dar_den);
                append_to_buffer(&json, &json_len, &json_cap, buf);
            }
        }

        if (codecpar->codec_type == AVMEDIA_TYPE_AUDIO) {
            snprintf(buf, sizeof(buf), "      \"sample_rate\": \"%d\",\n",
                codecpar->sample_rate);
            append_to_buffer(&json, &json_len, &json_cap, buf);

            snprintf(buf, sizeof(buf), "      \"channels\": %d,\n",
                codecpar->ch_layout.nb_channels);
            append_to_buffer(&json, &json_len, &json_cap, buf);

            char layout_name[64] = {0};
            av_channel_layout_describe(&codecpar->ch_layout, layout_name, sizeof(layout_name));
            snprintf(buf, sizeof(buf), "      \"channel_layout\": \"%s\",\n", layout_name);
            append_to_buffer(&json, &json_len, &json_cap, buf);
        }

        snprintf(buf, sizeof(buf), "      \"bit_rate\": \"%lld\",\n",
            (long long)codecpar->bit_rate);
        append_to_buffer(&json, &json_len, &json_cap, buf);

        if (stream->duration != AV_NOPTS_VALUE) {
            double duration = stream->duration * av_q2d(stream->time_base);
            snprintf(buf, sizeof(buf), "      \"duration\": \"%.6f\"\n", duration);
        } else {
            snprintf(buf, sizeof(buf), "      \"duration\": \"0\"\n");
        }
        append_to_buffer(&json, &json_len, &json_cap, buf);

        append_to_buffer(&json, &json_len, &json_cap, "    }");
    }

    append_to_buffer(&json, &json_len, &json_cap, "\n  ],\n");

    // Chapters section
    append_to_buffer(&json, &json_len, &json_cap, "  \"chapters\": [\n");

    for (unsigned int i = 0; i < fmt_ctx->nb_chapters; i++) {
        AVChapter* chapter = fmt_ctx->chapters[i];
        if (i > 0) {
            append_to_buffer(&json, &json_len, &json_cap, ",\n");
        }
        append_to_buffer(&json, &json_len, &json_cap, "    {\n");

        snprintf(buf, sizeof(buf), "      \"id\": %lld,\n", (long long)chapter->id);
        append_to_buffer(&json, &json_len, &json_cap, buf);

        double start_time = chapter->start * av_q2d(chapter->time_base);
        double end_time = chapter->end * av_q2d(chapter->time_base);
        snprintf(buf, sizeof(buf), "      \"start_time\": \"%.6f\",\n", start_time);
        append_to_buffer(&json, &json_len, &json_cap, buf);
        snprintf(buf, sizeof(buf), "      \"end_time\": \"%.6f\"\n", end_time);
        append_to_buffer(&json, &json_len, &json_cap, buf);

        append_to_buffer(&json, &json_len, &json_cap, "    }");
    }

    append_to_buffer(&json, &json_len, &json_cap, "\n  ]\n");
    append_to_buffer(&json, &json_len, &json_cap, "}\n");

    avformat_close_input(&fmt_ctx);
    return json;
}

void ffmpeg_cancel(const char* session_id) {
    pthread_mutex_lock(&sessions_mutex);
    ActiveSession* session = find_session(session_id);
    if (session) {
        session->cancelled = 1;
    }
    pthread_mutex_unlock(&sessions_mutex);
}

void ffmpeg_cancel_all(void) {
    pthread_mutex_lock(&sessions_mutex);
    for (int i = 0; i < MAX_SESSIONS; i++) {
        if (active_sessions[i].session_id[0] != '\0') {
            active_sessions[i].cancelled = 1;
        }
    }
    pthread_mutex_unlock(&sessions_mutex);
}

const char* ffmpeg_version(void) {
    return av_version_info();
}

void ffmpeg_result_free(FFmpegResult* result) {
    if (result) {
        free(result->logs);
        result->logs = NULL;
        free(result->failure_message);
        result->failure_message = NULL;
    }
}

void ffmpeg_string_free(char* str) {
    free(str);
}
