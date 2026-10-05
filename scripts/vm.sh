#!/usr/bin/env bash
# Runs PowerShell inside the OwlCept Windows dev VM through UTM's guest agent
# and prints the output. Usage:
#   scripts/vm.sh 'Get-Service sshd'
#   scripts/vm.sh < some-script.ps1
#   OWLCEPT_VM_TIMEOUT=900 scripts/vm.sh 'long command'
# Commands run as SYSTEM inside the guest.
set -euo pipefail

U=/Applications/UTM.app/Contents/MacOS/utmctl
VM=${OWLCEPT_VM:-Windows}
TIMEOUT=${OWLCEPT_VM_TIMEOUT:-300}
DIR='C:\ProgramData\owlcept-dev'
id="$(date +%s)$RANDOM"
script="$DIR\\run-$id.ps1"
out="$DIR\\run-$id.out"
done_marker="$DIR\\run-$id.done"

if [ $# -gt 0 ]; then body="$*"; else body="$(cat)"; fi

# The working folder must exist before the first push.
"$U" exec "$VM" --cmd cmd.exe /c "if not exist $DIR mkdir $DIR" >/dev/null
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if printf '' | "$U" file push "$VM" "$DIR\\.probe" >/dev/null 2>&1; then break; fi
  sleep 1
done

{
  printf '%s\n' "\$ErrorActionPreference = 'Continue'"
  printf '%s\n' "\$ProgressPreference = 'SilentlyContinue'"
  printf '%s\n' "& {"
  printf '%s\n' "$body"
  printf '%s\n' "} *>&1 | Out-File -FilePath '$out' -Encoding utf8 -Width 400"
  printf '%s\n' "Set-Content -Path '$done_marker' -Value 'done'"
} | "$U" file push "$VM" "$script"

"$U" exec "$VM" --cmd powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$script" >/dev/null

waited=0
until "$U" file pull "$VM" "$done_marker" >/dev/null 2>&1; do
  sleep 2
  waited=$((waited + 2))
  if [ "$waited" -ge "$TIMEOUT" ]; then
    echo "[vm.sh] still running after ${TIMEOUT}s; partial output:" >&2
    break
  fi
done

"$U" file pull "$VM" "$out" 2>/dev/null | sed '1s/^\xEF\xBB\xBF//' || true
"$U" exec "$VM" --cmd cmd.exe /c "del /q $script $done_marker $out" >/dev/null 2>&1 || true
