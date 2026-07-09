WEB_DIR := apps/web-risk-viewer
VENV := .venv/bin/activate

.PHONY: dev install build data-prep help

help:
	@echo "make dev          - install deps if needed, then launch the risk-viewer dev server (http://localhost:5173)"
	@echo "make install      - npm install in $(WEB_DIR)"
	@echo "make build        - production build of $(WEB_DIR)"
	@echo "make data-prep    - regenerate apps/web-risk-viewer/public/data from the pipeline's outputs"

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

data-prep:
	bash -c "source $(VENV) && python data_pipelines/pipelines/08_prepare_webapp_data.py"
