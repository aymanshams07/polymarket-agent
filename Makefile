.PHONY: up down logs build dev-backend dev-frontend migrate lint test

# ─── Docker ──────────────────────────────────────────────────
up: .env
	docker compose up -d

.env:
	@test -f .env || (cp .env.example .env && echo "Created .env from .env.example — add your API keys before running again" && exit 1)

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

restart:
	docker compose restart $(s)

# ─── Local dev (no Docker) ───────────────────────────────────
dev-backend:
	cd backend && uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

# ─── Database ────────────────────────────────────────────────
migrate:
	cd backend && alembic upgrade head

migrate-new:
	cd backend && alembic revision --autogenerate -m "$(msg)"

# ─── Quality ─────────────────────────────────────────────────
lint-backend:
	cd backend && ruff check . && mypy app

lint-frontend:
	cd frontend && npm run lint

test:
	cd backend && pytest -v

# ─── Setup ───────────────────────────────────────────────────
setup:
	cp -n .env.example .env || true
	cd backend && pip install -r requirements.txt
	cd frontend && npm install
