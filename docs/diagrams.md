# 図解

このドキュメントでは、MCP TTS Voicevox の動作シーケンスとクラス構造を図で示します。

## シーケンス図

### `speak` ツールの呼び出し

MCPクライアントが `speak` ツールを呼び出した際の、テキストの音声再生までの大まかな流れを示します。

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as McpServer (index.ts)
    participant VClient as VoicevoxClient (voicevox/index.ts)
    participant QueueMgr as VoicevoxQueueManager (queue/manager.ts)
    participant AudioGen as AudioGenerator (queue/audio-generator.ts)
    participant VApi as VoicevoxApi (voicevox/api.ts)
    participant Engine as VOICEVOX Engine
    participant AudioPlayer as AudioPlayer (queue/audio-player.ts)

    Client->>Server: invoke("speak", { text: "...", speaker: 1 })
    Server->>VClient: speak("...", 1)
    VClient->>QueueMgr: enqueueText("...", 1)
    QueueMgr->>AudioGen: generateQuery("...", 1)
    AudioGen->>VApi: generateQuery("...", 1)
    VApi->>Engine: POST /audio_query
    Engine-->>VApi: AudioQuery JSON
    VApi-->>AudioGen: AudioQuery
    AudioGen-->>QueueMgr: AudioQuery
    QueueMgr-->>VClient: キュー追加完了
    VClient-->>Server: 成功応答
    Server-->>Client: 成功応答

    Note over QueueMgr, AudioPlayer: 以下は非同期で実行されるキュー処理

    QueueMgr->>AudioGen: generateAudioFromQuery(item, updateStatus)
    AudioGen->>VApi: synthesize(Query, 1)
    VApi->>Engine: POST /synthesis
    Engine-->>VApi: WAV Audio Data
    VApi-->>AudioGen: Audio Data
    AudioGen->>QueueMgr: Audio Data & Status Update (READY)
    QueueMgr->>AudioPlayer: playAudio(tempFile)
    AudioPlayer->>System: 音声再生
```

### `generate_query` ツールの呼び出し

MCPクライアントが `generate_query` ツールを呼び出した際の、AudioQuery生成の流れを示します。

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as McpServer (index.ts)
    participant VClient as VoicevoxClient (voicevox/index.ts)
    participant VApi as VoicevoxApi (voicevox/api.ts)
    participant Engine as VOICEVOX Engine

    Client->>Server: invoke("generate_query", { text: "...", speaker: 1 })
    Server->>VClient: generateQuery("...", 1)
    VClient->>VApi: createAudioQuery("...", 1)
    VApi->>Engine: POST /audio_query
    Engine-->>VApi: AudioQuery JSON
    VApi-->>VClient: AudioQuery
    VClient-->>Server: AudioQuery (JSON String)
    Server-->>Client: { content: [{ type: "text", text: "AudioQuery JSON" }] }
```

### `synthesize_file` ツールの呼び出し (テキスト指定)

MCPクライアントが `synthesize_file` ツールをテキスト指定で呼び出した際の、音声ファイル生成の流れを示します。

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as McpServer (index.ts)
    participant VClient as VoicevoxClient (voicevox/index.ts)
    participant QueueMgr as VoicevoxQueueManager (queue/manager.ts)
    participant AudioGen as AudioGenerator (queue/audio-generator.ts)
    participant FileMgr as AudioFileManager (queue/file-manager.ts)
    participant VApi as VoicevoxApi (voicevox/api.ts)
    participant Engine as VOICEVOX Engine

    Client->>Server: invoke("synthesize_file", { text: "...", output: "...", speaker: 1 })
    Server->>VClient: synthesizeFile({ text: "...", output: "...", speaker: 1 })
    VClient->>QueueMgr: enqueueText("...", 1)
    QueueMgr->>AudioGen: generateQuery("...", 1)
    AudioGen->>VApi: generateQuery("...", 1)
    VApi->>Engine: POST /audio_query
    Engine-->>VApi: AudioQuery JSON
    VApi-->>AudioGen: AudioQuery
    AudioGen-->>QueueMgr: AudioQuery
    QueueMgr-->>VClient: キュー追加完了
    VClient-->>Server: 成功応答 (ファイルパスは後で通知される想定だが、現在の実装では即時応答)
    Server-->>Client: 成功応答 (ファイルパスは後で通知される想定だが、現在の実装では即時応答)

    Note over QueueMgr, FileMgr: 以下は非同期で実行されるキュー処理

    QueueMgr->>AudioGen: generateAudioFromQuery(item, updateStatus)
    AudioGen->>VApi: synthesize(Query, 1)
    VApi->>Engine: POST /synthesis
    Engine-->>VApi: WAV Audio Data
    VApi-->>AudioGen: Audio Data
    AudioGen->>FileMgr: saveTempAudioFile(audioData)
    FileMgr->>FileSystem: ファイル書き込み
    FileMgr-->>AudioGen: tempFilePath
    AudioGen-->>QueueMgr: tempFilePath & Status Update (READY)
    Note over QueueMgr: 指定された出力パスにファイルをコピー
    Note over QueueMgr: 現在の実装では、ファイルパスの非同期通知は行われない
