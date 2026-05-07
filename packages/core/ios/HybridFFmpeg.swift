import Foundation
import NitroModules

class HybridFFmpeg: HybridFFmpegSpec {
    private let sessionQueue = OperationQueue()
    private let lock = NSLock()

    var onProgress: (_ sessionId: String, _ progress: NativeProgress) -> Void = { _, _ in }
    var onLog: (_ sessionId: String, _ log: NativeLogEntry) -> Void = { _, _ in }
    var onComplete: (_ sessionId: String, _ result: NativeSessionResult) -> Void = { _, _ in }

    override init() {
        super.init()
        sessionQueue.maxConcurrentOperationCount = 4
        sessionQueue.qualityOfService = .userInitiated
    }

    func execute(sessionId: String, args: [String], logLevel: Double) throws {
        let capturedOnProgress = onProgress
        let capturedOnLog = onLog
        let capturedOnComplete = onComplete

        sessionQueue.addOperation {
            let argc = Int32(args.count)
            let cArgs = args.map { strdup($0) }
            defer { cArgs.forEach { free($0) } }

            var argv = cArgs.map { UnsafePointer($0) }

            let context = CallbackContext(
                sessionId: sessionId,
                onProgress: capturedOnProgress,
                onLog: capturedOnLog
            )
            let contextPtr = Unmanaged.passRetained(context).toOpaque()

            var config = FFmpegConfig()
            config.session_id = sessionId.withCString { strdup($0) }
            config.on_progress = { sessionIdPtr, progress, userData in
                guard let userData = userData,
                      let sessionIdPtr = sessionIdPtr else { return }
                let ctx = Unmanaged<CallbackContext>.fromOpaque(userData).takeUnretainedValue()
                let sessionId = String(cString: sessionIdPtr)
                let nativeProgress = NativeProgress(
                    frame: Double(progress.frame),
                    fps: progress.fps,
                    bitrate: progress.bitrate,
                    totalSize: Double(progress.total_size),
                    timeMs: Double(progress.time_ms),
                    speed: progress.speed
                )
                ctx.onProgress(sessionId, nativeProgress)
            }
            config.on_log = { sessionIdPtr, logEntry, userData in
                guard let userData = userData,
                      let sessionIdPtr = sessionIdPtr else { return }
                let ctx = Unmanaged<CallbackContext>.fromOpaque(userData).takeUnretainedValue()
                let sessionId = String(cString: sessionIdPtr)
                let message = logEntry.message != nil ? String(cString: logEntry.message) : ""
                let nativeLog = NativeLogEntry(
                    level: Double(logEntry.level),
                    message: message
                )
                ctx.onLog(sessionId, nativeLog)
            }
            config.user_data = contextPtr
            config.log_level = Int32(logLevel)

            let result = ffmpeg_execute(argc, &argv, config)

            free(UnsafeMutablePointer(mutating: config.session_id))
            Unmanaged<CallbackContext>.fromOpaque(contextPtr).release()

            let logs = result.logs != nil ? String(cString: result.logs) : ""
            let failureMessage = result.failure_message != nil ? String(cString: result.failure_message) : nil

            var mutableResult = result
            ffmpeg_result_free(&mutableResult)

            let nativeResult = NativeSessionResult(
                sessionId: sessionId,
                returnCode: Double(result.return_code),
                duration: result.duration_ms,
                logs: logs,
                command: args,
                failureMessage: failureMessage
            )
            capturedOnComplete(sessionId, nativeResult)
        }
    }

    func cancel(sessionId: String) throws {
        sessionId.withCString { ptr in
            ffmpeg_cancel(ptr)
        }
    }

    func cancelAll() throws {
        ffmpeg_cancel_all()
    }

    func getActiveSessions() throws -> [String] {
        // Active sessions are tracked on the JS side;
        // native side manages cancellation state only
        return []
    }

    func probe(path: String) throws -> Promise<String> {
        return Promise.async {
            let result = path.withCString { ptr -> String in
                guard let jsonPtr = ffprobe_execute(ptr) else {
                    return "{\"error\": \"FFprobe returned null\"}"
                }
                let json = String(cString: jsonPtr)
                ffmpeg_string_free(jsonPtr)
                return json
            }
            return result
        }
    }

    func getFFmpegVersion() throws -> String {
        guard let versionPtr = ffmpeg_version() else {
            return "unknown"
        }
        return String(cString: versionPtr)
    }

    func getSupportedEncoders() throws -> [String] {
        var encoders: [String] = []
        var iter: UnsafeMutableRawPointer? = nil
        while let codec = av_codec_iterate(&iter) {
            if av_codec_is_encoder(codec) != 0 {
                if let name = codec.pointee.name {
                    encoders.append(String(cString: name))
                }
            }
        }
        return encoders
    }

    func getSupportedDecoders() throws -> [String] {
        var decoders: [String] = []
        var iter: UnsafeMutableRawPointer? = nil
        while let codec = av_codec_iterate(&iter) {
            if av_codec_is_decoder(codec) != 0 {
                if let name = codec.pointee.name {
                    decoders.append(String(cString: name))
                }
            }
        }
        return decoders
    }
}

private class CallbackContext {
    let sessionId: String
    let onProgress: (_ sessionId: String, _ progress: NativeProgress) -> Void
    let onLog: (_ sessionId: String, _ log: NativeLogEntry) -> Void

    init(
        sessionId: String,
        onProgress: @escaping (_ sessionId: String, _ progress: NativeProgress) -> Void,
        onLog: @escaping (_ sessionId: String, _ log: NativeLogEntry) -> Void
    ) {
        self.sessionId = sessionId
        self.onProgress = onProgress
        self.onLog = onLog
    }
}
