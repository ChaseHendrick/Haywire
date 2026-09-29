#!/bin/zsh
cd "${0:A:h}" || exit 1
if command -v node >/dev/null 2>&1; then
  task_node=$(command -v node)
elif [[ -x /usr/local/bin/node ]]; then
  task_node=/usr/local/bin/node
elif [[ -x /opt/homebrew/bin/node ]]; then
  task_node=/opt/homebrew/bin/node
elif [[ -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
  task_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
else
  print 'Node.js is needed to run Haywire. Install Node.js 18 or newer, then open this launcher again.'
  read '?Press Enter to close.'
  exit 1
fi
if /usr/bin/curl -fsS 'http://127.0.0.1:4173' 2>/dev/null | /usr/bin/grep -q '<title>Haywire'; then
  open 'http://127.0.0.1:4173'
  exit 0
fi
"$task_node" server.js &
task_server_pid=$!
trap 'kill "$task_server_pid" 2>/dev/null' EXIT INT TERM
for task_attempt in {1..50}; do
  if /usr/bin/curl -fsS 'http://127.0.0.1:4173' >/dev/null 2>&1; then
    open 'http://127.0.0.1:4173'
    print 'Keep this window open while you play. Close it when you are done.'
    wait "$task_server_pid"
    exit $?
  fi
  if ! kill -0 "$task_server_pid" 2>/dev/null; then
    print 'Haywire could not start. Another app may be using port 4173.'
    read '?Press Enter to close.'
    exit 1
  fi
  sleep 0.1
done
print 'The local server did not become ready. Please try again.'
read '?Press Enter to close.'
