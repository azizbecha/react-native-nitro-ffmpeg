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

    companion object {
        init {
            System.loadLibrary("NitroFFmpeg")
        }
    }

    override fun execute(sessionId: String, args: Array<String>, logLevel: Double) {
        val state = SessionState(sessionId, args)
        sessions[sessionId] = state

        val capturedOnProgress = onProgress
        val capturedOnLog = onLog
        val capturedOnComplete = onComplete

        executor.submit {
            val startTime = System.currentTimeMillis()

            val returnCode = nativeExecute(
                sessionId,
                args,
                logLevel.toInt(),
                { sid, frame, fps, bitrate, totalSize, timeMs, speed ->
                    capturedOnProgress(sid, NativeProgress(
                        frame = frame,
                        fps = fps,
                        bitrate = bitrate,
                        totalSize = totalSize,
                        timeMs = timeMs,
                        speed = speed
                    ))
                },
                { sid, level, message ->
                    capturedOnLog(sid, NativeLogEntry(
                        level = level,
                        message = message
                    ))
                }
            )

            val duration = (System.currentTimeMillis() - startTime).toDouble()
            sessions.remove(sessionId)

            val failureMessage = if (returnCode != 0 && returnCode != 255) {
                "FFmpeg exited with code $returnCode"
            } else if (returnCode == 255) {
                "Session was cancelled"
            } else {
                null
            }

            capturedOnComplete(sessionId, NativeSessionResult(
                sessionId = sessionId,
                returnCode = returnCode.toDouble(),
                duration = duration,
                logs = "",
                command = args,
                failureMessage = failureMessage
            ))
        }
    }

    override fun cancel(sessionId: String) {
        sessions[sessionId]?.cancelled?.set(true)
        nativeCancel(sessionId)
    }

    override fun cancelAll() {
        sessions.values.forEach { it.cancelled.set(true) }
        nativeCancelAll()
    }

    override fun getActiveSessions(): Array<String> {
        return sessions.keys.toTypedArray()
    }

    override fun probe(path: String): Promise<String> {
        return Promise.async {
            nativeProbe(path)
        }
    }

    override fun getFFmpegVersion(): String {
        return nativeGetVersion()
    }

    override fun getSupportedEncoders(): Array<String> {
        return nativeGetEncoders()
    }

    override fun getSupportedDecoders(): Array<String> {
        return nativeGetDecoders()
    }

    // JNI methods
    private external fun nativeExecute(
        sessionId: String,
        args: Array<String>,
        logLevel: Int,
        progressCallback: (String, Double, Double, Double, Double, Double, Double) -> Unit,
        logCallback: (String, Double, String) -> Unit
    ): Int

    private external fun nativeCancel(sessionId: String)
    private external fun nativeCancelAll()
    private external fun nativeProbe(path: String): String
    private external fun nativeGetVersion(): String
    private external fun nativeGetEncoders(): Array<String>
    private external fun nativeGetDecoders(): Array<String>

    private data class SessionState(
        val sessionId: String,
        val args: Array<String>,
        val cancelled: AtomicBoolean = AtomicBoolean(false)
    )
}
