#!/usr/bin/env bash
set -e

echo "Starting Minikube..."
minikube start --memory=4096 --cpus=2

echo "Configuring Docker to use Minikube's daemon..."
eval $(minikube -p minikube docker-env)

echo "Starting Tilt (this will deploy the apps and helm charts)..."
cd ./tilt
tilt up --hud=false
