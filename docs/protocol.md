---
title: Protocol Specification
order: 1.8
description: Complete wire protocol specification for implementing datasole clients in any language.
---

# Protocol Specification

This document fully specifies the datasole wire protocol. It is intended to be machine-readable by LLMs and sufficient to implement a complete, interoperable datasole client in any language (Rust, Go, C++, C, Python, R, Java, etc.).

**Protocol version:** `1`

## 1. Transport Layer

### 1.1 WebSocket Connection

| Property       | Value                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Transport      | WebSocket (RFC 6455)                                                                           |
| Frame type     | **Binary** (`opcode 0x02`) — all frames are binary, never text                                 |
| Subprotocol    | None (do not set `Sec-WebSocket-Protocol`)                                                     |
| Extensions     | **Do not use `permessage-deflate`** — compression is handled at the application layer (see §4) |
| Max frame size | 1,048,576 bytes (1 MiB)                                                                        |

### 1.2 Endpoint URL

The server listens for WebSocket upgrade requests at a configurable path. The default is:

```
ws[s]://<host>[:<port>]/__ds[?token=<auth_token>]
```

| Component      | Default             | Notes                         |
| -------------- | ------------------- | ----------------------------- |
| Scheme         | `ws://` or `wss://` | Use `wss://` in production    |
| Path           | `/__ds`             | Configurable by the server    |
| Query: `token` | (optional)          | Authentication token — see §2 |

The client constructs the URL by:

1. Taking the base URL (e.g. `https://example.com`)
2. Replacing `http` with `ws` (i.e. `https://` → `wss://`, `http://` → `ws://`)
3. Appending the path (`/__ds`)
4. Appending `?token=<value>` if an auth token is provided

### 1.3 HTTP Upgrade

The WebSocket handshake is a standard RFC 6455 upgrade. Key constraints:

- The browser WebSocket API does **not** allow custom headers during the upgrade handshake
- Authentication tokens are therefore sent as a **query parameter** (`?token=…`), not as an `Authorization` header
- Non-browser clients (Go, Rust, Python, etc.) may additionally send an `Authorization: Bearer <token>` header during the upgrade, but the server extracts the token from the query parameter

**Server-side upgrade behavior:**

- If the path does not match, the server destroys the socket (no response)
- If authentication fails, the server responds `HTTP/1.1 401 Unauthorized` and destroys the socket
- If an internal error occurs, the server responds `HTTP/1.1 500 Internal Server Error`

## 2. Authentication

### 2.1 Token Delivery

```
GET /__ds?token=eyJhbGciOiJIUzI1NiJ9... HTTP/1.1
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Version: 13
Sec-WebSocket-Key: ...
```

The server extracts the token from `url.searchParams.get('token')`.

### 2.2 Auth Result

The server's auth handler returns a result object. On success, the connection proceeds. On failure, the socket is closed with `401`.

```json
{
  "authenticated": true,
  "userId": "user-42",
  "roles": ["admin", "user"],
  "metadata": { "displayName": "Alice" }
}
```

Auth context is available to all RPC handlers and events for the lifetime of the connection.

### 2.3 Anonymous Connections

If no auth handler is configured on the server, all connections are accepted with `{ "authenticated": true }`.

## 3. Frame Format

Every message sent over the WebSocket is a **binary frame** with the following structure:

### 3.1 Frame Header (9 bytes, big-endian)

```
Offset  Size  Type     Field
──────  ────  ───────  ──────────────
0       1     uint8    opcode
1       4     uint32   correlationId
5       4     uint32   payloadLength
9       N     bytes    payload (JSON, UTF-8)
```

| Field           | Type                  | Byte order                 | Description                               |
| --------------- | --------------------- | -------------------------- | ----------------------------------------- |
| `opcode`        | `uint8`               | —                          | Message type identifier (see §3.2)        |
| `correlationId` | `uint32`              | Big-endian (network order) | RPC correlation; `0` for non-RPC messages |
| `payloadLength` | `uint32`              | Big-endian (network order) | Length of the payload in bytes            |
| `payload`       | `byte[payloadLength]` | —                          | JSON-encoded UTF-8 bytes                  |

Total frame size = `9 + payloadLength` bytes.

### 3.2 Opcodes

