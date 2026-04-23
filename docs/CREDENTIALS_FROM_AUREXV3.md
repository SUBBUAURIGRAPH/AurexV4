# AurexV3 local credentials import

**Primary local store:** use the repo-root **`credentials.md`** (gitignored) for all secrets and paste values from AurexV3 as needed. Copy from `credentials.example.md` if you do not have `credentials.md` yet.

An optional file mirror under **`.credentials-aurexv3-import/aurexv3-mirror/`** (gitignored) can hold raw `.env` copies from AurexV3. Do not copy that folder into tracked paths.

**Source repository**: `~/AurexV3/AurexV3` (i.e. `/Users/subbujois/AurexV3/AurexV3`)

## Refresh the mirror

From the AurexV4 repo root:

```bash
REPO="$HOME/AurexV3/AurexV3"
DEST="$(pwd)/.credentials-aurexv3-import/aurexv3-mirror"
mkdir -p "$DEST"/{root,src/backend,src/frontend,certs,kubernetes,.mcp}
cp "$REPO"/.env.dev4 "$REPO"/.env.development "$REPO"/.env.local "$REPO"/.env.production "$REPO"/.env.staging "$DEST/root/" 2>/dev/null || true
cp "$REPO"/src/backend/.env "$REPO"/src/backend/.env.production "$REPO"/src/backend/.env.test "$DEST/src/backend/" 2>/dev/null || true
cp "$REPO"/src/frontend/.env "$REPO"/src/frontend/.env.e2e "$REPO"/src/frontend/.env.local "$REPO"/src/frontend/.env.production "$DEST/src/frontend/" 2>/dev/null || true
cp "$REPO"/.mcp/auth.json "$DEST/.mcp/" 2>/dev/null || true
cp "$REPO"/privkey.pem "$DEST/root/" 2>/dev/null || true
cp "$REPO"/certs/dev4-key.pem "$REPO"/certs/dev4-cert.pem "$DEST/certs/" 2>/dev/null || true
mkdir -p "$DEST/kubernetes"
cp "$REPO"/infrastructure/kubernetes/secrets.yaml "$DEST/kubernetes/" 2>/dev/null || true
```

After copying, open files only locally; never paste contents into tickets or chat.

## What was included in the last import

See **`.credentials-aurexv3-import/MANIFEST.txt`** (tracked): list of relative paths and byte sizes, no secret values.
