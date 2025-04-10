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
    participant QueueMgr as VoicevoxQueueManager (voicevox/queue/manager.ts)
    participant VApi as VoicevoxApi (voicevox/api.ts)
    participant Engine as VOICEVOX Engine
    participant Player as VoicevoxPlayer (voicevox/player.ts)

    Client->>Server: invoke("speak", { text: "...", speaker: 1 })
    Server->>VClient: speak("...", 1)
    VClient->>QueueMgr: addToQueue({ type: 'speak', text: "...", speaker: 1 })
    QueueMgr-->>VClient: キュー追加完了
    VClient-->>Server: 成功応答
    Server-->>Client: 成功応答

    Note over QueueMgr, Player: 以下は非同期で実行されるキュー処理

    QueueMgr->>VApi: createAudioQuery("...", 1)
    VApi->>Engine: POST /audio_query
    Engine-->>VApi: AudioQuery JSON
    VApi-->>QueueMgr: AudioQuery
    QueueMgr->>VApi: synthesis(Query, 1)
    VApi->>Engine: POST /synthesis
    Engine-->>VApi: WAV Audio Data
    VApi-->>QueueMgr: Audio Data
    QueueMgr->>Player: play(Audio Data)
    Player->>System: 音声再生
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
    participant QueueMgr as VoicevoxQueueManager (voicevox/queue/manager.ts)
    participant VApi as VoicevoxApi (voicevox/api.ts)
    participant Engine as VOICEVOX Engine
    participant Player as VoicevoxPlayer (voicevox/player.ts)

    Client->>Server: invoke("synthesize_file", { text: "...", output: "...", speaker: 1 })
    Server->>VClient: synthesizeFile({ text: "...", output: "...", speaker: 1 })
    VClient->>QueueMgr: addToQueue({ type: 'save', text: "...", output: "...", speaker: 1 })
    QueueMgr-->>VClient: キュー追加完了
    VClient-->>Server: 成功応答 (ファイルパスは後で通知される想定だが、現在の実装では即時応答)
    Server-->>Client: 成功応答 (ファイルパスは後で通知される想定だが、現在の実装では即時応答)

    Note over QueueMgr, Player: 以下は非同期で実行されるキュー処理

    QueueMgr->>VApi: createAudioQuery("...", 1)
    VApi->>Engine: POST /audio_query
    Engine-->>VApi: AudioQuery JSON
    VApi-->>QueueMgr: AudioQuery
    QueueMgr->>VApi: synthesis(Query, 1)
    VApi->>Engine: POST /synthesis
    Engine-->>VApi: WAV Audio Data
    VApi-->>QueueMgr: Audio Data
    QueueMgr->>Player: save(Audio Data, "...")
    Player->>FileSystem: ファイル書き込み
    Player-->>QueueMgr: 保存完了 (ファイルパス)
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
        +createAudioQuery(text, speaker) Promise<any>
        +synthesis(query, speaker) Promise<ArrayBuffer>
        +getSpeakers() Promise<any[]>
        #handleError(error)
    }

    class VoicevoxQueueManager {
        -api: VoicevoxApi
        -player: VoicevoxPlayer
        -queue: TaskQueueItem[]
        -isProcessing: boolean
        +constructor(api, player)
        +addToQueue(task) void
        -processQueue() Promise<void>
        -executeTask(task) Promise<void>
    }

    class VoicevoxPlayer {
        +play(audioBuffer) Promise<void>
        +save(audioBuffer, outputPath) Promise<string>
    }

    class TaskQueueItem {
        type: 'speak' | 'save'
        text?: string
        query?: any
        speaker: number
        output?: string
    }

    McpServer --> VoicevoxClient : uses
    VoicevoxClient --> VoicevoxApi : uses
    VoicevoxClient --> VoicevoxQueueManager : uses
    VoicevoxQueueManager --> VoicevoxApi : uses
    VoicevoxQueueManager --> VoicevoxPlayer : uses
    VoicevoxQueueManager --> TaskQueueItem : manages

```