| Value  | Name             | Direction       | Description                              |
| ------ | ---------------- | --------------- | ---------------------------------------- |
| `0x01` | `RPC_REQ`        | Client → Server | RPC request                              |
| `0x02` | `RPC_RES`        | Server → Client | RPC response                             |
| `0x03` | `EVENT_C2S`      | Client → Server | Client-to-server event (fire-and-forget) |
| `0x04` | `EVENT_S2C`      | Server → Client | Server-to-client event (broadcast)       |
| `0x05` | `STATE_PATCH`    | Server → Client | JSON Patch state update (RFC 6902)       |
| `0x06` | `STATE_SNAPSHOT` | Server → Client | Full state snapshot                      |
| `0x07` | `PING`           | Client → Server | Keepalive ping                           |
| `0x08` | `PONG`           | Server → Client | Keepalive pong                           |
| `0x09` | `ERROR`          | Server → Client | Error notification                       |
| `0x0A` | `CRDT_OP`        | Client → Server | CRDT operation                           |
| `0x0B` | `CRDT_STATE`     | Server → Client | CRDT state broadcast                     |

### 3.3 Payload Encoding

The `payload` field is always a UTF-8 encoded JSON string, serialized with `JSON.stringify()` and encoded with `TextEncoder.encode()`. To decode: `JSON.parse(TextDecoder.decode(payload))`.

Implementations in other languages: serialize to JSON, then encode the JSON string as UTF-8 bytes.

## 4. Compression

datasole uses **user-space compression** on the entire frame (header + payload), not WebSocket protocol extensions.

### 4.1 Algorithm

| Property  | Value                                                             |
| --------- | ----------------------------------------------------------------- |
| Algorithm | **DEFLATE** (RFC 1951) via zlib/pako                              |
| Wrapper   | **zlib wrapper** (RFC 1950) — `pako.deflate()` / `pako.inflate()` |
| Threshold | 256 bytes — frames ≤ 256 bytes are sent uncompressed              |

### 4.2 Compression Decision

**Sender side** (applies to both client and server):

```
encoded_frame = encode_frame(opcode, correlationId, payload)
if len(encoded_frame) > 256:
    wire_bytes = zlib_compress(encoded_frame)
else:
    wire_bytes = encoded_frame
websocket.send_binary(wire_bytes)
```

**Receiver side:**

```
wire_bytes = websocket.receive_binary()
if len(wire_bytes) > 256:
    frame_bytes = zlib_decompress(wire_bytes)
else:
    frame_bytes = wire_bytes
frame = decode_frame(frame_bytes)
```

### 4.3 Implementation Notes

- The compression is applied to the **entire frame** (9-byte header + payload), not just the payload
- The threshold check (`> 256`) is on the **encoded frame size**, not the payload size
- Use standard zlib deflate/inflate (with zlib header, not raw deflate and not gzip)
- In Python: `zlib.compress()` / `zlib.decompress()`
- In Go: `compress/flate` with a zlib wrapper, or `compress/zlib`
- In Rust: `flate2` crate with `ZlibEncoder` / `ZlibDecoder`
- In C/C++: `zlib` library, `compress()` / `uncompress()` or `deflate()` / `inflate()` with `Z_DEFAULT_COMPRESSION`
- **Do not negotiate `permessage-deflate`** in the WebSocket handshake — this causes known memory leaks and data corruption in many implementations

## 5. Message Payloads

Each opcode has a specific JSON payload schema.

### 5.1 RPC Request (`0x01` — Client → Server)

```json
{
  "method": "getUser",
  "params": { "userId": "123" },
  "correlationId": 1
}
```

| Field           | Type   | Required | Description                                     |
| --------------- | ------ | -------- | ----------------------------------------------- |
| `method`        | string | yes      | RPC method name                                 |
| `params`        | any    | yes      | Method parameters (any JSON-serializable value) |
| `correlationId` | number | yes      | Must match the frame header's `correlationId`   |

### 5.2 RPC Response (`0x02` — Server → Client)

**Success:**

```json
{
  "correlationId": 1,
  "result": { "name": "Alice", "email": "alice@example.com" }
}
```

**Error:**

```json
{
  "correlationId": 1,
  "error": {
    "code": -1,
    "message": "User not found",
    "data": null
  }
}
```

