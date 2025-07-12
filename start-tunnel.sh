#!/bin/bash

echo "🚀 Iniciando MedPro App com Tunnel..."
echo ""

echo "🌐 O tunnel criará uma URL pública que funcionará em qualquer lugar!"
echo "   Aguarde alguns segundos para a URL aparecer..."
echo ""

# Matar processos anteriores
pkill -f "expo start" 2>/dev/null || true
sleep 2

# Iniciar com tunnel
npx expo start --web --tunnel