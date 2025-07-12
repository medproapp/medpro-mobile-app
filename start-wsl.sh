#!/bin/bash

# Script para iniciar o Expo no WSL com acesso do Windows

echo "🚀 Iniciando MedPro App no WSL..."
echo ""

# Obter IPs
WINDOWS_IP=$(ip route show | grep default | awk '{print $3}')
WSL_IP=$(hostname -I | awk '{print $1}')

echo "📱 IPs para acesso:"
echo "   Windows Host: http://$WINDOWS_IP:3334"
echo "   WSL: http://$WSL_IP:3334"
echo "   Localhost (WSL): http://localhost:3334"
echo ""

echo "🔧 URLs para testar no Windows:"
echo "   1. http://$WSL_IP:3334"
echo "   2. http://$WINDOWS_IP:3334" 
echo "   3. http://127.0.0.1:3334"
echo ""

echo "💡 Se não funcionar, tente acessar via túnel..."
echo ""

# Matar processos anteriores
pkill -f "expo start" 2>/dev/null || true

# Aguardar um pouco
sleep 2

# Iniciar Expo com configurações específicas para WSL
export EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
export REACT_NATIVE_PACKAGER_HOSTNAME=$WSL_IP

npx expo start --web --port 3334 --clear