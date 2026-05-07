package com.nitro.ffmpeg

import com.margelo.nitro.NitroModules
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class HybridFFmpeg : HybridFFmpegSpec() {
    private val executor = Executors.newFixedThreadPool(4)
    private val sessions = ConcurrentHashMap<String, SessionState>()

    override var onProgress: ((String, NativeProgress) -> Unit)? = null
    override var onLog: ((String, NativeLogEntry) -> Unit)? = null
    override var onComplete: ((String, NativeSessionResult) -> Unit)? = null

    override val memorySize: Long
        get() = 0L

    override fun execute(sessionId: String, args: Array<String>, logLevel: Double) {
        val state = SessionState(sessionId, args)
        sessions[sessionId] = state

        executor.submit {
            val startTime = System.currentTimeMillis()

            // TODO: Call FFmpeg via JNI here with the provided args
            // For now, simulate completion
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
            onComplete?.invoke(sessionId, result)
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

    override suspend fun probe(path: String): String {
        // TODO: Call FFprobe via JNI here
        return "{}"
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
