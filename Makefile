WEB_DIR := apps/web-risk-viewer

.PHONY: dev install build help

help:
	@echo "make dev          - install deps if needed, then launch the risk-viewer dev server (http://localhost:5173)"
	@echo "make install      - npm install in $(WEB_DIR)"
	@echo "make build        - production build of $(WEB_DIR)"
	@echo ""
	@echo "The data pipeline lives in a separate private repo (45-45-platform,"
	@echo "sibling checkout) - to regenerate public/data, run its 08_prepare_"
	@echo "webapp_data.py (and friends) from there. See that repo's README."

dev:
	@if [ ! -d "$(WEB_DIR)/node_modules" ]; then \
		echo "Installing dependencies..."; \
		cd $(WEB_DIR) && npm install; \
	fi
	cd $(WEB_DIR) && npm run dev

install:
	cd $(WEB_DIR) && npm install

build:
	cd $(WEB_DIR) && npm run build
