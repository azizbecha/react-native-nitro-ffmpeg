import Foundation
import NitroModules

class HybridFFmpeg: HybridFFmpegSpec {
    var hybridContext = margelo.nitro.HybridContext()
    var memorySize: Int { return getSizeOf(self) }

    private let sessionQueue = OperationQueue()
    private var sessions: [String: FFmpegSessionState] = [:]
    private let lock = NSLock()

    var onProgress: ((String, NativeProgress) -> Void)?
    var onLog: ((String, NativeLogEntry) -> Void)?
    var onComplete: ((String, NativeSessionResult) -> Void)?

    init() {
        sessionQueue.maxConcurrentOperationCount = 4
        sessionQueue.qualityOfService = .userInitiated
    }

    func execute(sessionId: String, args: [String], logLevel: Double) {
        let state = FFmpegSessionState(sessionId: sessionId, args: args)
        lock.lock()
        sessions[sessionId] = state
        lock.unlock()

        sessionQueue.addOperation { [weak self] in
            guard let self = self else { return }
            let startTime = CFAbsoluteTimeGetCurrent()

            // TODO: Call FFmpeg C API here with the provided args
            // For now, simulate completion
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
            self.onComplete?(sessionId, result)
        }
    }

    func cancel(sessionId: String) {
        lock.lock()
        sessions[sessionId]?.cancelled = true
        lock.unlock()
    }

    func cancelAll() {
        lock.lock()
        for key in sessions.keys {
            sessions[key]?.cancelled = true
        }
        lock.unlock()
        sessionQueue.cancelAllOperations()
    }

    func getActiveSessions() -> [String] {
        lock.lock()
        let ids = Array(sessions.keys)
        lock.unlock()
        return ids
    }

    func probe(path: String) -> Promise<String> {
        return Promise { resolve, reject in
            DispatchQueue.global(qos: .userInitiated).async {
                // TODO: Call FFprobe C API here
                // For now, return empty JSON
                resolve("{}")
            }
        }
    }

    func getFFmpegVersion() -> String {
        // TODO: Return actual FFmpeg version from native library
        return "7.0"
    }

    func getSupportedEncoders() -> [String] {
        // TODO: Query FFmpeg for supported encoders
        return []
    }

    func getSupportedDecoders() -> [String] {
        // TODO: Query FFmpeg for supported decoders
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
