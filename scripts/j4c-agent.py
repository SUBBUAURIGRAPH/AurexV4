#!/usr/bin/env python3
"""
j4c-agent — lightweight per-project J4C compliance probe.

Single file, stdlib only. Drop into any Aurigraph project alongside a
``.j4c-agent.json`` config at the repo root. Outputs a JSON report covering
local repo state, deployed-server state, container health, HTTP health
endpoints, CSP allowlist drift, the 3-layer AutoHeal status, and (if a
JIRA token is exported) open-ticket counts.

Usage
-----
::

    python3 scripts/j4c-agent.py doctor          # JSON report → stdout
    python3 scripts/j4c-agent.py doctor -v       # human-readable summary
    python3 scripts/j4c-agent.py report          # doctor + POST to J4C central

Exit codes
----------
* ``0`` — PASS  (all gates green)
* ``1`` — PARTIAL  (functional but one or more AutoHeal layers / drift items)
* ``2`` — FAIL  (a hard gate failed: server unreachable, container down,
   endpoint non-200, etc.)

The verdict matches ADM-068 semantics so the agent is CI-friendly:
``j4c-agent doctor && echo OK`` only succeeds when the project is fully
ADM-compliant.

Design notes
------------
* Stdlib only — no pip dependencies; runs anywhere with Python 3.8+.
* Auto-detects ``local`` mode (developer laptop, SSHs to the configured
  server) vs ``server`` mode (running on the prod host, queries Docker
  locally) by hostname comparison.
* Each section is independent — a failure in one section does not abort
  the others; the verdict is the worst over all sections.
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Verdict ladder
# ---------------------------------------------------------------------------

VERDICT_PASS = "PASS"
VERDICT_PARTIAL = "PARTIAL"
VERDICT_FAIL = "FAIL"
_VERDICT_ORDER = {VERDICT_PASS: 0, VERDICT_PARTIAL: 1, VERDICT_FAIL: 2}


def worse(a: str, b: str) -> str:
    return a if _VERDICT_ORDER[a] >= _VERDICT_ORDER[b] else b


# ---------------------------------------------------------------------------
# Config + mode detection
# ---------------------------------------------------------------------------


def load_config(repo_root: Path) -> dict[str, Any]:
    config_path = repo_root / ".j4c-agent.json"
    if not config_path.exists():
        sys.stderr.write(
            f"j4c-agent: config not found at {config_path} — copy from another "
            "Aurigraph project's .j4c-agent.json and adjust\n"
        )
        sys.exit(2)
    return json.loads(config_path.read_text())


def detect_mode(server_host: str) -> str:
    """``server`` if running on the configured host (matches local hostname /
    any local IP), else ``local`` (use SSH to reach the server)."""
    try:
        local_hostnames = {socket.gethostname(), socket.getfqdn()}
        local_ips = set()
        for info in socket.getaddrinfo(socket.gethostname(), None):
            local_ips.add(info[4][0])
        if server_host in local_hostnames or server_host in local_ips:
            return "server"
    except Exception:
        pass
    return "local"


# ---------------------------------------------------------------------------
# Subprocess helpers
# ---------------------------------------------------------------------------


def run(cmd: list[str], cwd: Path | None = None, timeout: int = 30) -> tuple[int, str, str]:
    """Run a command, return (rc, stdout, stderr) with no shell interpolation."""
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"
    except FileNotFoundError as exc:
        return 127, "", str(exc)


def ssh_run(server_cfg: dict[str, Any], remote_cmd: str, timeout: int = 30) -> tuple[int, str, str]:
    """Run ``remote_cmd`` over SSH per the configured server."""
    target = f"{server_cfg['user']}@{server_cfg['host']}"
    cmd = [
        "ssh",
        "-p", str(server_cfg["ssh_port"]),
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=10",
        target,
        remote_cmd,
    ]
    return run(cmd, timeout=timeout)


# ---------------------------------------------------------------------------
# Section 1: project (local git state)
# ---------------------------------------------------------------------------


def section_project(repo_root: Path, config: dict[str, Any]) -> dict[str, Any]:
    rc, head, _ = run(["git", "rev-parse", "HEAD"], cwd=repo_root)
    rc2, branch, _ = run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=repo_root)
    rc3, log, _ = run(
        ["git", "log", "-1", "--pretty=format:%h|%an|%ae|%cI|%s"],
        cwd=repo_root,
    )
    parts = log.split("|", 4) if rc3 == 0 and log else []
    return {
        "name": config.get("project", "unknown"),
        "head": head.strip() if rc == 0 else None,
        "branch": branch.strip() if rc2 == 0 else None,
        "last_commit": (
            {
                "short": parts[0],
                "author": parts[1],
                "email": parts[2],
                "committed_at": parts[3],
                "subject": parts[4],
            }
            if len(parts) == 5
            else None
        ),
        "verdict": VERDICT_PASS,
    }


# ---------------------------------------------------------------------------
# Section 2: deploy (server commit + drift)
# ---------------------------------------------------------------------------


def section_deploy(
    config: dict[str, Any], local_head: str | None, mode: str
) -> dict[str, Any]:
    server_cfg = config["server"]
    deploy_path = server_cfg["deploy_path"]
    if mode == "server":
        rc, server_head, err = run(
            ["git", "-C", deploy_path, "rev-parse", "HEAD"]
        )
    else:
        rc, server_head, err = ssh_run(
            server_cfg, f"git -C {deploy_path} rev-parse HEAD"
        )
    server_head = server_head.strip() if rc == 0 else None

    out: dict[str, Any] = {
        "mode": mode,
        "server_path": deploy_path,
        "server_head": server_head,
        "local_head": local_head,
        "drift": None,
        "verdict": VERDICT_PASS,
    }
    if rc != 0:
        # No remote .git in deploy_path is a common pattern (the deploy
        # script tar's the source over but doesn't preserve .git — the
        # canonical SHA lives on origin/main + the running image's
        # bake-time label). Drift detection is then impossible, but
        # that's a missing feature on the remote, not a deploy failure.
        out["error"] = err.strip() or "git rev-parse failed"
        out["verdict"] = VERDICT_PARTIAL
        return out
    if local_head and server_head and server_head != local_head:
        out["drift"] = {"server": server_head, "local": local_head}
        # Drift is informational at PARTIAL — could be intentional (server
        # ahead while a feature branch is in flight, or behind a docs commit).
        out["verdict"] = VERDICT_PARTIAL
    return out


# ---------------------------------------------------------------------------
# Section 3: containers
# ---------------------------------------------------------------------------


def _docker_ps(config: dict[str, Any], mode: str) -> tuple[int, str]:
    """Return (rc, raw newline-delimited 'name|status|health' tuples)."""
    fmt = '{{.Names}}|{{.State}}|{{.Status}}'
    docker_cmd = (
        "docker ps -a --no-trunc "
        f"--format '{fmt}' "
    )
    if mode == "server":
        rc, out, _ = run(["sh", "-c", docker_cmd])
    else:
        rc, out, _ = ssh_run(config["server"], docker_cmd)
    return rc, out


def section_containers(config: dict[str, Any], mode: str) -> dict[str, Any]:
    expected = list(config.get("expected_containers", []))
    rc, raw = _docker_ps(config, mode)
    if rc != 0:
        return {
            "verdict": VERDICT_FAIL,
            "error": "docker ps failed",
            "expected": expected,
            "actual": [],
        }

    actual: list[dict[str, str]] = []
    for line in raw.splitlines():
        if not line.strip():
            continue
        parts = line.split("|", 2)
        if len(parts) != 3:
            continue
        name, state, status = parts
        # Parse '(healthy)' / '(unhealthy)' / '(starting)' from status
        health = "n/a"
        for tag in ("(healthy)", "(unhealthy)", "(health: starting)"):
            if tag in status:
                health = tag.strip("() ")
                break
        actual.append({"name": name, "state": state, "status": status, "health": health})

    actual_by_name = {c["name"]: c for c in actual}
    missing = [n for n in expected if n not in actual_by_name]
    not_running = [
        c["name"]
        for c in actual
        if c["name"] in expected and c["state"] != "running"
    ]
    unhealthy = [
        c["name"]
        for c in actual
        if c["name"] in expected and c["health"] == "unhealthy"
    ]

    verdict = VERDICT_PASS
    if missing or not_running:
        verdict = VERDICT_FAIL
    elif unhealthy:
        verdict = VERDICT_PARTIAL

    return {
        "expected_count": len(expected),
        "running_count": len([c for c in actual if c["name"] in expected and c["state"] == "running"]),
        "missing": missing,
        "not_running": not_running,
        "unhealthy": unhealthy,
        "containers": actual,
        "verdict": verdict,
    }


# ---------------------------------------------------------------------------
# Section 4: endpoints
# ---------------------------------------------------------------------------


def _http_probe(url: str, timeout: float = 10.0) -> tuple[int | None, float, str | None]:
    """Return (status_code, elapsed_ms, error_message)."""
    started = time.monotonic()
    try:
        req = urllib.request.Request(url, method="GET", headers={"User-Agent": "j4c-agent/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed = (time.monotonic() - started) * 1000
            # Drain a small read to ensure the connection completed.
            resp.read(1024)
            return resp.status, elapsed, None
    except urllib.error.HTTPError as exc:
        elapsed = (time.monotonic() - started) * 1000
        return exc.code, elapsed, None
    except Exception as exc:
        elapsed = (time.monotonic() - started) * 1000
        return None, elapsed, str(exc)


def section_endpoints(config: dict[str, Any]) -> dict[str, Any]:
    probes = []
    verdict = VERDICT_PASS
    for ep in config.get("health_endpoints", []):
        url = ep["url"]
        expect = int(ep.get("expect", 200))
        code, elapsed, err = _http_probe(url)
        ok = code == expect
        probes.append(
            {
                "url": url,
                "expect": expect,
                "actual": code,
                "elapsed_ms": round(elapsed, 1),
                "ok": ok,
                "error": err,
            }
        )
        if not ok:
            verdict = VERDICT_FAIL
    return {"probes": probes, "verdict": verdict}


# ---------------------------------------------------------------------------
# Section 5: CSP allowlist
# ---------------------------------------------------------------------------


def _fetch_csp(url: str) -> tuple[str | None, str | None]:
    try:
        req = urllib.request.Request(
            url + ("?cb=" + str(int(time.time()))),
            method="HEAD",
            headers={"User-Agent": "j4c-agent/1.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            csp = resp.headers.get("Content-Security-Policy")
            return csp, None
    except Exception as exc:
        return None, str(exc)


def section_csp(config: dict[str, Any]) -> dict[str, Any]:
    required = list(config.get("csp_required_origins", []))
    if not required:
        return {"verdict": VERDICT_PASS, "skipped": True}
    eps = config.get("health_endpoints", [])
    if not eps:
        return {"verdict": VERDICT_PARTIAL, "skipped": True, "reason": "no health endpoints to probe"}
    target = eps[0]["url"]
    csp, err = _fetch_csp(target)
    if err or not csp:
        return {
            "verdict": VERDICT_PARTIAL,
            "target": target,
            "error": err or "no Content-Security-Policy header",
        }
    missing = [origin for origin in required if origin not in csp]
    return {
        "target": target,
        "required_origins": required,
        "missing_origins": missing,
        "header_length": len(csp),
        "verdict": VERDICT_FAIL if missing else VERDICT_PASS,
    }


# ---------------------------------------------------------------------------
# Section 6: AutoHeal (3 layers)
# ---------------------------------------------------------------------------


def section_autoheal(config: dict[str, Any], mode: str, repo_root: Path) -> dict[str, Any]:
    cfg = config.get("autoheal", {})
    out: dict[str, Any] = {"layer1": {}, "layer2": {}, "layer3": {}}
    overall = VERDICT_PASS

    # ── Layer 1 — Docker compose `restart: always` per service ──
    compose_path = repo_root / cfg.get("layer1_compose_file", "docker-compose.yml")
    layer1 = {"verdict": VERDICT_PASS, "compose_file": str(compose_path)}
    if compose_path.exists():
        text = compose_path.read_text()
        # Crude but no-yaml-dep. `restart: unless-stopped` is functionally
        # equivalent to `restart: always` for our autoheal posture (both
        # bring the container back after a crash; unless-stopped is the
        # AurexV4 default per ADM-055 because it survives a manual
        # `docker stop` without a fight). Count both as healthy.
        always = text.count("restart: always")
        unless_stopped = text.count("restart: unless-stopped")
        on_failure = text.count("restart: on-failure")
        nope = text.count("restart: 'no'") + text.count("restart: no\n")
        layer1["restart_always_count"] = always
        layer1["restart_unless_stopped_count"] = unless_stopped
        layer1["restart_on_failure_count"] = on_failure
        layer1["restart_no_count"] = nope
        healthy_count = always + unless_stopped + on_failure
        if healthy_count == 0:
            layer1["verdict"] = VERDICT_PARTIAL
            layer1["reason"] = (
                "no service has a healing restart policy "
                "(always | unless-stopped | on-failure)"
            )
    else:
        layer1["verdict"] = VERDICT_PARTIAL
        layer1["reason"] = "compose file not found"
    out["layer1"] = layer1
    overall = worse(overall, layer1["verdict"])

    # ── Layer 2 — systemd watchdog timer presence ──
    timer_unit = cfg.get("layer2_systemd_unit")
    layer2: dict[str, Any] = {"unit": timer_unit, "verdict": VERDICT_PARTIAL}
    if timer_unit:
        # The timer was installed as a user-scope unit (no sudo needed) —
        # check both system and user scopes, accept either.
        probe = (
            f"systemctl --user is-active {timer_unit} 2>/dev/null"
            f" || systemctl is-active {timer_unit} 2>/dev/null"
        )
        if mode == "server":
            rc, status, _ = run(["sh", "-c", probe])
        else:
            rc, status, _ = ssh_run(config["server"], probe)
        status = status.strip()
        layer2["status"] = status or "unknown"
        if status == "active":
            layer2["verdict"] = VERDICT_PASS
        else:
            layer2["verdict"] = VERDICT_PARTIAL
    out["layer2"] = layer2
    overall = worse(overall, layer2["verdict"])

    # ── Layer 3 — external probe timer presence ──
    probe_unit = cfg.get("layer3_extprobe_unit")
    layer3: dict[str, Any] = {"unit": probe_unit, "verdict": VERDICT_PARTIAL}
    if probe_unit:
        probe = (
            f"systemctl --user is-active {probe_unit} 2>/dev/null"
            f" || systemctl is-active {probe_unit} 2>/dev/null"
        )
        if mode == "server":
            rc, status, _ = run(["sh", "-c", probe])
        else:
            rc, status, _ = ssh_run(config["server"], probe)
        status = status.strip()
        layer3["status"] = status or "unknown"
        if status == "active":
            layer3["verdict"] = VERDICT_PASS
        else:
            layer3["verdict"] = VERDICT_PARTIAL
    out["layer3"] = layer3
    overall = worse(overall, layer3["verdict"])

    out["verdict"] = overall
    return out


# ---------------------------------------------------------------------------
# Section 7: JIRA (optional)
# ---------------------------------------------------------------------------


def section_jira(config: dict[str, Any]) -> dict[str, Any]:
    project_key = config.get("jira_project_key")
    site = config.get("jira_site", "aurigraphdlt.atlassian.net")
    token = os.environ.get("JIRA_TOKEN")
    email = os.environ.get("JIRA_EMAIL")
    if not (project_key and token and email):
        return {
            "verdict": VERDICT_PASS,
            "skipped": True,
            "reason": "JIRA_TOKEN / JIRA_EMAIL not set; skipping (set both to enable)",
        }
    import base64
    auth = base64.b64encode(f"{email}:{token}".encode()).decode()
    jql = f"project = {project_key} AND statusCategory != Done"
    url = (
        f"https://{site}/rest/api/3/search?jql="
        + urllib.parse.quote(jql)
        + "&maxResults=0"
        if False
        else f"https://{site}/rest/api/3/search?jql=" + urllib.parse.quote(jql)
        + "&fields=priority&maxResults=100"
    )
    try:
        req = urllib.request.Request(
            url,
            headers={"Authorization": f"Basic {auth}", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        by_priority: dict[str, int] = {}
        for issue in data.get("issues", []):
            pri = (issue.get("fields", {}).get("priority") or {}).get("name", "Unknown")
            by_priority[pri] = by_priority.get(pri, 0) + 1
        return {
            "project": project_key,
            "open_total": data.get("total", 0),
            "by_priority": by_priority,
            "verdict": VERDICT_PASS,
        }
    except Exception as exc:
        return {"verdict": VERDICT_PARTIAL, "error": str(exc)}


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


# Lazy-imported here so a missing urllib.parse never blows up the import line.
import urllib.parse  # noqa: E402


def run_doctor(repo_root: Path) -> tuple[dict[str, Any], str]:
    config = load_config(repo_root)
    mode = detect_mode(config["server"]["host"])

    project = section_project(repo_root, config)
    deploy = section_deploy(config, project.get("head"), mode)
    containers = section_containers(config, mode)
    endpoints = section_endpoints(config)
    csp = section_csp(config)
    autoheal = section_autoheal(config, mode, repo_root)
    jira = section_jira(config)

    overall = VERDICT_PASS
    for sec in (project, deploy, containers, endpoints, csp, autoheal, jira):
        overall = worse(overall, sec.get("verdict", VERDICT_PASS))

    report = {
        "j4c_agent_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project": project,
        "mode": mode,
        "deploy": deploy,
        "containers": containers,
        "endpoints": endpoints,
        "csp": csp,
        "autoheal": autoheal,
        "jira": jira,
        "verdict": overall,
    }
    return report, overall


def render_human(report: dict[str, Any]) -> str:
    lines = []
    lines.append(
        f"j4c-agent v{report['j4c_agent_version']} — "
        f"{report['project']['name']} @ {report['project']['head'][:12] if report['project']['head'] else '?'} "
        f"({report['project']['branch']}) — mode={report['mode']}"
    )
    lines.append(f"verdict: {report['verdict']}")
    lines.append("")
    sections = ("deploy", "containers", "endpoints", "csp", "autoheal", "jira")
    for name in sections:
        sec = report[name]
        v = sec.get("verdict", "?")
        lines.append(f"  [{v:7}] {name}")
        if name == "deploy" and sec.get("drift"):
            lines.append(
                f"           drift: server={sec['drift']['server'][:12]} "
                f"local={sec['drift']['local'][:12]}"
            )
        if name == "containers":
            if sec.get("missing"):
                lines.append(f"           missing: {sec['missing']}")
            if sec.get("not_running"):
                lines.append(f"           not_running: {sec['not_running']}")
            if sec.get("unhealthy"):
                lines.append(f"           unhealthy: {sec['unhealthy']}")
            else:
                lines.append(
                    f"           {sec.get('running_count', 0)}/{sec.get('expected_count', 0)} expected containers running"
                )
        if name == "endpoints":
            for p in sec.get("probes", []):
                mark = "✓" if p["ok"] else "✗"
                lines.append(
                    f"           {mark} {p['actual']} {p['url']} ({p['elapsed_ms']} ms)"
                )
        if name == "csp" and sec.get("missing_origins"):
            lines.append(f"           missing CSP origins: {sec['missing_origins']}")
        if name == "autoheal":
            for layer in ("layer1", "layer2", "layer3"):
                lyr = sec[layer]
                lines.append(f"           {layer}: {lyr.get('verdict', '?')} ({lyr.get('status') or lyr.get('reason') or ''})")
        if name == "jira" and not sec.get("skipped"):
            by = sec.get("by_priority", {})
            lines.append(
                f"           {sec.get('open_total', 0)} open"
                + (" — " + ", ".join(f"{k}:{v}" for k, v in sorted(by.items())) if by else "")
            )
    return "\n".join(lines)


def post_to_central(report: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    """Submit the report to J4C central via gRPC (HTTP/2 + protobuf).

    The gRPC stack (``grpcio``, ``protobuf``) is imported lazily so the
    ``doctor`` command stays stdlib-only. ``report`` requires:

        pip install grpcio protobuf

    plus generated stubs at ``scripts/j4c_grpc/`` produced from
    ``proto/j4c_agent.proto`` (see proto file header for the protoc
    invocation).
    """
    central_cfg = config.get("j4c_central") or {}
    endpoint = central_cfg.get("grpc_endpoint")
    if not endpoint:
        return {"posted": False, "reason": "j4c_central.grpc_endpoint is null in config"}

    # Lazy imports — only fail when the user actually runs `report`.
    try:
        import grpc  # type: ignore
    except ImportError:
        return {
            "posted": False,
            "error": "grpcio not installed — pip install grpcio protobuf",
        }
    try:
        # Generated stubs live under scripts/j4c_grpc/ relative to the
        # script. Keep import paths discoverable from either the script
        # directory or the repo root.
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from j4c_grpc import j4c_agent_pb2 as pb  # type: ignore
        from j4c_grpc import j4c_agent_pb2_grpc as pb_grpc  # type: ignore
    except ImportError as exc:
        return {
            "posted": False,
            "error": (
                f"protobuf stubs not generated ({exc}). Run: "
                "python3 -m grpc_tools.protoc -I proto "
                "--python_out=scripts/j4c_grpc --grpc_python_out=scripts/j4c_grpc "
                "proto/j4c_agent.proto"
            ),
        }

    msg = _report_to_proto(report, pb)

    use_tls = bool(central_cfg.get("grpc_tls", True))
    auth_env = central_cfg.get("grpc_auth_token_env", "J4C_AGENT_TOKEN")
    auth_token = os.environ.get(auth_env, "") if auth_env else ""
    metadata = (("authorization", f"Bearer {auth_token}"),) if auth_token else ()

    try:
        if use_tls:
            credentials = grpc.ssl_channel_credentials()
            channel = grpc.secure_channel(endpoint, credentials)
        else:
            channel = grpc.insecure_channel(endpoint)
        with channel:
            stub = pb_grpc.AgentReportServiceStub(channel)
            response = stub.SubmitReport(msg, timeout=15, metadata=metadata)
        return {
            "posted": True,
            "endpoint": endpoint,
            "tls": use_tls,
            "status": response.status,
            "report_id": response.report_id,
            "follow_up_jira_keys": list(response.follow_up_jira_keys),
            "message": response.message,
        }
    except grpc.RpcError as exc:  # type: ignore[attr-defined]
        return {
            "posted": False,
            "endpoint": endpoint,
            "tls": use_tls,
            "grpc_code": exc.code().name if hasattr(exc, "code") else "UNKNOWN",
            "error": exc.details() if hasattr(exc, "details") else str(exc),
        }
    except Exception as exc:
        return {
            "posted": False,
            "endpoint": endpoint,
            "tls": use_tls,
            "error": str(exc),
        }


def _report_to_proto(report: dict[str, Any], pb):  # type: ignore[no-untyped-def]
    """Translate the dict report (same shape as JSON output) into the
    ``AgentReport`` protobuf message."""
    from google.protobuf.timestamp_pb2 import Timestamp  # type: ignore

    ts = Timestamp()
    # ISO-8601 → datetime → seconds since epoch
    try:
        gen_dt = datetime.fromisoformat(report["generated_at"].replace("Z", "+00:00"))
        ts.FromDatetime(gen_dt.astimezone(timezone.utc).replace(tzinfo=None))
    except Exception:
        ts.GetCurrentTime()

    msg = pb.AgentReport(
        j4c_agent_version=report.get("j4c_agent_version", ""),
        generated_at=ts,
        mode=report.get("mode", ""),
        verdict=report.get("verdict", ""),
    )

    p = report.get("project") or {}
    lc = p.get("last_commit") or {}
    msg.project.CopyFrom(pb.ProjectSection(
        name=p.get("name", ""),
        head=p.get("head") or "",
        branch=p.get("branch") or "",
        last_commit=pb.CommitInfo(
            short=lc.get("short", "") if lc else "",
            author=lc.get("author", "") if lc else "",
            email=lc.get("email", "") if lc else "",
            committed_at=lc.get("committed_at", "") if lc else "",
            subject=lc.get("subject", "") if lc else "",
        ),
        verdict=p.get("verdict", ""),
    ))

    d = report.get("deploy") or {}
    msg.deploy.CopyFrom(pb.DeploySection(
        mode=d.get("mode", ""),
        server_path=d.get("server_path", ""),
        server_head=d.get("server_head") or "",
        local_head=d.get("local_head") or "",
        drift=bool(d.get("drift")),
        verdict=d.get("verdict", ""),
        error=d.get("error", "") if d.get("error") else "",
    ))

    c = report.get("containers") or {}
    msg.containers.CopyFrom(pb.ContainersSection(
        expected_count=c.get("expected_count", 0),
        running_count=c.get("running_count", 0),
        missing=c.get("missing", []),
        not_running=c.get("not_running", []),
        unhealthy=c.get("unhealthy", []),
        containers=[
            pb.ContainerStatus(
                name=cs.get("name", ""),
                state=cs.get("state", ""),
                status=cs.get("status", ""),
                health=cs.get("health", ""),
            )
            for cs in c.get("containers", [])
        ],
        verdict=c.get("verdict", ""),
    ))

    e = report.get("endpoints") or {}
    msg.endpoints.CopyFrom(pb.EndpointsSection(
        probes=[
            pb.EndpointProbe(
                url=ep.get("url", ""),
                expect=int(ep.get("expect", 0) or 0),
                actual=int(ep.get("actual", 0) or 0),
                elapsed_ms=float(ep.get("elapsed_ms", 0) or 0),
                ok=bool(ep.get("ok")),
                error=ep.get("error", "") or "",
            )
            for ep in e.get("probes", [])
        ],
        verdict=e.get("verdict", ""),
    ))

    csp = report.get("csp") or {}
    msg.csp.CopyFrom(pb.CspSection(
        target=csp.get("target", "") or "",
        required_origins=csp.get("required_origins", []),
        missing_origins=csp.get("missing_origins", []),
        header_length=int(csp.get("header_length", 0) or 0),
        skipped=bool(csp.get("skipped")),
        verdict=csp.get("verdict", ""),
        error=csp.get("error", "") or "",
    ))

    ah = report.get("autoheal") or {}
    def _layer(d: dict[str, Any]) -> Any:
        return pb.AutoHealLayer(
            verdict=d.get("verdict", ""),
            status=d.get("status", "") or "",
            reason=d.get("reason", "") or "",
            unit=d.get("unit", "") or "",
        )
    msg.autoheal.CopyFrom(pb.AutoHealSection(
        layer1=_layer(ah.get("layer1") or {}),
        layer2=_layer(ah.get("layer2") or {}),
        layer3=_layer(ah.get("layer3") or {}),
        verdict=ah.get("verdict", ""),
    ))

    j = report.get("jira") or {}
    msg.jira.CopyFrom(pb.JiraSection(
        project=j.get("project", "") or "",
        open_total=int(j.get("open_total", 0) or 0),
        by_priority=j.get("by_priority", {}) or {},
        skipped=bool(j.get("skipped")),
        verdict=j.get("verdict", ""),
        error=j.get("error", "") or "",
    ))

    return msg


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="j4c-agent", description=__doc__.split("\n\n", 1)[0])
    parser.add_argument("command", choices=("doctor", "report"), help="action to run")
    parser.add_argument("-v", "--verbose", action="store_true", help="human-readable output")
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="repo root containing .j4c-agent.json (default: parent of script)",
    )
    args = parser.parse_args(argv)

    report, verdict = run_doctor(args.repo_root)

    if args.command == "report":
        config = load_config(args.repo_root)
        report["central_post"] = post_to_central(report, config)

    if args.verbose:
        print(render_human(report))
    else:
        print(json.dumps(report, indent=2, default=str))

    return {VERDICT_PASS: 0, VERDICT_PARTIAL: 1, VERDICT_FAIL: 2}[verdict]


if __name__ == "__main__":
    sys.exit(main())
