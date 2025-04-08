#!/usr/bin/env bash
set +e

echo "Uninstalling Helm releases..."
helm uninstall fluentd || true
helm uninstall influxdb || true
helm uninstall grafana || true

echo "Deleting Kubernetes resources for collector and player..."
kubectl delete deployment collector || true
kubectl delete svc collector || true
kubectl delete deployment player || true
kubectl delete svc player || true

echo "Deleting PVC for InfluxDB..."
kubectl delete pvc -l app=influxdb || true

echo "Deleting Minikube cluster..."
minikube delete

echo "Cleanup complete."
