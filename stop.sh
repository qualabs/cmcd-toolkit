#!/usr/bin/env bash
set -e

echo "Stopping Docker Compose services..."
docker-compose stop
# Alternatively, use 'docker-compose down' if you want to remove containers too,
# but 'stop' is closer to the original script's intent of just stopping.
# The README and cleanup.sh already cover 'docker-compose down'.

echo "Services stopped."
