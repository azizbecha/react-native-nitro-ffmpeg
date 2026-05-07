#include <jni.h>
#include <string>
#include <vector>
#include "ffmpeg_wrapper.h"

extern "C" {

struct JNICallbackContext {
    JNIEnv* env;
    jobject progressCallback;
    jobject logCallback;
    jmethodID progressInvoke;
    jmethodID logInvoke;
};

static void jni_progress_callback(const char* session_id, FFmpegProgress progress, void* user_data) {
    auto* ctx = static_cast<JNICallbackContext*>(user_data);
    if (!ctx || !ctx->progressCallback) return;

    JNIEnv* env = ctx->env;
    jstring jSessionId = env->NewStringUTF(session_id);

    env->CallVoidMethod(ctx->progressCallback, ctx->progressInvoke,
        jSessionId,
        static_cast<jdouble>(progress.frame),
        static_cast<jdouble>(progress.fps),
        static_cast<jdouble>(progress.bitrate),
        static_cast<jdouble>(progress.total_size),
        static_cast<jdouble>(progress.time_ms),
        static_cast<jdouble>(progress.speed)
    );

    env->DeleteLocalRef(jSessionId);
}

static void jni_log_callback(const char* session_id, FFmpegLogEntry log, void* user_data) {
    auto* ctx = static_cast<JNICallbackContext*>(user_data);
    if (!ctx || !ctx->logCallback) return;

    JNIEnv* env = ctx->env;
    jstring jSessionId = env->NewStringUTF(session_id);
    jstring jMessage = env->NewStringUTF(log.message ? log.message : "");

    env->CallVoidMethod(ctx->logCallback, ctx->logInvoke,
        jSessionId,
        static_cast<jdouble>(log.level),
        jMessage
    );

    env->DeleteLocalRef(jSessionId);
    env->DeleteLocalRef(jMessage);
}

JNIEXPORT jint JNICALL
Java_com_margelo_nitro_ffmpeg_HybridFFmpeg_nativeExecute(
    JNIEnv* env,
    jobject thiz,
    jstring jSessionId,
    jobjectArray jArgs,
    jint logLevel,
    jobject progressCallback,
    jobject logCallback
) {
    const char* sessionId = env->GetStringUTFChars(jSessionId, nullptr);

    int argc = env->GetArrayLength(jArgs);
    std::vector<std::string> argStrings(argc);
    std::vector<const char*> argv(argc);

    for (int i = 0; i < argc; i++) {
        auto jArg = static_cast<jstring>(env->GetObjectArrayElement(jArgs, i));
        const char* arg = env->GetStringUTFChars(jArg, nullptr);
        argStrings[i] = arg;
        argv[i] = argStrings[i].c_str();
        env->ReleaseStringUTFChars(jArg, arg);
        env->DeleteLocalRef(jArg);
    }

    // Get invoke method IDs for the callbacks
    jclass progressClass = env->GetObjectClass(progressCallback);
    jmethodID progressInvoke = env->GetMethodID(progressClass, "invoke",
        "(Ljava/lang/Object;Ljava/lang/Object;Ljava/lang/Object;Ljava/lang/Object;Ljava/lang/Object;Ljava/lang/Object;Ljava/lang/Object;)V");

    jclass logClass = env->GetObjectClass(logCallback);
    jmethodID logInvoke = env->GetMethodID(logClass, "invoke",
        "(Ljava/lang/Object;Ljava/lang/Object;Ljava/lang/Object;)V");

    JNICallbackContext ctx = {
        .env = env,
        .progressCallback = progressCallback,
        .logCallback = logCallback,
        .progressInvoke = progressInvoke,
        .logInvoke = logInvoke,
    };

    FFmpegConfig config = {};
    config.session_id = sessionId;
    config.on_progress = jni_progress_callback;
    config.on_log = jni_log_callback;
    config.user_data = &ctx;
    config.log_level = logLevel;

    FFmpegResult result = ffmpeg_execute(argc, argv.data(), config);
    int returnCode = result.return_code;

    ffmpeg_result_free(&result);
    env->ReleaseStringUTFChars(jSessionId, sessionId);

    return returnCode;
}

JNIEXPORT void JNICALL
Java_com_margelo_nitro_ffmpeg_HybridFFmpeg_nativeCancel(
    JNIEnv* env,
    jobject thiz,
    jstring jSessionId
) {
    const char* sessionId = env->GetStringUTFChars(jSessionId, nullptr);
    ffmpeg_cancel(sessionId);
    env->ReleaseStringUTFChars(jSessionId, sessionId);
}

JNIEXPORT void JNICALL
Java_com_margelo_nitro_ffmpeg_HybridFFmpeg_nativeCancelAll(
    JNIEnv* env,
    jobject thiz
) {
    ffmpeg_cancel_all();
}

JNIEXPORT jstring JNICALL
Java_com_margelo_nitro_ffmpeg_HybridFFmpeg_nativeProbe(
    JNIEnv* env,
    jobject thiz,
    jstring jPath
) {
    const char* path = env->GetStringUTFChars(jPath, nullptr);
    char* json = ffprobe_execute(path);
    env->ReleaseStringUTFChars(jPath, path);

    jstring result = env->NewStringUTF(json ? json : "{}");
    ffmpeg_string_free(json);
    return result;
}

JNIEXPORT jstring JNICALL
Java_com_margelo_nitro_ffmpeg_HybridFFmpeg_nativeGetVersion(
    JNIEnv* env,
    jobject thiz
) {
    const char* version = ffmpeg_version();
    return env->NewStringUTF(version ? version : "unknown");
}

JNIEXPORT jobjectArray JNICALL
Java_com_margelo_nitro_ffmpeg_HybridFFmpeg_nativeGetEncoders(
    JNIEnv* env,
    jobject thiz
) {
    std::vector<std::string> encoders;
    void* iter = nullptr;
    const AVCodec* codec;
    while ((codec = av_codec_iterate(&iter)) != nullptr) {
        if (av_codec_is_encoder(codec)) {
            encoders.push_back(codec->name);
        }
    }

    jclass stringClass = env->FindClass("java/lang/String");
    jobjectArray result = env->NewObjectArray(encoders.size(), stringClass, nullptr);
    for (size_t i = 0; i < encoders.size(); i++) {
        env->SetObjectArrayElement(result, i, env->NewStringUTF(encoders[i].c_str()));
    }
    return result;
}

JNIEXPORT jobjectArray JNICALL
Java_com_margelo_nitro_ffmpeg_HybridFFmpeg_nativeGetDecoders(
    JNIEnv* env,
    jobject thiz
) {
    std::vector<std::string> decoders;
    void* iter = nullptr;
    const AVCodec* codec;
    while ((codec = av_codec_iterate(&iter)) != nullptr) {
        if (av_codec_is_decoder(codec)) {
            decoders.push_back(codec->name);
        }
    }

    jclass stringClass = env->FindClass("java/lang/String");
    jobjectArray result = env->NewObjectArray(decoders.size(), stringClass, nullptr);
    for (size_t i = 0; i < decoders.size(); i++) {
        env->SetObjectArrayElement(result, i, env->NewStringUTF(decoders[i].c_str()));
    }
    return result;
}

} // extern "C"
