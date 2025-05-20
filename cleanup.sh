#!/usr/bin/env bash
set -e

echo "Stopping Docker Compose services and removing volumes..."
docker-compose down -v

echo "Cleanup complete. All services stopped and data volumes removed."
