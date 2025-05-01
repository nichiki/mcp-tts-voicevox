# MCP TTS Voicevox の図解

このドキュメントでは、MCP TTS Voicevox の動作シーケンスとクラス構造を図で示します。

## ツール仕様サマリ

| ツール名 | 主パラメータ | 型 | 備考 |
|----------|--------------|----|------|
| `speak` | `text` | string[] | 配列 |
|  | `speaker?` `speedScale?` | number | 省略時はデフォルト |
| `generate_query` | `text` | string | |
| `synthesize_file` | `text?`／`query?` | string / AudioQuery | `query` 優先 |
|  | `output` | string | 未指定なら一時ファイル|
| `clear_queue` | – | – | |

## シーケンス図

### `speak` 呼び出し

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as McpServer
    participant VClient as VoicevoxClient
    participant QueueMgr as VoicevoxQueueManager
    participant AudioGen as AudioGenerator
    participant VApi as VoicevoxApi
    participant Engine as VOICEVOX Engine
    participant AudioPlayer as AudioPlayer
    participant FileMgr as AudioFileManager

    %% ① API 受信
    Client->>Server: invoke("speak", { **text: "…" | ["…", …]**, speaker?, speedScale? })
    Server->>VClient: speak(text, speaker?, speedScale?)

    %% ② VClient でテキスト分割＆最初のセグメント処理
    Note over VClient: 単文なら配列化
    VClient->>QueueMgr: enqueueQuery(firstQuery)
    QueueMgr-->>VClient: 追加完了
    VClient-->>Server: 成功応答
    Server-->>Client: { "音声生成キューに追加しました" }

    %% === 以下は非同期タスク ===
    Note over QueueMgr,AudioPlayer: 非同期キュー処理
    QueueMgr->>AudioGen: generateAudioFromQuery(item)
    AudioGen->>VApi: synthesize(query)
    VApi->>Engine: POST /synthesis
    Engine-->>VApi: WAV
    VApi-->>AudioGen: Audio Data
    AudioGen->>FileMgr: saveTempAudioFile()
    FileMgr-->>AudioGen: tempFilePath
    AudioGen-->>QueueMgr: READY
    QueueMgr->>AudioPlayer: playAudio(tempFile)
    AudioPlayer->>System: 再生
```

### `generate_query` 呼び出し

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as McpServer (index.ts)
    participant VClient as VoicevoxClient (voicevox/index.ts)
    participant VApi as VoicevoxApi (voicevox/api.ts)
    participant Engine as VOICEVOX Engine

    Client->>Server: invoke("generate_query", { text: "...", speaker: 1 })
    Server->>VClient: generateQuery("...", 1)
    VClient->>VApi: generateQuery("...", 1)
    VApi->>Engine: POST /audio_query
    Engine-->>VApi: AudioQuery JSON
    VApi-->>VClient: AudioQuery
    VClient-->>Server: AudioQuery (JSON String)
    Server-->>Client: { content: [{ type: "text", text: "AudioQuery JSON" }] }
```

### `synthesize_file` 呼び出し (テキスト指定)


```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as McpServer
    participant VClient as VoicevoxClient
    participant VApi as VoicevoxApi
    participant Engine as VOICEVOX Engine
    participant FileMgr as AudioFileManager

    Client->>Server: invoke("synthesize_file", { text | query, output?, speaker? })
    Server->>VClient: generateAudioFile(text|query, output?, speaker?)
    alt output 未指定
        VClient->>VApi: synthesize(query)
        VApi->>Engine: POST /synthesis
        Engine-->>VApi: WAV
        VApi-->>VClient: Audio Data
        VClient->>FileMgr: **saveTempAudioFile**(audioData)
    else output 指定
        VClient->>VApi: synthesize(query)
        VApi-->>VClient: Audio Data
        VClient->>FileMgr: **saveAudioFile**(audioData, output)
    end
    FileMgr-->>VClient: filePath
    VClient-->>Server: filePath
    Server-->>Client: { filePath }
```

### `synthesize_file` 呼び出し (クエリ指定)


```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as McpServer (index.ts)
    participant VClient as VoicevoxClient (voicevox/index.ts)
    participant VApi as VoicevoxApi (voicevox/api.ts)
    participant Engine as VOICEVOX Engine
    participant FileManager as AudioFileManager (queue/file-manager.ts)

    Client->>Server: invoke("synthesize_file", { query: "...(JSON)", output: "...", speaker: 1 })
    Server->>VClient: generateAudioFile(query, "...", 1)
    
    VClient->>VApi: synthesize(query, 1)
    VApi->>Engine: POST /synthesis
    Engine-->>VApi: WAV Audio Data
    VApi-->>VClient: Audio Data
    
    VClient->>FileManager: saveTempAudioFile(audioData)
    FileManager-->>VClient: filePath
    
    VClient-->>Server: filePath
    Server-->>Client: { content: [{ type: "text", text: "filePath" }] }
```

