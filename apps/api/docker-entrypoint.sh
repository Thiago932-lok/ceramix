#!/bin/sh
set -eu

node src/db/migrate.js

if [ "${SEED_ON_START:-false}" = "true" ]; then
  node src/db/seed.js
fi

exec node src/index.js
