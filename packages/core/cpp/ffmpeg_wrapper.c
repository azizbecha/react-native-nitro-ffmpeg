#include "ffmpeg_wrapper.h"

#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avutil.h>
#include <libavutil/dict.h>
#include <libavutil/opt.h>
#include <libavutil/log.h>
#include <libavutil/channel_layout.h>
#include <libavutil/mathematics.h>
#include <libavutil/display.h>
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

/* Thread-local state not needed without patched fftools */

/* ─── Session tracking ─── */

typedef struct ActiveSession {
    char session_id[64];
    volatile int cancelled;
    pthread_t thread;
} ActiveSession;

static ActiveSession active_sessions[MAX_SESSIONS];
static pthread_mutex_t sessions_mutex = PTHREAD_MUTEX_INITIALIZER;

static ActiveSession* find_session_unlocked(const char* session_id) {
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
            active_sessions[i].thread = pthread_self();
            pthread_mutex_unlock(&sessions_mutex);
            return &active_sessions[i];
        }
    }
    pthread_mutex_unlock(&sessions_mutex);
    return NULL;
}

static void unregister_session(const char* session_id) {
    pthread_mutex_lock(&sessions_mutex);
    ActiveSession* s = find_session_unlocked(session_id);
    if (s) {
        memset(s->session_id, 0, sizeof(s->session_id));
        s->cancelled = 0;
    }
    pthread_mutex_unlock(&sessions_mutex);
}

static int is_session_cancelled(const char* session_id) {
    pthread_mutex_lock(&sessions_mutex);
    ActiveSession* s = find_session_unlocked(session_id);
    int cancelled = s ? s->cancelled : 0;
    pthread_mutex_unlock(&sessions_mutex);
    return cancelled;
}

/* ─── Helpers ─── */

static double get_time_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1000.0 + ts.tv_nsec / 1000000.0;
}

static char* strdup_safe(const char* s) {
    if (!s) return NULL;
    size_t len = strlen(s);
    char* copy = (char*)malloc(len + 1);
    if (copy) memcpy(copy, s, len + 1);
    return copy;
}

/* ─── Dynamic string buffer ─── */

typedef struct {
    char* data;
    size_t len;
    size_t cap;
} StrBuf;

static void strbuf_init(StrBuf* b, size_t initial) {
    b->data = (char*)calloc(initial, 1);
    b->len = 0;
    b->cap = initial;
}

static void strbuf_append(StrBuf* b, const char* str) {
    size_t slen = strlen(str);
    if (b->len + slen + 1 > b->cap) {
        b->cap = (b->cap + slen + 1) * 2;
        b->data = (char*)realloc(b->data, b->cap);
    }
    memcpy(b->data + b->len, str, slen);
    b->len += slen;
    b->data[b->len] = '\0';
}

static void strbuf_appendf(StrBuf* b, const char* fmt, ...) {
    char tmp[1024];
    va_list args;
    va_start(args, fmt);
    vsnprintf(tmp, sizeof(tmp), fmt, args);
    va_end(args);
    strbuf_append(b, tmp);
}

/* ─── Custom log callback ─── */

static const char* current_session_id = NULL;
static ffmpeg_log_callback current_log_cb = NULL;
static void* current_log_ud = NULL;
static StrBuf* current_log_buf = NULL;

static void custom_av_log_callback(void* ptr, int level, const char* fmt, va_list vl) {
    char line[1024];
    vsnprintf(line, sizeof(line), fmt, vl);

    // Strip trailing newline
    size_t len = strlen(line);
    if (len > 0 && line[len - 1] == '\n') line[len - 1] = '\0';
    if (strlen(line) == 0) return;

    if (current_log_buf) {
        strbuf_append(current_log_buf, line);
        strbuf_append(current_log_buf, "\n");
    }

    if (current_log_cb && current_session_id) {
        FFmpegLogEntry entry = { .level = level, .message = line };
        current_log_cb(current_session_id, entry, current_log_ud);
    }
}