| Field           | Type   | Required   | Description                                          |
| --------------- | ------ | ---------- | ---------------------------------------------------- |
| `correlationId` | number | yes        | Matches the request's `correlationId`                |
| `result`        | any    | if success | Return value from the handler                        |
| `error`         | object | if error   | Error object with `code`, `message`, optional `data` |

RPC is multiplexed: multiple requests can be in-flight simultaneously. The client matches responses to requests using `correlationId`. Clients should implement a timeout (default: 30 seconds).

### 5.3 Client Event (`0x03` — Client → Server)

```json
{
  "event": "analytics",
  "data": { "action": "click", "target": "buy-button" }
}
```

| Field   | Type   | Required | Description   |
| ------- | ------ | -------- | ------------- |
| `event` | string | yes      | Event name    |
| `data`  | any    | yes      | Event payload |

Fire-and-forget. No response from the server. The `correlationId` in the frame header should be `0`.

### 5.4 Server Event (`0x04` — Server → Client)

```json
{
  "event": "notification",
  "data": { "title": "Server restarting" },
  "timestamp": 1711234567890
}
```

| Field       | Type   | Required | Description                    |
| ----------- | ------ | -------- | ------------------------------ |
| `event`     | string | yes      | Event name                     |
| `data`      | any    | yes      | Event payload                  |
| `timestamp` | number | yes      | Unix timestamp in milliseconds |

The `correlationId` in the frame header is `0`.

### 5.5 State Patch (`0x05` — Server → Client)

```json
{
  "key": "dashboard",
  "patches": [
    { "op": "replace", "path": "/visitors", "value": 42 },
    { "op": "add", "path": "/active", "value": 7 }
  ]
}
```

| Field     | Type   | Required | Description                               |
| --------- | ------ | -------- | ----------------------------------------- |
| `key`     | string | yes      | State key being updated                   |
| `patches` | array  | yes      | Array of JSON Patch operations (RFC 6902) |

Each patch object:

| Field   | Type   | Required             | Description                                                |
| ------- | ------ | -------------------- | ---------------------------------------------------------- |
| `op`    | string | yes                  | One of: `add`, `remove`, `replace`, `move`, `copy`, `test` |
| `path`  | string | yes                  | JSON Pointer (RFC 6901) to the target location             |
| `value` | any    | for add/replace/test | The value to apply                                         |
| `from`  | string | for move/copy        | Source JSON Pointer                                        |

Clients must maintain local state per key and apply patches in order using a conformant JSON Patch implementation. After applying all patches, the local state matches the server's state.

### 5.6 State Snapshot (`0x06` — Server → Client)

```json
{
  "key": "dashboard",
  "version": 1,
  "data": { "visitors": 0, "active": 0 }
}
```

| Field     | Type   | Required | Description              |
| --------- | ------ | -------- | ------------------------ |
| `key`     | string | yes      | State key                |
| `version` | number | yes      | Monotonic version number |
| `data`    | any    | yes      | Complete state value     |

Sent when a client first subscribes to a state key, or when the server determines a full snapshot is more efficient than patches.

### 5.7 Ping (`0x07` — Client → Server)

Payload: `null` (JSON).

The `correlationId` may be any value. The server responds with a PONG using the same `correlationId`.

### 5.8 Pong (`0x08` — Server → Client)

Payload: `null` (JSON).

The `correlationId` matches the PING's `correlationId`.

### 5.9 Error (`0x09` — Server → Client)

```json
{
  "message": "Rate limit exceeded",
  "retryAfter": 5000
}
```

| Field        | Type   | Required | Description                                 |
| ------------ | ------ | -------- | ------------------------------------------- |
| `message`    | string | yes      | Human-readable error message                |
| `retryAfter` | number | no       | Milliseconds before the client should retry |

### 5.10 CRDT Operation (`0x0A` — Client → Server)

```json
{
  "key": "votes",
  "op": {
    "type": "pn-counter",
    "nodeId": "client-1",
    "timestamp": 1711234567890,
    "op": "increment",
    "value": 1
  }
}
```

