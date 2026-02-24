.PHONY: dev tauri backend frontend install lint fmt build clean

# 一键启动：后端 + Tauri 桌面端（含前端）
dev:
	@echo "🎵 Starting HikariWave (Backend + Tauri Desktop)..."
	@trap 'kill 0' EXIT; \
		$(MAKE) backend & \
		sleep 2 && $(MAKE) tauri & \
		wait

# Tauri 桌面端（编译 Rust + 启动前端 dev server）
tauri:
	cd desktop && bun run tauri dev

# 仅启动前端 Web（不含 Tauri 壳，浏览器调试用）
frontend:
	cd desktop && bun run dev

# 仅启动后端
backend:
	uv run uvicorn backend.app.main:app --reload --port 23456

# 安装所有依赖
install:
	uv sync --extra ace-step
	cd desktop && bun install

# Lint 检查（后端 + 前端）
lint:
	uv run ruff check .
	cd desktop && bun run lint

# 格式化（后端）
fmt:
	uv run ruff format .
	uv run ruff check . --fix

# 构建前端
build:
	cd desktop && bun run build

# 构建 Tauri 桌面端发行版
build-tauri:
	cd desktop && bun run tauri build

# 清理
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -f *.db
	rm -rf desktop/dist desktop/src-tauri/target/debug
