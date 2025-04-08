#!/usr/bin/env bash
set +e

echo "Stopping Tilt..."
tilt down || echo "Tilt is not running."

echo "Stopping Minikube..."
minikube stop

echo "Minikube stopped."
