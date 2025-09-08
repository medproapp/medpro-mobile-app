# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MedPro Mobile App is a React Native/Expo healthcare application built with TypeScript. The app provides medical professionals with patient management, encounter tracking, internal messaging, and AI assistant capabilities with audio recording and transcription.

## Development Commands

### Core Development
```bash
# Start development server (primary command)
npm run start

# Platform-specific development
npm run android       # Android development
npm run ios          # iOS development (requires macOS)
npm run web          # Web development

# WSL-specific commands (for Windows developers)
npm run start-wsl    # WSL development with proper networking
npm run web-wsl      # Web development in WSL  
npm run start-tunnel # Tunnel for external access

# Cache management
npm run dev          # Clear cache and restart

# Code quality
npm run type-check   # TypeScript checking

# Development utilities
npm run status       # Check Expo server status
```

### Package Management
```bash
# Install new Expo-compatible packages (preferred)
npx expo install <package-name>

# Regular npm packages (verify Expo compatibility first)
npm install <package-name>
```

## Architecture Overview

### Directory Structure
- `src/components/` - Reusable UI components (Button, Card, Loading, etc.) with index exports
- `src/screens/` - Feature-organized screens (Auth, Dashboard, Patients, Messages, Assistant, More)
- `src/navigation/` - Navigation configuration with authentication flow and tab-based structure
- `src/services/` - API services (`api.ts`, `messagingService.ts`, `assistantApi.ts`)
- `src/store/` - Zustand state management with AsyncStorage persistence
- `src/types/` - TypeScript definitions for auth, messaging, navigation, assistant
- `src/theme/` - Design system (colors, typography, spacing)
- `src/assets/` - Static assets including MedPro logo

### State Management Architecture

**Zustand Stores with Persistence**:
- `authStore.ts` - JWT authentication, user session, organization context
- `messagingStore.ts` - Internal communication threads, messages, contacts, stats
- `assistantStore.ts` - AI conversations, patient/encounter context, audio transcription

**Key Features**:
- AsyncStorage persistence for offline capability
- Centralized error handling and loading states
- Context-aware AI assistant with patient and encounter information
- Thread-based internal messaging system

### Navigation Architecture

**Three-tier Navigation**:
- `RootNavigator` - Authentication gate (Auth vs Main app)
- `AuthNavigator` - Login and registration flow
- `MainNavigator` - Tab-based navigation with nested stacks

**Tab Structure**:
- Dashboard (appointments, stats, in-progress encounters)
- Patients (list, history, encounter details)
- Assistant (AI chat with audio recording and context awareness)
- Messages (internal communication threads)
- More (additional features and settings)

### API Integration Patterns

**Centralized API Service** (`src/services/api.ts`):
- Automatic JWT token injection via auth headers
- Hardcoded organization ID ('ORG-000006') - needs configuration
- Comprehensive error handling with 404-specific logic
- Support for file uploads (audio, images, documents)

**Specialized Services**:
- `messagingService.ts` - Internal communication APIs
- `assistantApi.ts` - AI assistant and audio transcription

**Request Patterns**:
- All API calls include `managingorg` and `practid` headers
- Custom error handling for patient history endpoints (404 returns empty arrays)
- File upload using XMLHttpRequest with progress tracking

## Key Configuration

### TypeScript Path Aliases
The project uses path aliases configured in `tsconfig.json`:
```typescript
"@/*": ["src/*"]
"@components/*": ["src/components/*"]
"@screens/*": ["src/screens/*"]
"@services/*": ["src/services/*"]
"@utils/*": ["src/utils/*"]
"@hooks/*": ["src/hooks/*"]
"@store/*": ["src/store/*"]
"@types/*": ["src/types/*"]
"@constants/*": ["src/constants/*"]
"@theme/*": ["src/theme/*"]
```

### Expo Configuration
Key features enabled in `app.json`:
- Audio recording permissions with Portuguese descriptions
- Image picker (camera and photos)
- Document picker with iCloud support
- New Architecture enabled for React Native
- Edge-to-edge rendering for Android

