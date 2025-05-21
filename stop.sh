#!/usr/bin/env bash
set +e

echo "Stopping Tilt..."
cd tilt
tilt down || echo "Tilt is not running."

echo "Stopping Minikube..."
minikube stop

echo "Minikube stopped."
