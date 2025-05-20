#!/usr/bin/env bash
set -e

echo "Starting Docker Compose services in detached mode..."
docker-compose up -d

echo "Services started. Grafana should be available at http://localhost:8081"
echo "Collector at http://localhost:3000"
echo "InfluxDB at http://localhost:8086"