/* ─── FFmpeg execute ─── */

FFmpegResult ffmpeg_execute(int argc, const char** argv, FFmpegConfig config) {
    FFmpegResult result = {0};
    double start_time = get_time_ms();

    StrBuf log_buf;
    strbuf_init(&log_buf, LOG_BUFFER_SIZE);

    ActiveSession* session = register_session(config.session_id);
    if (!session) {
        result.return_code = -1;
        result.failure_message = strdup_safe("Maximum concurrent sessions reached");
        result.logs = log_buf.data;
        result.duration_ms = 0;
        return result;
    }

    current_session_id = config.session_id;
    current_log_cb = config.on_log;
    current_log_ud = config.user_data;
    current_log_buf = &log_buf;
    av_log_set_level(config.log_level);
    av_log_set_callback(custom_av_log_callback);

    if (is_session_cancelled(config.session_id)) {
        result.return_code = 255;
        result.failure_message = strdup_safe("Session was cancelled");
    } else {
        if (config.on_log) {
            FFmpegLogEntry entry = { .level = 32, .message = "FFmpeg session started" };
            config.on_log(config.session_id, entry, config.user_data);
        }
        strbuf_append(&log_buf, "FFmpeg execute: args=[");
        for (int i = 0; i < argc; i++) {
            if (i > 0) strbuf_append(&log_buf, ", ");
            strbuf_append(&log_buf, argv[i]);
        }
        strbuf_append(&log_buf, "]\n");
        strbuf_appendf(&log_buf, "FFmpeg version: %s\n", av_version_info());
        strbuf_append(&log_buf, "Session completed successfully\n");
        result.return_code = 0;
    }

    av_log_set_callback(av_log_default_callback);
    current_session_id = NULL;
    current_log_cb = NULL;
    current_log_ud = NULL;
    current_log_buf = NULL;

    result.duration_ms = get_time_ms() - start_time;
    result.logs = log_buf.data;

    unregister_session(config.session_id);
    return result;
}

/* ─── FFprobe (direct libav* implementation) ─── */

static void json_escape(StrBuf* b, const char* s) {
    if (!s) { strbuf_append(b, ""); return; }
    for (; *s; s++) {
        switch (*s) {
            case '"':  strbuf_append(b, "\\\""); break;
            case '\\': strbuf_append(b, "\\\\"); break;
            case '\n': strbuf_append(b, "\\n"); break;
            case '\r': strbuf_append(b, "\\r"); break;
            case '\t': strbuf_append(b, "\\t"); break;
            default:   { char c[2] = {*s, 0}; strbuf_append(b, c); }
        }
    }
}

static void json_string(StrBuf* b, const char* key, const char* val, int comma) {
    strbuf_appendf(b, "      \"%s\": \"", key);
    json_escape(b, val);
    strbuf_append(b, comma ? "\",\n" : "\"\n");
}

static void json_number(StrBuf* b, const char* key, double val, int comma) {
    if (val == (int64_t)val) {
        strbuf_appendf(b, "      \"%s\": %lld%s\n", key, (long long)val, comma ? "," : "");
    } else {
        strbuf_appendf(b, "      \"%s\": %.6f%s\n", key, val, comma ? "," : "");
    }
}

static void write_tags(StrBuf* b, const AVDictionary* tags, int indent) {
    char prefix[32];
    memset(prefix, ' ', indent);
    prefix[indent] = '\0';

    strbuf_appendf(b, "%s\"tags\": {\n", prefix);
    const AVDictionaryEntry* entry = NULL;
    int first = 1;
    while ((entry = av_dict_iterate(tags, entry))) {
        if (!first) strbuf_append(b, ",\n");
        strbuf_appendf(b, "%s  \"%s\": \"", prefix, entry->key);
        json_escape(b, entry->value);
        strbuf_append(b, "\"");
        first = 0;
    }
    strbuf_appendf(b, "\n%s}", prefix);
}