### Critical Configuration Issues
⚠️ **Production Readiness Concerns**:
- API_BASE_URL may be hardcoded in `src/services/api.ts`
- Login endpoint hardcoded in `src/store/authStore.ts:35`
- Organization ID 'ORG-000006' hardcoded throughout API calls
- Missing environment variable configuration system
- No token refresh mechanism implemented

## Key Features and Components

### Authentication System
- JWT token-based authentication with `authStore.ts`
- Persistent login state using AsyncStorage
- Automatic user info fetching after login (name, role, organization)
- Token refresh mechanism (TODO: implementation needed)

### Core Application Features
- **Patient Management**: Search, list, view patient history and encounters
- **Dashboard**: Appointments, revenue stats, satisfaction metrics, in-progress encounters
- **Internal Messaging**: Thread-based communication between healthcare professionals
- **AI Assistant**: Context-aware medical AI with audio recording and transcription
- **Encounter Management**: Clinical records, medications, diagnostics, attachments

### Media and File Handling
- Audio recording with `expo-audio` (medical encounter audio)
- Image capture/selection with `expo-image-picker`
- Document picker with `expo-document-picker`
- Progress-tracked file uploads to backend APIs
- Support for multiple file types (audio, images, PDFs)

### AI Assistant Capabilities
- Context-aware conversations with patient and encounter information
- Audio message transcription and processing
- Conversation session persistence
- Integration with backend AI services for medical assistance
- Support for action buttons and dynamic responses

## Development Guidelines

### Code Architecture Patterns
- TypeScript with strict mode enabled for type safety
- Functional React components with hooks
- Zustand for state management with middleware persistence
- React Navigation v7 for stack and tab navigation
- Component index exports for clean imports

### API Integration Standards
- Centralized API service in `api.ts` with automatic JWT header injection
- Specialized services for messaging and AI features
- Comprehensive error handling with user-friendly messages
- Request/response logging for development debugging
- Custom logic for handling 404s on patient history endpoints

### State Management Best Practices
- Zustand stores with AsyncStorage persistence for offline capability
- Separation of data, UI state, and actions
- Optimistic updates for better user experience
- Centralized error handling and loading states
- Context-aware state updates for AI assistant

### Code Quality Standards
- All components export through index.ts files
- Consistent TypeScript interface naming conventions
- Theme-aware styling using centralized design system
- Portuguese language strings for user-facing text
- Extensive console logging for development (needs production cleanup)

## Platform-Specific Development

### WSL Development (Windows)
Special scripts provided for WSL2 networking:
```bash
npm run start-wsl    # Auto-detects WSL IP addresses
npm run web-wsl      # Web development in WSL
npm run start-tunnel # Creates public tunnel URL
```

Key features:
- Automatic IP detection for Windows host and WSL
- Expo DevTools accessible from Windows browser
- Scripts handle WSL2 networking configuration
- See `start-wsl.sh` and `README-WSL.md` for details

### Mobile Device Testing
- Use Expo Go app for device testing
- QR code scanning for easy device connection  
- Hot reload works across all platforms
- Audio recording requires physical device (not simulator)

### Web Development
- Metro bundler accessible via localhost or WSL IP
- React DevTools available in browser
- File upload functionality may require device-specific testing

## Testing Strategy

Currently no test framework is configured. Recommended approach:
- **Framework**: Jest + React Native Testing Library
- **Priority Areas**: Authentication flow, patient data handling, messaging system
- **API Mocking**: Mock backend services for consistent testing
- **Audio Testing**: Test transcription and upload functionality
- **Navigation Testing**: Test tab and stack navigation flows

## Known Technical Debt and Limitations

### Type Safety Issues
- Extensive use of `any` types throughout codebase
- Missing TypeScript interfaces for API responses
- Incomplete type definitions for complex objects

### Performance Concerns
- Large patient lists may need virtualization
- Message threads could benefit from pagination optimization
- Image and audio uploads may block UI during processing

### Production Readiness Gaps
- No environment variable configuration system
- Token refresh mechanism not implemented
- Console logging throughout (needs production cleanup)
- Missing proper error boundary components
- No offline capability for core features

### Security Considerations
- Hardcoded organization IDs need configuration system
- API URLs should be environment-specific
- Sensitive data logging in development mode
- Missing input validation on forms