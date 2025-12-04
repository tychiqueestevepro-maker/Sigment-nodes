#!/bin/bash
# Wrapper pour exécuter les scripts de diagnostic avec le bon environnement

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Activer le venv
if [ -d "$PROJECT_ROOT/venv" ]; then
    source "$PROJECT_ROOT/venv/bin/activate"
elif [ -d "$PROJECT_ROOT/backend/venv" ]; then
    source "$PROJECT_ROOT/backend/venv/bin/activate"
fi

# Exécuter le diagnostic
python3 "$SCRIPT_DIR/diagnostic_backend.py" "$@"
