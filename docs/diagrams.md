# MCP TTS Voicevox の図解

このドキュメントでは、MCP TTS Voicevox の動作シーケンスとクラス構造を図で示します。

## シーケンス図

### `speak` ツールの呼び出し

MCPクライアントが `speak` ツールを呼び出した際の、テキストの音声再生までの大まかな流れを示します。

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as McpServer (index.ts)
    participant VClient as VoicevoxClient (voicevox/index.ts)
    participant VPlayer as VoicevoxPlayer (voicevox/player.ts)
    participant QueueMgr as VoicevoxQueueManager (queue/manager.ts)
    participant AudioGen as AudioGenerator (queue/audio-generator.ts)
    participant VApi as VoicevoxApi (voicevox/api.ts)
    participant Engine as VOICEVOX Engine
    participant AudioPlayer as AudioPlayer (queue/audio-player.ts)
    participant FileManager as AudioFileManager (queue/file-manager.ts)

    Client->>Server: invoke("speak", { text: "...", speaker: 1 })
    Server->>VClient: speak("...", 1)
    
    Note over VClient: テキストをsplitText()で分割
    
    VClient->>VPlayer: generateQuery("segment", 1)
    VPlayer->>VApi: generateQuery("segment", 1)
    VApi->>Engine: POST /audio_query
    Engine-->>VApi: AudioQuery JSON
    VApi-->>VPlayer: AudioQuery
    VPlayer-->>VClient: AudioQuery
    
    VClient->>VPlayer: enqueueWithQuery(query, 1)
    VPlayer->>QueueMgr: enqueueQuery(query, 1)
    QueueMgr-->>VPlayer: キュー追加完了
    VPlayer-->>VClient: 成功応答
    VClient-->>Server: 成功応答
    Server-->>Client: { content: [{ type: "text", text: "音声生成キューに追加しました: ..." }] }

    Note over QueueMgr, AudioPlayer: 以下は非同期で実行されるキュー処理

    QueueMgr->>AudioGen: generateAudioFromQuery(item, updateStatus)
    AudioGen->>VApi: synthesize(Query, 1)
    VApi->>Engine: POST /synthesis
    Engine-->>VApi: WAV Audio Data
    VApi-->>AudioGen: Audio Data
    
    AudioGen->>FileManager: saveTempAudioFile(audioData)
    FileManager-->>AudioGen: tempFilePath
    
    AudioGen-->>QueueMgr: Audio Data & Status Update (READY)
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
    participant VPlayer as VoicevoxPlayer (voicevox/player.ts)
    participant VApi as VoicevoxApi (voicevox/api.ts)
    participant Engine as VOICEVOX Engine

    Client->>Server: invoke("generate_query", { text: "...", speaker: 1 })
    Server->>VClient: generateQuery("...", 1)
    VClient->>VPlayer: generateQuery("...", 1)
    VPlayer->>VApi: generateQuery("...", 1)
    VApi->>Engine: POST /audio_query
    Engine-->>VApi: AudioQuery JSON
    VApi-->>VPlayer: AudioQuery
    VPlayer-->>VClient: AudioQuery
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
    participant VPlayer as VoicevoxPlayer (voicevox/player.ts)
    participant VApi as VoicevoxApi (voicevox/api.ts)
    participant Engine as VOICEVOX Engine
    participant FileManager as AudioFileManager (queue/file-manager.ts)

    Client->>Server: invoke("synthesize_file", { text: "...", output: "...", speaker: 1 })
    Server->>VClient: generateAudioFile("...", "...", 1)
    VClient->>VPlayer: generateQuery("...", 1)
    VPlayer->>VApi: generateQuery("...", 1)
    VApi->>Engine: POST /audio_query
    Engine-->>VApi: AudioQuery JSON
    VApi-->>VPlayer: AudioQuery
    VPlayer-->>VClient: AudioQuery
    
    VClient->>VPlayer: synthesizeToFile(query, output, 1)
    VPlayer->>VApi: synthesize(query, 1)
    VApi->>Engine: POST /synthesis
    Engine-->>VApi: WAV Audio Data
    VApi-->>VPlayer: Audio Data
    
    VPlayer->>FileManager: saveTempAudioFile(audioData)
    FileManager-->>VPlayer: filePath
    
    VPlayer-->>VClient: filePath
    VClient-->>Server: filePath
    Server-->>Client: { content: [{ type: "text", text: "filePath" }] }
