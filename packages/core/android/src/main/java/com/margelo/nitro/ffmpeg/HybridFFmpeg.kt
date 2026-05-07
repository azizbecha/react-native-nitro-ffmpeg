package com.margelo.nitro.ffmpeg

import com.margelo.nitro.core.Promise
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class HybridFFmpeg : HybridFFmpegSpec() {
    private val executor = Executors.newFixedThreadPool(4)
    private val sessions = ConcurrentHashMap<String, SessionState>()

    override var onProgress: (sessionId: String, progress: NativeProgress) -> Unit = { _, _ -> }
    override var onLog: (sessionId: String, log: NativeLogEntry) -> Unit = { _, _ -> }
    override var onComplete: (sessionId: String, result: NativeSessionResult) -> Unit = { _, _ -> }

    override fun execute(sessionId: String, args: Array<String>, logLevel: Double) {
        val state = SessionState(sessionId, args)
        sessions[sessionId] = state

        val capturedOnComplete = onComplete

        executor.submit {
            val startTime = System.currentTimeMillis()

            // TODO: Call FFmpeg via JNI here with the provided args
            // This is where you would call into the native FFmpeg library
            val duration = (System.currentTimeMillis() - startTime).toDouble()

            sessions.remove(sessionId)

            val result = NativeSessionResult(
                sessionId = sessionId,
                returnCode = 0.0,
                duration = duration,
                logs = "",
                command = args,
                failureMessage = null
            )
            capturedOnComplete(sessionId, result)
        }
    }

    override fun cancel(sessionId: String) {
        sessions[sessionId]?.cancelled?.set(true)
    }

    override fun cancelAll() {
        sessions.values.forEach { it.cancelled.set(true) }
    }

    override fun getActiveSessions(): Array<String> {
        return sessions.keys.toTypedArray()
    }

    override fun probe(path: String): Promise<String> {
        return Promise.async {
            // TODO: Call FFprobe via JNI here
            "{}"
        }
    }

    override fun getFFmpegVersion(): String {
        // TODO: Return actual FFmpeg version from native library
        return "7.0"
    }

    override fun getSupportedEncoders(): Array<String> {
        // TODO: Query FFmpeg for supported encoders
        return emptyArray()
    }

    override fun getSupportedDecoders(): Array<String> {
        // TODO: Query FFmpeg for supported decoders
        return emptyArray()
    }

    private data class SessionState(
        val sessionId: String,
        val args: Array<String>,
        val cancelled: AtomicBoolean = AtomicBoolean(false)
    )
}