| Field          | Type   | Required | Description                                                 |
| -------------- | ------ | -------- | ----------------------------------------------------------- |
| `key`          | string | yes      | CRDT key                                                    |
| `op.type`      | string | yes      | CRDT type: `pn-counter`, `lww-register`, `lww-map`          |
| `op.nodeId`    | string | yes      | Unique node identifier for the client                       |
| `op.timestamp` | number | yes      | Unix timestamp in milliseconds (hybrid logical clock)       |
| `op.op`        | string | yes      | Operation: `increment`, `decrement`, `set`, `add`, `remove` |
| `op.key`       | string | no       | Sub-key for maps                                            |
| `op.value`     | any    | no       | Value for set/add operations                                |

### 5.11 CRDT State (`0x0B` — Server → Client)

```json
{
  "key": "votes",
  "state": {
    "type": "pn-counter",
    "value": 42,
    "metadata": {
      "type": "pn-counter",
      "nodeId": "server",
      "timestamp": 1711234567890,
      "version": 7
    }
  }
}
```

| Field            | Type   | Required | Description                                      |
| ---------------- | ------ | -------- | ------------------------------------------------ |
| `key`            | string | yes      | CRDT key                                         |
| `state.type`     | string | yes      | CRDT type                                        |
| `state.value`    | any    | yes      | Current merged value                             |
| `state.metadata` | object | yes      | CRDT metadata (type, nodeId, timestamp, version) |

## 6. Connection Lifecycle

### 6.1 Connection Flow

```
Client                              Server
  |                                     |
  |--- HTTP Upgrade (GET /__ds?token=…) -->
  |                                     |-- Auth handler
  |<-- 101 Switching Protocols ---------|  (or 401 Unauthorized)
  |                                     |
  |===== Binary WebSocket Frames =======|
  |                                     |
  |--- RPC_REQ (correlationId=1) ------>|
  |<-- RPC_RES (correlationId=1) -------|
  |                                     |
  |--- EVENT_C2S ---------------------->|
  |<-- EVENT_S2C -----------------------|
  |<-- STATE_PATCH ---------------------|
  |<-- CRDT_STATE ----------------------|
  |                                     |
  |--- PING --------------------------->|
  |<-- PONG ----------------------------|
  |                                     |
  |--- Close (1000) ------------------->|
  |<-- Close (1000) --------------------|
```

### 6.2 Reconnection

Clients should implement automatic reconnection with linear backoff capped at 5x the base interval:

```
delay = base_interval * min(attempt_number, 5)
```

| Parameter              | Default   | Description                             |
| ---------------------- | --------- | --------------------------------------- |
| `reconnect`            | `true`    | Enable automatic reconnection           |
| `reconnectInterval`    | `1000` ms | Base delay between attempts             |
| `maxReconnectAttempts` | `10`      | Maximum number of reconnection attempts |

**Reconnection algorithm:**

```python
attempt = 0
while attempt < max_reconnect_attempts:
    attempt += 1
    delay = reconnect_interval * min(attempt, 5)
    sleep(delay)
    try:
        connect()
        attempt = 0  # reset on success
        break
    except:
        continue
```

On successful reconnection, the attempt counter resets to 0. All pending RPC calls should be rejected (cleared) before reconnection.

### 6.3 Close Codes

| Code   | Meaning                            |
| ------ | ---------------------------------- |
| `1000` | Normal closure                     |
| `1001` | Server shutting down               |
| `1006` | Abnormal closure (connection lost) |

## 7. Client Implementation Checklist

A complete datasole client implementation must:

### 7.1 Transport

- [ ] Connect via WebSocket (binary mode) to `ws[s]://<host>/__ds?token=<token>`
- [ ] **Not** negotiate `permessage-deflate`
- [ ] Handle binary frames only
- [ ] Implement reconnection with linear backoff (capped at 5x base)

### 7.2 Framing

- [ ] Encode outgoing frames: 9-byte header (opcode, correlationId, payloadLength) + JSON payload
- [ ] Decode incoming frames: parse 9-byte header, extract payload
- [ ] Use big-endian (network byte order) for `correlationId` and `payloadLength`

### 7.3 Compression

- [ ] Before sending: if encoded frame > 256 bytes, zlib-compress the entire frame
- [ ] After receiving: if wire data > 256 bytes, zlib-decompress before decoding
- [ ] Use standard zlib (RFC 1950) compression, not raw deflate or gzip

### 7.4 RPC

