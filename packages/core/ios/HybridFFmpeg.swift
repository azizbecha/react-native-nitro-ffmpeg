import Foundation
import NitroModules

class HybridFFmpeg: HybridFFmpegSpec {
    private let sessionQueue = OperationQueue()
    private var sessions: [String: FFmpegSessionState] = [:]
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
        let state = FFmpegSessionState(sessionId: sessionId, args: args)
        lock.lock()
        sessions[sessionId] = state
        lock.unlock()

        let capturedOnComplete = onComplete

        sessionQueue.addOperation { [weak self] in
            guard let self = self else { return }
            let startTime = CFAbsoluteTimeGetCurrent()

            // TODO: Call FFmpeg C API here with the provided args
            // This is where you would link against libavcodec, libavformat, etc.
            // and execute the FFmpeg command using avformat_open_input, etc.
            let duration = (CFAbsoluteTimeGetCurrent() - startTime) * 1000

            self.lock.lock()
            self.sessions.removeValue(forKey: sessionId)
            self.lock.unlock()

            let result = NativeSessionResult(
                sessionId: sessionId,
                returnCode: 0,
                duration: duration,
                logs: "",
                command: args,
                failureMessage: nil
            )
            capturedOnComplete(sessionId, result)
        }
    }

    func cancel(sessionId: String) throws {
        lock.lock()
        sessions[sessionId]?.cancelled = true
        lock.unlock()
    }

    func cancelAll() throws {
        lock.lock()
        for key in sessions.keys {
            sessions[key]?.cancelled = true
        }
        lock.unlock()
        sessionQueue.cancelAllOperations()
    }

    func getActiveSessions() throws -> [String] {
        lock.lock()
        let ids = Array(sessions.keys)
        lock.unlock()
        return ids
    }

    func probe(path: String) throws -> Promise<String> {
        return Promise.async {
            // TODO: Call FFprobe C API here
            // Parse the media file at `path` and return JSON string
            return "{}"
        }
    }

    func getFFmpegVersion() throws -> String {
        // TODO: Return actual FFmpeg version from av_version_info()
        return "7.0"
    }

    func getSupportedEncoders() throws -> [String] {
        // TODO: Query FFmpeg for supported encoders via avcodec_iterate()
        return []
    }

    func getSupportedDecoders() throws -> [String] {
        // TODO: Query FFmpeg for supported decoders via avcodec_iterate()
        return []
    }
}

private class FFmpegSessionState {
    let sessionId: String
    let args: [String]
    var cancelled = false

    init(sessionId: String, args: [String]) {
        self.sessionId = sessionId
        self.args = args
    }
}
