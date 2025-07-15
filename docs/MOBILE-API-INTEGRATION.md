# Mobile API Integration

## Overview
Documentation for API integration patterns, configuration, and outstanding integration tasks in the mobile application.

## Related Documents
- [Mobile Development Tasks](./MOBILE-DEVELOPMENT-TASKS.md)
- [Encounters Alert Component](./ENCOUNTERS-ALERT-COMPONENT.md)
- [Mobile Testing Procedures](./MOBILE-TESTING-PROCEDURES.md)

---

## 🔧 CURRENT API ARCHITECTURE

### Base Configuration
**File:** `src/services/api.ts`

```typescript
// Current implementation with issues
const API_BASE_URL = 'https://your-ngrok-url.ngrok-free.app'; // 🚨 HARDCODED
const DEFAULT_ORG_ID = 'ORG-000006'; // 🚨 HARDCODED
```

### Authentication Flow
**File:** `src/store/authStore.ts`

#### Working Features:
- ✅ Login with email/password
- ✅ Token storage in AsyncStorage
- ✅ Authenticated request headers
- ✅ Basic logout functionality

#### Missing Features:
- ❌ Automatic token refresh (TODO at line 167)
- ❌ User registration API integration (TODO at line 127)
- ❌ Password reset functionality
- ❌ Social login (Google, Facebook)

---

## 🚨 CRITICAL API ISSUES TO FIX

### 1. Environment Configuration Missing
**Current Problem:**
```typescript
// src/services/api.ts:14
const API_BASE_URL = 'https://your-ngrok-url.ngrok-free.app';
```

**Required Solution:**
```typescript
// Environment-based configuration
const API_BASE_URL = __DEV__ 
  ? process.env.EXPO_PUBLIC_API_URL_DEV 
  : process.env.EXPO_PUBLIC_API_URL_PROD;

// Organization should be configurable
const getOrgId = () => {
  // Get from user settings or environment
  return userStore.organizationId || process.env.EXPO_PUBLIC_DEFAULT_ORG;
};
```

### 2. Hardcoded Organization ID
**Current Problem:** Organization ID `'ORG-000006'` appears in 20+ locations

**Files Affected:**
- `src/services/api.ts:119` - getInProgressEncounters
- `src/services/api.ts:134` - getMessages  
- `src/services/api.ts:159` - getPatients
- `src/services/api.ts:173` - getAppointments
- `src/services/api.ts:190` - sendMessage
- Plus 15+ more locations

**Required Solution:** Create centralized organization management

### 3. Token Refresh Not Implemented
**Current Problem:**
```typescript
// src/store/authStore.ts:167
// TODO: Implement token refresh logic
```

**Required Implementation:**
```typescript
const refreshToken = async () => {
  try {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    // Handle refresh logic
  } catch (error) {
    // Force logout on refresh failure
    logout();
  }
};
```

---

## 🔧 API ENDPOINTS STATUS

### ✅ Working Endpoints

#### Authentication
- `POST /login` - User login ✅
- Headers: Bearer token + organization ✅

#### Encounters
- `GET /encounter/getencounters/practitioner/{practId}` ✅
- Supports `in-progress` and `on-hold` filtering ✅

#### Basic Data Retrieval
- `GET /api/patients` ✅ (with hardcoded org)
- `GET /api/appointments` ✅ (with hardcoded org)
- `GET /api/messages` ✅ (with hardcoded org)

### ❌ Missing Endpoints

#### User Management
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Token refresh
- `POST /auth/forgot-password` - Password reset
- `POST /auth/verify-email` - Email verification

#### Patient Search
- `GET /api/patients/search?q={query}` - Patient search for communications

#### Enhanced Encounters
- `GET /api/encounters/{id}` - Individual encounter details
- `PUT /api/encounters/{id}` - Update encounter
- `POST /api/encounters` - Create new encounter

#### Messaging
- `POST /api/messages` - Send new message
- `GET /api/messages/conversations` - Message threads
- `PUT /api/messages/{id}/read` - Mark as read

#### File Management
- `POST /api/files/upload` - File upload
- `GET /api/files/{id}` - File download
- `DELETE /api/files/{id}` - File deletion

---

## 🎯 API INTEGRATION TASKS

