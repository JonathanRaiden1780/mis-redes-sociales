# Pattern: adding MCP (Model Context Protocol) integration to a Python CLI platform

Use when connecting the platform to external tool servers via MCP for tool interoperability and richer external context. Different from execution backends — MCP is a JSON-RPC protocol for tool discovery and invocation, not a task-running backend.

## Pattern shape

MCP integration has five pieces:

### 1. Models (`src/aiep/mcp/models.py`)
- `McpTransport` enum: `STDIO`, `HTTP`
- `McpServerConfig` dataclass: `name`, `transport`, `command` (stdio), `url` (http), `args`, `env`
- `McpTool` dataclass: `name`, `description`, `input_schema`
- `McpToolResult` dataclass: `content`, `is_error`

### 2. Client (`src/aiep/mcp/client.py`)
- `McpClient` with `connect(config)`, `list_tools()`, `call_tool(name, arguments)`, `disconnect()`
- StdioClient: spawns subprocess, communicates via JSON-RPC over stdin/stdout
- HttpClient: connects via HTTP/SSE for remote servers
- Both transports use JSON-RPC 2.0 envelope: `{"jsonrpc": "2.0", "id": N, "method": "...", "params": {...}}`
- Tool listing: `tools/list` method
- Tool invocation: `tools/call` method with `name` and `arguments`

### 3. Adapter (`src/aiep/mcp/adapter.py`)
- `McpAdapter` wrapping `McpClient`
- Takes optional `server_config` for connection management
- `execute(request)` → extracts tool name from `provider_config["tool"]`, calls `client.call_tool()`
- Returns `ExecutionResult` with success/error based on `McpToolResult.is_error`

### 4. Registry (`src/aiep/mcp/registry.py`)
- `McpRegistry` reads server definitions from `.ai/mcp.yaml`
- `load()`, `list_servers()`, `get_server(name)`, `get_all_tools(name)`
- Lazy connection — only connects when tools are actually needed
- Format:
```yaml
servers:
  my-server:
    transport: stdio
    command: python
    args: ["-m", "my_server"]
  remote:
    transport: http
    url: https://mcp.example.com
```

### 5. CLI Commands (`src/aiep/commands/mcp.py`)
- `ai mcp list` — list configured servers
- `ai mcp tools <server>` — list tools from a server
- `ai mcp call <server> <tool> --args '{...}'` — invoke a tool with JSON arguments
- `ai mcp status` — show health status

## File layout

```
src/aiep/mcp/__init__.py           # Package exports
src/aiep/mcp/models.py             # Transport enum, config, tool, result
src/aiep/mcp/client.py             # JSON-RPC client (stdio + http)
src/aiep/mcp/adapter.py            # ExecutionAdapter wrapper
src/aiep/mcp/registry.py           # Server config from .ai/mcp.yaml
src/aiep/runtime/checkers/mcp.py   # Runtime health checker
src/aiep/commands/mcp.py           # CLI commands
src/aiep/cli.py                    # Wire commands
tests/unit/test_mcp_integration.py # Fake-based unit tests
```

## Decisions encoded in this pattern

- **Protocol, not base class.** `McpClient` is a plain class — no need for structural typing since MCP has a single implementation.
- **Two transports, one interface.** Stdio for local binaries, HTTP for remote servers. Same `connect/list_tools/call_tool/disconnect` API.
- **JSON-RPC 2.0 envelope.** Standard MCP protocol framing — `jsonrpc`, `id`, `method`, `params`.
- **Registry reads from `.ai/mcp.yaml`.** Per-project server configuration, consistent with how the platform handles other project-local config.
- **Adapter is thin.** Extracts tool name from config, delegates to client, translates result to `ExecutionResult`.
- **Tests use fakes, never real MCP servers.** Mock `subprocess.Popen`, file reads, `shutil.which`.

## Pitfalls

- **Do not catch blind `Exception`.** Ruff BLE001 flags this. Use specific exceptions: `OSError`, `ConnectionError`, `ValueError`, `json.JSONDecodeError`.
- **Do not use `pytest.raises(Exception)`.** Ruff B007 flags this. Use the specific exception class you expect (e.g., `ApiError`).
- **Do not access `self._process.stdin` without null checks.** Pyright flags optional attribute access. Guard with `if not self._process or not self._process.stdin or not self._process.stdout: return`.
- **Do not import unused symbols.** Ruff F401 flags imports like `_resolve_credentials` or `McpTransport` if unused in a file.
- **Do not use `date.today()`.** Ruff DTZ011 flags it. Use `datetime.now(UTC).date()`.
- **Do not shadow builtins.** Use `list_servers`, not `list` as a method name.
- **Do not forget to disconnect.** Always call `client.disconnect()` in `finally` block to avoid zombie subprocesses.

## Testing

- **Model tests:** Verify dataclass creation, enum values.
- **Client tests:** Mock `subprocess.Popen` for stdio, test missing config fields, test list/call tool flows.
- **Adapter tests:** Test without config (returns error), test with config (delegates to mocked client).
- **Registry tests:** Use `tmp_path` with `.ai/mcp.yaml`, test loading, listing, getting servers.
- **Runtime checker tests:** Test disabled provider, missing command, missing binary, valid config.

## QA gate

```bash
black src/ tests/
ruff check src/ tests/
mypy src/ tests/
pytest tests/ -q
```

## When to reach for this pattern

- You need to connect to external tool servers (databases, APIs, file systems, etc.)
- The protocol is MCP (Model Context Protocol)
- You want per-project server configuration
- Tools should be discoverable and invocable from CLI

## Example (validated)

### MCP (SPEC-042 / TASK-041)

1. `src/aiep/mcp/models.py` — `McpTransport` enum, `McpServerConfig`, `McpTool`, `McpToolResult`.
2. `src/aiep/mcp/client.py` — `McpClient` with stdio (subprocess.Popen + JSON-RPC) and HTTP transports.
3. `src/aiep/mcp/adapter.py` — `McpAdapter` wraps client, extracts tool name from config.
4. `src/aiep/mcp/registry.py` — `McpRegistry` reads `.ai/mcp.yaml`, lazy-connects for tool listing.
5. `src/aiep/runtime/checkers/mcp.py` — `McpRuntimeChecker` validates transport-specific requirements.
6. `src/aiep/commands/mcp.py` — `list_servers()`, `list_tools()`, `call_tool()`, `status()`.
7. `src/aiep/cli.py` — `@app.command(name="mcp-list")`, `mcp-tools`, `mcp-call`, `mcp-status`.
8. `tests/unit/test_mcp_integration.py` — 20 tests with mocked subprocess, tmp_path for config, no real MCP servers.

---

**Key lesson:** MCP integration follows the same "small decoupled pieces" philosophy as execution backends, but uses JSON-RPC protocol semantics instead of subprocess shells. The pattern is mechanical once you have the protocol envelope right.