```

### `synthesize_file` ツールの呼び出し (クエリ指定)

MCPクライアントが `synthesize_file` ツールをクエリ指定で呼び出した際の、音声ファイル生成の流れを示します。

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as McpServer (index.ts)
    participant VClient as VoicevoxClient (voicevox/index.ts)
    participant VPlayer as VoicevoxPlayer (voicevox/player.ts)
    participant VApi as VoicevoxApi (voicevox/api.ts)
    participant Engine as VOICEVOX Engine
    participant FileManager as AudioFileManager (queue/file-manager.ts)

    Client->>Server: invoke("synthesize_file", { query: "...(JSON)", output: "...", speaker: 1 })
    Server->>VClient: generateAudioFile(query, "...", 1)
    
    VClient->>VPlayer: synthesizeToFile(query, output, 1)
    VPlayer->>VApi: synthesize(query, 1)
    VApi->>Engine: POST /synthesis
    Engine-->>VApi: WAV Audio Data
    VApi-->>VPlayer: Audio Data
    
    VPlayer->>FileManager: saveTempAudioFile(audioData)
    FileManager-->>VPlayer: filePath
    
    VPlayer-->>VClient: filePath
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
        -api: VoicevoxApi
        +constructor(voicevoxUrl, prefetchSize)
        +enqueue(text, speaker) Promise~void~
        +enqueueWithQuery(query, speaker) Promise~void~
        +generateQuery(text, speaker) Promise~AudioQuery~
        +synthesizeToFile(query, output, speaker) Promise~string~
        +clearQueue() void
        +pausePlayback() Promise~void~
        +resumePlayback() Promise~void~
        +getQueueLength() number
        +addEventListener(event, listener) void
        +removeEventListener(event, listener) void
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
        -processQueue() Promise~void~
        -prefetchAudio() Promise~void~
        -updateItemStatus(item, status) void
        -playAudio(filePath) Promise~void~
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
    VoicevoxPlayer --> VoicevoxApi : uses
    VoicevoxPlayer --> VoicevoxQueueManager : uses
    VoicevoxQueueManager --> VoicevoxApi : uses
    VoicevoxQueueManager --> AudioFileManager : uses
    VoicevoxQueueManager --> EventManager : uses
    VoicevoxQueueManager --> AudioGenerator : uses
    VoicevoxQueueManager --> AudioPlayer : uses
    VoicevoxQueueManager --> QueueItem : manages
    AudioGenerator --> VoicevoxApi : uses
    AudioGenerator --> AudioFileManager : uses
```

## データ型

主要なデータ型を示します。

```mermaid
classDiagram
    class AudioQuery {
        accent_phrases: AccentPhrase[]
        speedScale: number
        pitchScale: number
        intonationScale: number
        volumeScale: number
        prePhonemeLength: number
        postPhonemeLength: number
        outputSamplingRate: number
        outputStereo: boolean
        kana?: string
    }

    class AccentPhrase {
        moras: Mora[]
        accent: number
        pause_mora?: Mora
        is_interrogative?: boolean
    }

    class Mora {
        text: string
        consonant?: string
        consonant_length?: number
        vowel: string
        vowel_length: number
        pitch: number
    }

    class VoicevoxConfig {
        url: string
        defaultSpeaker: number
        defaultSpeedScale?: number
    }

    class QueueItemStatus {
        <<enumeration>>
        PENDING
        GENERATING
        READY
        PLAYING
        DONE
        PAUSED
        ERROR
    }

    class QueueEventType {
        <<enumeration>>
        ITEM_ADDED
        ITEM_REMOVED
        ITEM_STATUS_CHANGED
        QUEUE_CLEARED
        PLAYBACK_STARTED
        PLAYBACK_PAUSED
        PLAYBACK_RESUMED
        PLAYBACK_COMPLETED
        ERROR
    }

    AudioQuery --> AccentPhrase : contains
    AccentPhrase --> Mora : contains
```
