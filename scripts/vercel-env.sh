#!/usr/bin/env bash
#
# Push every variable in a local env file to a Vercel environment.
#
#   ./scripts/vercel-env.sh .env.local production
#   ./scripts/vercel-env.sh .env.local preview
#
# Values are read from the file and handed to `vercel env add` on stdin, so they
# never land in shell history, in the repo, or in a terminal transcript. An
# existing variable of the same name is removed first, so re-running the script
# updates rather than fails.
#
# Requires: `vercel login` and a linked project (`vercel link`).

set -euo pipefail

# This repo deploys from the Little Big Apps account, not the personal one a
# bare `vercel` happens to be logged into, so the CLI config directory is
# pinned. Override with VERCEL_CONFIG_DIR when acting as another account.
VERCEL_CONFIG_DIR="${VERCEL_CONFIG_DIR:-$HOME/.vercel-lbapps}"
vercel_cli() { vercel --global-config "$VERCEL_CONFIG_DIR" "$@"; }

FILE="${1:-.env.local}"
TARGET="${2:-production}"

if [[ ! -f "$FILE" ]]; then
  echo "No such env file: $FILE" >&2
  echo "Copy .env.example to .env.local and fill it in first." >&2
  exit 1
fi

if [[ ! -d .vercel ]]; then
  echo "This directory is not linked to a Vercel project. Run: vercel link" >&2
  exit 1
fi

# Client-side variables are baked into the bundle at build time, so a build that
# runs without them produces a broken app rather than a failing deploy.
REQUIRED=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  SUPABASE_SERVICE_ROLE_KEY
  APP_URL
  CRON_SECRET
  OPENROUTER_API_KEY
  WHATSAPP_APP_SECRET
  WHATSAPP_VERIFY_TOKEN
  RESEND_API_KEY
)

pushed=()

while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip comments and blanks.
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ "$line" =~ ^[[:space:]]*$ ]] && continue
  [[ "$line" != *=* ]] && continue

  name="${line%%=*}"
  value="${line#*=}"
  name="$(echo -n "$name" | tr -d '[:space:]')"

  # Strip one layer of surrounding quotes, if present.
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"

  if [[ -z "$value" ]]; then
    echo "skip   $name (empty)"
    continue
  fi

  vercel_cli env rm "$name" "$TARGET" --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | vercel_cli env add "$name" "$TARGET" >/dev/null
  echo "set    $name → $TARGET"
  pushed+=("$name")
done < "$FILE"

echo
missing=()
for name in "${REQUIRED[@]}"; do
  found=0
  for p in "${pushed[@]:-}"; do [[ "$p" == "$name" ]] && found=1; done
  [[ $found -eq 0 ]] && missing+=("$name")
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required variables — the deployment will not work without them:" >&2
  printf '  %s\n' "${missing[@]}" >&2
  exit 1
fi

echo "All required variables are set for $TARGET."
echo "Redeploy for them to take effect:"
echo "  vercel --global-config \"$VERCEL_CONFIG_DIR\" --prod"
