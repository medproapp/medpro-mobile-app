#!/bin/bash

echo "🚀 Configurando MedPro App para WSL2..."
echo ""

# Matar processos anteriores
pkill -f "expo start" 2>/dev/null || true
sleep 2

echo "🔧 Configurando rede para acesso do Windows..."

# Obter IP do WSL
WSL_IP=$(hostname -I | awk '{print $1}')
echo "   WSL IP: $WSL_IP"

# Configurar variáveis de ambiente para funcionar no WSL2
export EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
export REACT_NATIVE_PACKAGER_HOSTNAME=$WSL_IP

echo ""
echo "📱 URLs para acesso:"
echo "   Windows: http://localhost:3334"
echo "   WSL: http://$WSL_IP:3334"
echo ""

echo "💡 Se localhost não funcionar, execute no PowerShell como Admin:"
echo '   netsh interface portproxy add v4tov4 listenport=3334 listenaddress=0.0.0.0 connectport=3334 connectaddress='$WSL_IP
echo ""

echo "🚀 Iniciando Expo na porta 3334..."
echo ""

# Iniciar Expo na porta 3001
npx expo start --web --port 3334