# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL PRODUCTION RULES

**NEVER TOUCH PRODUCTION REPOS DIRECTLY!**
- Never modify files in production repositories
- Never edit files on production servers
- All changes must be made locally first
- Deploy through proper deployment processes only

## Project Overview

MedPro Mobile App is a React Native/Expo healthcare application built with TypeScript. The app provides medical professionals with patient management, encounter tracking, messaging, and AI assistant capabilities.

## Development Commands

### Core Development
```bash
# Start development server
npm run start

# Platform-specific development
npm run android       # Android development
npm run ios          # iOS development (requires macOS)
npm run web          # Web development

# WSL-specific commands (for Windows developers)
npm run start-wsl    # WSL development with proper networking
npm run web-wsl      # Web development in WSL

# Clear cache and restart
npm run dev

# Type checking
npm run type-check
```

### Package Management
```bash
# Install new Expo-compatible packages
npx expo install <package-name>

# Regular npm packages (verify Expo compatibility first)
npm install <package-name>
```

## Architecture Overview

### Directory Structure
- `src/components/` - Reusable UI components with index exports
- `src/screens/` - Screen components organized by feature
- `src/navigation/` - Navigation configuration (Stack, Tab, Auth)
- `src/services/` - API services and external integrations
- `src/store/` - Zustand state management stores
- `src/types/` - TypeScript type definitions
- `src/theme/` - Design system (colors, typography, spacing)

### Key Architectural Patterns

**State Management**: Zustand with AsyncStorage persistence
- `authStore.ts` - Authentication and user session
- `messagingStore.ts` - Message threads and contacts
- `assistantStore.ts` - AI assistant conversations

**Navigation Structure**:
- `RootNavigator` - Authentication routing
- `AuthNavigator` - Login/registration flow
- `MainNavigator` - Tab-based main app navigation

**API Integration**:
- Base API service in `src/services/api.ts`
- Specialized services for messaging and AI assistant
- Token-based authentication with automatic header injection

## Critical Configuration Issues

### Environment Configuration
⚠️ **CRITICAL**: The app currently uses hardcoded development URLs that must be replaced for production:
- `src/services/api.ts:14` - API_BASE_URL hardcoded to local IP
- `src/store/authStore.ts:35` - Login endpoint hardcoded
- Organization ID 'ORG-000006' hardcoded throughout API calls

### TypeScript Path Aliases
The project uses path aliases configured in `tsconfig.json`:
```typescript
"@/*": ["src/*"]
"@components/*": ["src/components/*"]
"@screens/*": ["src/screens/*"]
"@services/*": ["src/services/*"]
"@store/*": ["src/store/*"]
"@types/*": ["src/types/*"]
"@theme/*": ["src/theme/*"]
```

## Key Features and Components

### Authentication
- JWT token-based authentication
- Persistent login state with AsyncStorage
- Token refresh mechanism (TODO: implementation needed)

### Core Features
- **Patient Management**: Patient listing, history, encounter details
- **Messaging System**: Thread-based messaging with contacts
- **AI Assistant**: Medical AI with audio recording and context awareness
- **Encounter Management**: Media upload (audio, images, documents)

### Media Upload Capabilities
- Audio recording with `expo-audio`
- Image capture/selection with `expo-image-picker`
- Document picker with `expo-document-picker`
- File upload with progress tracking

## Development Guidelines

### Code Style
- TypeScript with strict mode enabled
- React functional components with hooks
- Zustand for state management
- React Navigation v7 for routing

### Component Structure
- All components have index.ts exports
- Consistent props interface naming (e.g., `ButtonProps`)
- Theme-aware styling using centralized theme system

### API Integration
- Centralized API service with automatic auth headers
- Consistent error handling patterns
- Request/response logging for debugging

### Critical Security Notes
- Never commit hardcoded API URLs or credentials
- Use environment variables for configuration
- Implement proper token refresh to prevent session expiration
- Organization ID should be configurable, not hardcoded

### Known Technical Debt
- Extensive use of `any` types (needs proper TypeScript interfaces)
- Console logging throughout (needs proper logging service)
- Missing test coverage
- Performance optimization needed for large lists

## Testing

Currently no test framework is configured. When implementing tests:
- Use Jest + React Native Testing Library
- Focus on critical user flows (login, patient data, messaging)
- Test API integration with proper mocking

## Platform-Specific Notes

### WSL Development
Use the provided WSL scripts for proper networking:
- Network configuration handles WSL2 IP addressing
- Scripts automatically detect and configure proper IP addresses
- Access from Windows browser using WSL IP (typically 192.168.249.x)

### Mobile Testing
- Use Expo Go app for device testing
- QR code scanning for easy device connection
- Hot reload works across all platforms

## Production Readiness Checklist

Before deploying:
1. Replace all hardcoded URLs with environment configuration
2. Implement configurable organization ID system
3. Complete token refresh mechanism
4. Remove console logging or implement proper logging levels
5. Add proper error handling for all API calls
6. Implement missing core features (user registration, new messages)
7. Add comprehensive TypeScript types
8. Security audit for sensitive data exposure