### Immediate Tasks (Week 1)

#### 1. Environment Configuration Setup
**Files to Modify:**
- `src/services/api.ts`
- `src/store/authStore.ts`
- `.env` files creation

**Implementation:**
```typescript
// Create src/config/environment.ts
export const config = {
  apiUrl: __DEV__ 
    ? process.env.EXPO_PUBLIC_API_URL_DEV 
    : process.env.EXPO_PUBLIC_API_URL_PROD,
  defaultOrgId: process.env.EXPO_PUBLIC_DEFAULT_ORG,
  enableLogging: __DEV__
};
```

#### 2. Organization ID Centralization
**Create:** `src/store/organizationStore.ts`
**Modify:** All API calls to use dynamic organization

#### 3. Token Refresh Implementation
**File:** `src/store/authStore.ts`
**Add:** Automatic token refresh with 401 response handling

### Short Term Tasks (Weeks 2-3)

#### 4. Registration API Integration
**File:** `src/store/authStore.ts:127`
**Implementation:** Complete user registration flow

#### 5. Enhanced Error Handling
**Current Issue:**
```typescript
// src/services/api.ts:58-66
// Special handling for 404s that masks real errors
if (response.status === 404) {
  return { data: [], status: 404 };
}
```

**Better Solution:**
```typescript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  throw new APIError(response.status, errorData.message || 'Request failed');
}
```

#### 6. Patient Search Integration
**Add:** Real patient search for communication module

### Medium Term Tasks (Weeks 4-6)

#### 7. File Upload System
**Implementation:** Multi-part file upload with progress

#### 8. Real-time Features
**Add:** WebSocket integration for live updates

#### 9. Offline Support
**Add:** API caching and offline queue

---

## 🔍 API TESTING STRATEGY

### Current State
- ❌ No API tests found
- ❌ No mock server setup
- ❌ No integration tests

### Required Implementation

#### Unit Tests
```typescript
// tests/services/api.test.ts
describe('API Service', () => {
  test('should handle authentication correctly', () => {
    // Test auth flow
  });
  
  test('should refresh token on 401', () => {
    // Test token refresh
  });
});
```

#### Integration Tests
```typescript
// tests/integration/auth.test.ts
describe('Authentication Flow', () => {
  test('login -> API call -> token refresh', () => {
    // Full integration test
  });
});
```

