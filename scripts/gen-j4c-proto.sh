#!/usr/bin/env bash
# Regenerate Python gRPC stubs from proto/j4c_agent.proto into
# scripts/j4c_grpc/. Run this once after editing the .proto file.
#
# Requires: pip install grpcio-tools (see scripts/j4c-agent-requirements.txt).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROTO_DIR="$REPO_ROOT/proto"
OUT_DIR="$REPO_ROOT/scripts/j4c_grpc"

mkdir -p "$OUT_DIR"
touch "$OUT_DIR/__init__.py"

python3 -m grpc_tools.protoc \
    -I "$PROTO_DIR" \
    --python_out="$OUT_DIR" \
    --grpc_python_out="$OUT_DIR" \
    "$PROTO_DIR/j4c_agent.proto"

# grpc_tools emits absolute imports (`import j4c_agent_pb2`) which break
# when the generated files live in a package directory. Rewrite to a
# package-relative import so `from j4c_grpc import j4c_agent_pb2_grpc`
# works.
if [[ -f "$OUT_DIR/j4c_agent_pb2_grpc.py" ]]; then
    sed -i.bak \
        -e 's/^import j4c_agent_pb2/from . import j4c_agent_pb2/' \
        "$OUT_DIR/j4c_agent_pb2_grpc.py"
    rm -f "$OUT_DIR/j4c_agent_pb2_grpc.py.bak"
fi

echo "Generated stubs into $OUT_DIR/:"
ls -1 "$OUT_DIR/"