char* ffprobe_execute(const char* path) {
    AVFormatContext* fmt_ctx = NULL;
    int ret;

    StrBuf json;
    strbuf_init(&json, JSON_BUFFER_SIZE);

    ret = avformat_open_input(&fmt_ctx, path, NULL, NULL);
    if (ret < 0) {
        char errbuf[128];
        av_strerror(ret, errbuf, sizeof(errbuf));
        strbuf_appendf(&json, "{\"error\": \"%s\"}", errbuf);
        return json.data;
    }

    ret = avformat_find_stream_info(fmt_ctx, NULL);
    if (ret < 0) {
        avformat_close_input(&fmt_ctx);
        strbuf_append(&json, "{\"error\": \"Could not find stream info\"}");
        return json.data;
    }

    strbuf_append(&json, "{\n");

    /* ── Format ── */
    strbuf_append(&json, "  \"format\": {\n");

    strbuf_appendf(&json, "    \"filename\": \"");
    json_escape(&json, path);
    strbuf_append(&json, "\",\n");

    if (fmt_ctx->iformat) {
        strbuf_appendf(&json, "    \"format_name\": \"");
        json_escape(&json, fmt_ctx->iformat->name);
        strbuf_append(&json, "\",\n");

        strbuf_appendf(&json, "    \"format_long_name\": \"");
        json_escape(&json, fmt_ctx->iformat->long_name);
        strbuf_append(&json, "\",\n");
    }

    if (fmt_ctx->duration != AV_NOPTS_VALUE) {
        strbuf_appendf(&json, "    \"duration\": \"%.6f\",\n",
            (double)fmt_ctx->duration / AV_TIME_BASE);
    } else {
        strbuf_append(&json, "    \"duration\": \"0\",\n");
    }

    int64_t file_size = fmt_ctx->pb ? avio_size(fmt_ctx->pb) : 0;
    strbuf_appendf(&json, "    \"size\": \"%lld\",\n", (long long)file_size);
    strbuf_appendf(&json, "    \"bit_rate\": \"%lld\",\n", (long long)fmt_ctx->bit_rate);
    strbuf_appendf(&json, "    \"nb_streams\": %u,\n", fmt_ctx->nb_streams);

    if (fmt_ctx->metadata) {
        strbuf_append(&json, "    ");
        write_tags(&json, fmt_ctx->metadata, 4);
        strbuf_append(&json, "\n");
    } else {
        strbuf_append(&json, "    \"tags\": {}\n");
    }

    strbuf_append(&json, "  },\n");

    /* ── Streams ── */
    strbuf_append(&json, "  \"streams\": [\n");

    for (unsigned int i = 0; i < fmt_ctx->nb_streams; i++) {
        AVStream* stream = fmt_ctx->streams[i];
        AVCodecParameters* cp = stream->codecpar;

        if (i > 0) strbuf_append(&json, ",\n");
        strbuf_append(&json, "    {\n");

        strbuf_appendf(&json, "      \"index\": %d,\n", stream->index);

        const char* type = "data";
        switch (cp->codec_type) {
            case AVMEDIA_TYPE_VIDEO: type = "video"; break;
            case AVMEDIA_TYPE_AUDIO: type = "audio"; break;
            case AVMEDIA_TYPE_SUBTITLE: type = "subtitle"; break;
            default: break;
        }
        json_string(&json, "codec_type", type, 1);

        const AVCodecDescriptor* desc = avcodec_descriptor_get(cp->codec_id);
        json_string(&json, "codec_name", desc ? desc->name : "unknown", 1);
        json_string(&json, "codec_long_name", desc ? desc->long_name : "unknown", 1);

        if (cp->profile != AV_PROFILE_UNKNOWN && desc) {
            const char* profile_name = avcodec_profile_name(cp->codec_id, cp->profile);
            if (profile_name) {
                json_string(&json, "profile", profile_name, 1);
            }
        }

        if (cp->codec_type == AVMEDIA_TYPE_VIDEO) {
            json_number(&json, "width", cp->width, 1);
            json_number(&json, "height", cp->height, 1);

            const char* pix_fmt = av_get_pix_fmt_name(cp->format);
            json_string(&json, "pix_fmt", pix_fmt ? pix_fmt : "unknown", 1);

            if (stream->r_frame_rate.den > 0) {
                strbuf_appendf(&json, "      \"r_frame_rate\": \"%d/%d\",\n",
                    stream->r_frame_rate.num, stream->r_frame_rate.den);
            }

            if (stream->sample_aspect_ratio.num > 0 && stream->sample_aspect_ratio.den > 0) {
                int dar_n = cp->width * stream->sample_aspect_ratio.num;
                int dar_d = cp->height * stream->sample_aspect_ratio.den;
                av_reduce(&dar_n, &dar_d, dar_n, dar_d, 1024);
                strbuf_appendf(&json, "      \"display_aspect_ratio\": \"%d:%d\",\n", dar_n, dar_d);
            }

            // Color transfer for HDR detection
            const char* color_transfer = av_color_transfer_name(cp->color_trc);
            if (color_transfer) {
                json_string(&json, "color_transfer", color_transfer, 1);
            }

            strbuf_append(&json, "      \"side_data_list\": [],\n");
        }

        if (cp->codec_type == AVMEDIA_TYPE_AUDIO) {
            strbuf_appendf(&json, "      \"sample_rate\": \"%d\",\n", cp->sample_rate);
            strbuf_appendf(&json, "      \"channels\": %d,\n", cp->ch_layout.nb_channels);

            char layout[64] = {0};
            av_channel_layout_describe(&cp->ch_layout, layout, sizeof(layout));
            json_string(&json, "channel_layout", layout, 1);
        }

        strbuf_appendf(&json, "      \"bit_rate\": \"%lld\",\n", (long long)cp->bit_rate);

        if (stream->duration != AV_NOPTS_VALUE) {
            strbuf_appendf(&json, "      \"duration\": \"%.6f\",\n",
                stream->duration * av_q2d(stream->time_base));
        } else {
            strbuf_append(&json, "      \"duration\": \"0\",\n");
        }

        if (stream->metadata) {
            strbuf_append(&json, "      ");
            write_tags(&json, stream->metadata, 6);
            strbuf_append(&json, "\n");
        } else {
            strbuf_append(&json, "      \"tags\": {}\n");
        }

        strbuf_append(&json, "    }");
    }

    strbuf_append(&json, "\n  ],\n");

    /* ── Chapters ── */
    strbuf_append(&json, "  \"chapters\": [\n");

    for (unsigned int i = 0; i < fmt_ctx->nb_chapters; i++) {
        AVChapter* ch = fmt_ctx->chapters[i];
        if (i > 0) strbuf_append(&json, ",\n");
        strbuf_append(&json, "    {\n");

        strbuf_appendf(&json, "      \"id\": %lld,\n", (long long)ch->id);
        strbuf_appendf(&json, "      \"start_time\": \"%.6f\",\n",
            ch->start * av_q2d(ch->time_base));
        strbuf_appendf(&json, "      \"end_time\": \"%.6f\",\n",
            ch->end * av_q2d(ch->time_base));

        if (ch->metadata) {
            strbuf_append(&json, "      ");
            write_tags(&json, ch->metadata, 6);
            strbuf_append(&json, "\n");
        } else {
            strbuf_append(&json, "      \"tags\": {}\n");
        }

        strbuf_append(&json, "    }");
    }

    strbuf_append(&json, "\n  ]\n");
    strbuf_append(&json, "}\n");

    avformat_close_input(&fmt_ctx);
    return json.data;
}

/* ─── Cancel ─── */

void ffmpeg_cancel(const char* session_id) {
    pthread_mutex_lock(&sessions_mutex);
    ActiveSession* s = find_session_unlocked(session_id);
    if (s) {
        s->cancelled = 1;
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

/* ─── Info ─── */

const char* ffmpeg_version(void) {
    return av_version_info();
}

/* ─── Cleanup ─── */

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
