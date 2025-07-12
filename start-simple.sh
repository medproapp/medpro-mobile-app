#!/bin/bash

echo "🚀 Iniciando MedPro App..."
echo ""

# Matar processos anteriores
pkill -f "expo start" 2>/dev/null || true
sleep 2

echo "🌐 Opção 1: Tunnel (funciona sempre)"
echo "   Criará uma URL pública que você pode acessar de qualquer lugar"
echo ""

echo "🖥️ Opção 2: Localhost"
echo "   Acesse http://localhost:3001 no Windows"
echo ""

read -p "Escolha: (1) Tunnel ou (2) Localhost? [1/2]: " choice

case $choice in
    1)
        echo "🌐 Iniciando com tunnel..."
        npx expo start --web --tunnel
        ;;
    2)
        echo "🖥️ Iniciando localhost na porta 3001..."
        echo ""
        echo "📍 Acesse: http://localhost:3001"
        echo ""
        npx expo start --web --port 3001
        ;;
    *)
        echo "🌐 Usando tunnel por padrão..."
        npx expo start --web --tunnel
        ;;
esac