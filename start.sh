#!/usr/bin/env bash
# ==============================================================================
# TikTok LIVE - Standalone Streamer Launcher
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=================================================="
echo "⚡ TikTok LIVE Standalone RTMP Suite"
echo "=================================================="

# 1. Virtual Audio Check
export PULSE_SERVER="unix:/run/user/1000/pulse/native"
export DISPLAY="${DISPLAY:-:1}"

# 2. Virtual Environment Python
VENV_PY="/data/workspace/venv/bin/python3"
if [ ! -f "$VENV_PY" ]; then
    echo "Virtualenv not found, using system python3..."
    VENV_PY="python3"
fi

echo "✓ Launching Web Dashboard on http://localhost:8080..."
exec "$VENV_PY" "$DIR/server.py"