#### Mock Server
```typescript
// tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

---

## 🎯 SUCCESS METRICS

### Security
- [ ] Zero hardcoded URLs or credentials
- [ ] Secure token storage and refresh
- [ ] Environment-based configuration

### Functionality
- [ ] All advertised features have working APIs
- [ ] Consistent error handling across all endpoints
- [ ] Offline capability for core features

### Performance
- [ ] API response caching implemented
- [ ] Request deduplication for identical calls
- [ ] Loading states for all API operations

### Testing
- [ ] 90%+ API service test coverage
- [ ] Integration tests for all user flows
- [ ] Mock server for development and testing

---

## 📤 FILE UPLOAD API INTEGRATION

### Overview
The mobile app needs to support three types of file uploads for the Encounter View feature: attachments (documents), images, and audio recordings. Each has specific requirements and endpoints.

### 📎 Attachment Upload API

**Endpoint:** `POST /attach/uploadToAzure`

**Implementation:**
```typescript
export async function uploadAttachment(
  file: DocumentPickerResponse,
  encounterId: string,
  patientCpf: string
): Promise<AttachmentResponse> {
  const formData = new FormData();
  
  formData.append('attach_file', {
    uri: file.uri,
    type: file.type || 'application/octet-stream',
    name: file.name || 'attachment',
  } as any);
  
  formData.append('attach_category', 'Documento');
  formData.append('attach_title', file.name || 'Anexo');
  formData.append('entity_type', 'encounter');
  formData.append('entity_id', encounterId);
  formData.append('patient_id', patientCpf);
  
  return await this.uploadWithProgress('/attach/uploadToAzure', formData);
}
```

### 📷 Image Upload API

**Endpoint:** `POST /images/upload/:encounterId`

**Implementation:**
```typescript
export async function uploadImage(
  image: ImagePickerResponse,
  encounterId: string,
  patientCpf: string,
  practitionerName: string
): Promise<ImageResponse> {
  const formData = new FormData();
  
  formData.append('img_file', {
    uri: image.assets[0].uri,
    type: image.assets[0].type || 'image/jpeg',
    name: image.assets[0].fileName || 'photo.jpg',
  } as any);
  
  formData.append('img_title', 'Imagem Clínica');
  formData.append('img_description', '');
  formData.append('img_category', 'Clinical');
  formData.append('img_author', practitionerName);
  formData.append('patientCpf', patientCpf);
  
  return await this.uploadWithProgress(`/images/upload/${encounterId}`, formData);
}
```

### 🎤 Audio Upload API

**Endpoint:** `POST /audio/uploadAudio`

**Implementation:**
```typescript
export async function uploadAudio(
  audioPath: string,
  encounterId: string,
  patientCpf: string,
  practitionerId: string,
  sequence: number
): Promise<AudioResponse> {
  const formData = new FormData();
  
  formData.append('audio', {
    uri: Platform.OS === 'ios' ? audioPath.replace('file://', '') : audioPath,
    type: 'audio/webm',
    name: `recording_${Date.now()}.webm`,
  } as any);
  
  const headers = {
    'patient': patientCpf,
    'pract': practitionerId,
    'encid': encounterId,
    'sequence': sequence.toString(),
    'subentitytype': 'none',
    'entity': 'encounter',
  };
  
  return await this.uploadWithProgress('/audio/uploadAudio', formData, headers);
}
```

### 📊 Upload Progress Helper

```typescript
private async uploadWithProgress(
  endpoint: string,
  formData: FormData,
  additionalHeaders?: Record<string, string>
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        this.onUploadProgress?.(percentComplete);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });
    
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    
    xhr.open('POST', `${API_BASE_URL}${endpoint}`);
    
    // Add auth headers
    const token = authStore.getState().token;
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('organization', DEFAULT_ORG_ID);
    
    // Add additional headers
    if (additionalHeaders) {
      Object.entries(additionalHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
    }
    
    xhr.send(formData);
  });
}
```

### 🔄 Related Endpoints

**List Files:**
- Attachments: `GET /attach/getbyencounter/:encounterId`
- Images: `GET /images/encounter/:encounterId/?patient={cpf}`
- Audio: `GET /recordings/patient/:patientCpf?page=1&limit=100`

**Download Files:**
- Attachments: `GET /attach/getfromazure/:fileName`
- Images: `GET /images/getfromazure/:fileName`
- Audio: `GET /audio/getfromazure/:fileName`

**Delete Files:**
- Attachments: `DELETE /attach/delete/:attachmentId`
- Images: `DELETE /images/:imageId`
- Audio: `DELETE /recordings/:recordingId`

### ⚠️ Important Considerations

1. **File Size Limits:**
   - Attachments: 10MB max
   - Images: 5MB max (implement compression)
   - Audio: 10 minutes max recording

2. **Network Handling:**
   - Implement retry logic for failed uploads
   - Queue uploads when offline
   - Show clear progress indicators

3. **Permissions:**
   - Request camera/gallery permissions for images
   - Request microphone permissions for audio
   - Handle permission denials gracefully

4. **Security:**
   - All uploads require JWT authentication
   - Organization ID must be included in headers
   - Validate file types before upload

---

## 📋 IMPLEMENTATION CHECKLIST

### Security Fixes (Critical)
- [ ] Replace hardcoded ngrok URLs
- [ ] Implement environment configuration
- [ ] Make organization ID configurable
- [ ] Add secure token refresh

### Missing APIs (High Priority)
- [ ] User registration endpoint
- [ ] Patient search for communications
- [ ] Enhanced encounter management
- [ ] File upload system

### Quality Improvements (Medium Priority)
- [ ] Consistent error handling
- [ ] API response caching
- [ ] Request/response logging
- [ ] Comprehensive test suite

### Advanced Features (Low Priority)
- [ ] Real-time WebSocket integration
- [ ] Offline support with sync
- [ ] API rate limiting handling
- [ ] Advanced authentication (social login, 2FA)

**Total Estimated Effort:** 80-120 hours for complete API integration overhaul