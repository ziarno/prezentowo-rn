#!/bin/bash

git submodule update --init --recursive

VENV_DIR="packages/mcp-meteor/.venv"

if ! command -v python3 &> /dev/null; then
  echo "Warning: python3 not found, skipping meteor MCP setup"
  exit 0
fi

if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

"$VENV_DIR/bin/pip" install fastmcp==3.0.2 --quiet
echo "Meteor MCP server ready"
