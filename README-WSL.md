# 🐧 MedPro App - Desenvolvimento no WSL

## 🚀 Como executar no WSL

### Opção 1: Script automatizado
```bash
npm run start-wsl
```

### Opção 2: Comando direto
```bash
npm run web-wsl
```

### Opção 3: Manual
```bash
EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 npx expo start --web --host lan
```

## 🌐 Acessando do Windows

Após executar um dos comandos acima, você verá algo como:

```
📱 IPs para acesso:
   Windows Host: http://192.168.240.1:8081
   WSL: http://192.168.249.179:8081
   Localhost: http://localhost:8081

🔧 Para acessar do Windows, use: http://192.168.249.179:8081
```

**Acesse do seu navegador Windows:** `http://192.168.249.179:8081`

## 🔧 Comandos úteis

```bash
# Verificar TypeScript
npm run type-check

# Limpar cache e reiniciar
npm run dev

# Para desenvolvimento mobile
npm run android  # Android
npm run ios      # iOS (requer macOS)

# Instalar nova dependência
npx expo install <package-name>
```

## 🐛 Troubleshooting

### 1. Erro "Cannot connect to Metro"
```bash
# Reiniciar com cache limpo
npm run dev
```

### 2. Não consegue acessar do Windows
```bash
# Verificar firewall do Windows
# Liberar porta 8081 para WSL
```

### 3. TypeScript errors
```bash
# Verificar erros
npm run type-check

# Reiniciar TypeScript no VS Code
Ctrl+Shift+P > "TypeScript: Restart TS Server"
```

## 📱 Testando no dispositivo móvel

1. Instale o app **Expo Go**
2. Conecte na mesma rede WiFi
3. Escaneie o QR code que aparece no terminal
4. Ou digite o IP manualmente: `exp://192.168.249.179:8081`

## 🔥 Hot Reload

O Hot Reload funciona automaticamente. Salve qualquer arquivo e veja as mudanças instantaneamente!

## 📊 Monitoramento

- **Metro Bundler:** http://192.168.249.179:8081
- **Expo DevTools:** Será aberto automaticamente
- **React DevTools:** Disponível no navegador