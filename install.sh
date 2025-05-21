#!/usr/bin/env bash
set -e

check_installed() {
  command -v "$1" >/dev/null 2>&1 && echo "$1 is installed." || return 1
}

install_minikube() {
  echo "Installing Minikube..."
  curl -Lo minikube.deb https://storage.googleapis.com/minikube/releases/latest/minikube_latest_amd64.deb
  sudo dpkg -i minikube.deb
  rm minikube.deb
}

install_kubectl() {
  echo "Installing kubectl..."
  sudo apt-get install -y curl apt-transport-https
  sudo curl -fsSLo /usr/share/keyrings/kubernetes-archive-keyring.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg
  echo "deb https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list
  sudo apt-get update
  sudo apt-get install -y kubectl
}

install_helm() {
  echo "Installing Helm..."
  curl -fsSL https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3 | bash
}

install_tilt() {
  echo "Installing Tilt..."
  curl -fsSL https://raw.githubusercontent.com/tilt-dev/tilt/master/scripts/install.sh | bash
}

OS="$(uname -s)"
echo "Detected OS: $OS"

if [[ "$OS" == "Linux" ]]; then
  echo "Checking dependencies on Linux..."
  check_installed minikube || install_minikube
  check_installed kubectl || install_kubectl
  check_installed helm || install_helm
  check_installed tilt || install_tilt
elif [[ "$OS" =~ "MINGW" || "$OS" =~ "MSYS" || "$OS" =~ "CYGWIN" ]]; then
  echo "On Windows, please ensure Chocolatey is installed."
  check_installed minikube || choco install -y minikube
  check_installed kubectl || choco install -y kubernetes-cli
  check_installed helm || choco install -y helm
  check_installed tilt || choco install -y tilt
else
  echo "Unsupported OS. Install dependencies manually."
  exit 1
fi

echo "Installed versions:"
minikube version || echo "Minikube not found!"
kubectl version --client || echo "kubectl not found!"
helm version || echo "Helm not found!"
tilt version || echo "Tilt not found!"