## クラス図

主要なクラスとその関連を示します。

```mermaid
classDiagram
    class McpServer {
        +name: string
        +version: string
        +description: string
        +constructor(options)
        +tool(name, description, schema, handler)
        +connect(transport)
    }

    class VoicevoxClient {
        -player: VoicevoxPlayer
        -api: VoicevoxApi
        -defaultSpeaker: number
        -defaultSpeedScale: number
        -maxSegmentLength: number
        +constructor(config)
        +speak(text, speaker, speedScale) Promise~string~
        +generateQuery(text, speaker, speedScale) Promise~AudioQuery~
        +generateAudioFile(textOrQuery, outputPath, speaker, speedScale) Promise~string~
        +enqueueAudioGeneration(textOrQuery, speaker, speedScale) Promise~string~
        -getSpeakerId(speaker?) number
        -getSpeedScale(speedScale?) number
        -validateConfig(config) void
    }

    class VoicevoxApi {
        -baseUrl: string
        +constructor(baseUrl)
        +generateQuery(text, speaker) Promise~AudioQuery~
        +synthesize(query, speaker) Promise~ArrayBuffer~
        -makeRequest~T~(method, endpoint, data, headers, responseType) Promise~T~
        -normalizeUrl(url) string
    }

    class VoicevoxPlayer {
        -queueManager: VoicevoxQueueManager
        +constructor(voicevoxUrl, prefetchSize)
        +enqueue(text, speaker) Promise~void~
        +enqueueWithQuery(query, speaker) Promise~void~
        +generateQuery(text, speaker) Promise~AudioQuery~
        +synthesizeToFile(query, output, speaker) Promise~string~
        +startPlayback() void
        +pausePlayback() void
        +resumePlayback() void
        +getQueueLength() number
        +isQueueEmpty() boolean
        +isPlaying() boolean
        +getQueueManager() VoicevoxQueueManager
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
        +enqueueText(text, speaker) Promise~QueueItem~
        +enqueueQuery(query, speaker) Promise~QueueItem~
        +removeItem(itemId) Promise~boolean~
        +clearQueue() Promise~void~
        +startPlayback() Promise~void~
        +pausePlayback() Promise~void~
        +resumePlayback() Promise~void~
        +playNext() Promise~void~
        +addEventListener(event, listener) void
        +removeEventListener(event, listener) void
        +getQueue() QueueItem[]
        +getItemStatus(itemId) QueueItemStatus|null
        +saveTempAudioFile(audioData) Promise~string~
        +getAudioGenerator() AudioGenerator
        +getFileManager() AudioFileManager
        +getApi() VoicevoxApi
        -processQueue() Promise~void~
        -prefetchAudio() Promise~void~
        -updateItemStatus(item, status) void
    }

    class AudioGenerator {
        -api: VoicevoxApi
        -fileManager: AudioFileManager
        +constructor(api, fileManager)
        +generateQuery(text, speaker) Promise~AudioQuery~
        +generateAudio(item, updateStatus) Promise~void~
        +generateAudioFromQuery(item, updateStatus) Promise~void~
    }

    class AudioFileManager {
        +createTempFilePath() string
        +deleteTempFile(filePath) Promise~void~
        +saveTempAudioFile(audioData) Promise~string~
        +saveAudioFile(audioData, output) Promise~string~
    }

    class AudioPlayer {
        +playAudio(filePath) Promise~void~
        +logError(message, error) void
    }

    class EventManager {
        -eventListeners: Map~QueueEventType, QueueEventListener[]~
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
    VoicevoxClient --> VoicevoxPlayer : uses
    VoicevoxClient --> VoicevoxApi : uses directly
    VoicevoxPlayer --> VoicevoxQueueManager : manages
    VoicevoxQueueManager --> VoicevoxApi : uses
    VoicevoxQueueManager --> AudioFileManager : uses
    VoicevoxQueueManager --> EventManager : uses
    VoicevoxQueueManager --> AudioGenerator : uses
    VoicevoxQueueManager --> AudioPlayer : uses
    VoicevoxQueueManager --> QueueItem : manages
    AudioGenerator --> VoicevoxApi : uses
    AudioGenerator --> AudioFileManager : uses
```