- [ ] Assign monotonically increasing `correlationId` to each RPC request
- [ ] Maintain a pending-requests map keyed by `correlationId`
- [ ] Match incoming `RPC_RES` to pending requests by `correlationId`
- [ ] Implement per-call timeout (default: 30 seconds)
- [ ] Reject all pending RPCs on disconnect

### 7.5 Events

- [ ] Send client events with opcode `0x03`, `correlationId = 0`
- [ ] Receive server events with opcode `0x04`
- [ ] Support multiple event listeners per event name

### 7.6 State

- [ ] Maintain local state store keyed by state key
- [ ] Apply JSON Patch (RFC 6902) operations from `STATE_PATCH` messages
- [ ] Replace entire state on `STATE_SNAPSHOT` messages
- [ ] Notify subscribers after each state update

### 7.7 CRDTs (optional)

- [ ] Send CRDT operations with opcode `0x0A`
- [ ] Receive CRDT state broadcasts with opcode `0x0B`
- [ ] Implement at least: `pn-counter` (increment/decrement), `lww-register` (set), `lww-map` (set/remove)
- [ ] Use hybrid logical clock timestamps (millisecond-resolution `Date.now()`)
- [ ] Merge remote state using last-writer-wins semantics

### 7.8 Keepalive

- [ ] Periodically send `PING` frames
- [ ] Expect `PONG` responses
- [ ] Detect dead connections via PONG timeout

## 8. Reference Implementation

The canonical TypeScript implementation is at [github.com/mayanklahiri/datasole](https://github.com/mayanklahiri/datasole).

Key source files for implementors:

| File                                | What it defines                                                |
| ----------------------------------- | -------------------------------------------------------------- |
| `src/shared/protocol/opcodes.ts`    | Opcode enum                                                    |
| `src/shared/protocol/frames.ts`     | Frame encode/decode (9-byte header)                            |
| `src/shared/codec/compression.ts`   | zlib compress/decompress                                       |
| `src/shared/codec/serialization.ts` | JSON serialize/deserialize via TextEncoder                     |
| `src/shared/types/rpc.ts`           | RPC request/response/error types                               |
| `src/shared/types/events.ts`        | Event payload types                                            |
| `src/shared/types/state.ts`         | State patch/snapshot types                                     |
| `src/shared/crdt/types.ts`          | CRDT operation/state types                                     |
| `src/shared/build-constants.ts`     | Protocol version, defaults, thresholds                         |
| `src/client/client.ts`              | Reference client (URL construction, reconnection, dispatch)    |
| `src/server/server.ts`              | Reference server (frame handling, broadcast, state management) |

## 9. Example: Minimal Client in Pseudocode

```python
import websocket
import json
import zlib

COMPRESSION_THRESHOLD = 256
correlation_counter = 0
pending_rpcs = {}

def encode_frame(opcode, correlation_id, payload_obj):
    payload_bytes = json.dumps(payload_obj).encode('utf-8')
    header = bytes([opcode])
    header += correlation_id.to_bytes(4, 'big')
    header += len(payload_bytes).to_bytes(4, 'big')
    return header + payload_bytes

def decode_frame(data):
    opcode = data[0]
    correlation_id = int.from_bytes(data[1:5], 'big')
    payload_length = int.from_bytes(data[5:9], 'big')
    payload = json.loads(data[9:9+payload_length].decode('utf-8'))
    return opcode, correlation_id, payload

def send(ws, opcode, correlation_id, payload):
    frame = encode_frame(opcode, correlation_id, payload)
    if len(frame) > COMPRESSION_THRESHOLD:
        frame = zlib.compress(frame)
    ws.send_binary(frame)

def receive(ws):
    data = ws.recv()
    if len(data) > COMPRESSION_THRESHOLD:
        data = zlib.decompress(data)
    return decode_frame(data)

def rpc(ws, method, params):
    global correlation_counter
    correlation_counter += 1
    cid = correlation_counter
    send(ws, 0x01, cid, {"method": method, "params": params, "correlationId": cid})
    # wait for RPC_RES with matching correlationId...

# Connect
ws = websocket.connect("ws://localhost:3000/__ds?token=my-token",
                        suppress_origin=True)
# disable permessage-deflate in your WebSocket library configuration

# Send an RPC
rpc(ws, "getUser", {"id": "42"})
```