```

## クラス図

主要なクラスとその関連を示します。

```mermaid
classDiagram
    class McpServer {
        +constructor()
        +start()
        +registerTool(name, tool)
        #handleRequest(request)
        #sendResponse(response)
    }

    class VoicevoxClient {
        -api: VoicevoxApi
        -queueManager: VoicevoxQueueManager
        -defaultSpeaker: number
        +constructor(options)
        +speak(text, speaker) Promise<void>
        +generateQuery(text, speaker) Promise<string>
        +synthesizeFile(options) Promise<string>
        +getSpeakers() Promise<any[]>
    }

    class VoicevoxApi {
        -baseUrl: string
        -axiosInstance: AxiosInstance
        +constructor(baseUrl)
        +generateQuery(text, speaker) Promise<AudioQuery>
        +synthesize(query, speaker) Promise<ArrayBuffer>
        +getSpeakers() Promise<any[]>
        #handleError(error)
    }

    class VoicevoxQueueManager {
        -queue: QueueItem[]
        -isPlaying: boolean
        -isPaused: boolean
        -prefetchSize: number
        -currentPlayingItem: QueueItem|null
        -api: VoicevoxApi
        -fileManager: AudioFileManager
        -eventManager: EventManager
        -audioGenerator: AudioGenerator
        -audioPlayer: AudioPlayer
        +constructor(api, prefetchSize)
        +enqueueText(text, speaker) Promise<QueueItem>
        +enqueueQuery(query, speaker) Promise<QueueItem>
        +removeItem(itemId) Promise<boolean>
        +clearQueue() Promise<void>
        +startPlayback() Promise<void>
        +pausePlayback() Promise<void>
        +resumePlayback() Promise<void>
        +playNext() Promise<void>
        +addEventListener(event, listener) void
        +removeEventListener(event, listener) void
        +getQueue() QueueItem[]
        +getItemStatus(itemId) QueueItemStatus|null
        +saveTempAudioFile(audioData) Promise<string>
        -processQueue() Promise<void>
        -prefetchAudio() Promise<void>
        -updateItemStatus(item, status) void
        -playAudio(filePath) Promise<void>
    }

    class AudioGenerator {
        -api: VoicevoxApi
        -fileManager: AudioFileManager
        +constructor(api, fileManager)
        +generateQuery(text, speaker) Promise<AudioQuery>
        +generateAudio(item, updateStatus) Promise<void>
        +generateAudioFromQuery(item, updateStatus) Promise<void>
    }

    class AudioFileManager {
        +createTempFilePath() string
        +deleteTempFile(filePath) Promise<void>
        +saveTempAudioFile(audioData) Promise<string>
    }

    class AudioPlayer {
        +playAudio(filePath) Promise<void>
        +logError(message, error) void
    }

    class EventManager {
        -eventListeners: Map<QueueEventType, QueueEventListener[]>
        +constructor()
        +addEventListener(event, listener) void
        +removeEventListener(event, listener) void
        +emitEvent(event, item?) void
    }

    class QueueItem {
        id: string
        text: string
        speaker: number
        status: QueueItemStatus
        createdAt: Date
        audioData?: ArrayBuffer
        tempFile?: string
        query?: AudioQuery
        error?: Error
    }

    McpServer --> VoicevoxClient : uses
    VoicevoxClient --> VoicevoxApi : uses
    VoicevoxClient --> VoicevoxQueueManager : uses
    VoicevoxQueueManager --> VoicevoxApi : uses
    VoicevoxQueueManager --> AudioFileManager : uses
    VoicevoxQueueManager --> EventManager : uses
    VoicevoxQueueManager --> AudioGenerator : uses
    VoicevoxQueueManager --> AudioPlayer : uses
    VoicevoxQueueManager --> QueueItem : manages
    AudioGenerator --> VoicevoxApi : uses
    AudioGenerator --> AudioFileManager : uses