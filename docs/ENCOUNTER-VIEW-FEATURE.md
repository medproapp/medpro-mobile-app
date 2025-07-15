# Encounter View Feature - "Abrir Encontro"

## Overview
Feature to view encounter details and add multimedia content (attachments, images, and audio recordings) directly from the mobile app. This replaces the previous "Continuar" (Continue) action with "Abrir" (Open) to better reflect the functionality.

## Related Documents
- [Mobile Development Tasks](./MOBILE-DEVELOPMENT-TASKS.md)
- [Mobile API Integration](./MOBILE-API-INTEGRATION.md)
- [Mobile Testing Procedures](./MOBILE-TESTING-PROCEDURES.md)

---

## 🎯 Feature Requirements

### User Story
As a healthcare practitioner, I want to open an encounter and add various types of media content (documents, images, and audio recordings) to enrich the patient's medical record from my mobile device.

### UI Changes
1. **Button Text Change**
   - From: "Continuar" → To: "Abrir"
   - Location: `EncounterListScreen.tsx`

2. **New Screen: EncounterViewScreen**
   - Display basic encounter information
   - Three main action buttons for media upload

---

## 📱 Screen Design

### EncounterViewScreen Layout

```
┌─────────────────────────────┐
│       Encounter View        │
│                             │
│ Patient: [Name]             │
│ Date: [Date/Time]           │
│ Status: [In Progress]       │
│                             │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │  📎 Adicionar Anexo   │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  📷 Adicionar Imagem  │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  🎤 Iniciar Gravação  │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

---

## 🔧 Technical Implementation

### 1. Navigation Updates

**File:** `src/types/navigation.ts`
```typescript
// Add to DashboardStackParamList
EncounterView: { 
  encounterId: string; 
  patientName: string;
  patientCpf: string;
};
```

### 2. Required Dependencies ✅ **INSTALLED**

```json
{
  "expo-document-picker": "^13.1.6",
  "expo-image-picker": "^16.1.4", 
  "expo-audio": "^0.4.8",
  "expo-file-system": "^18.1.11"
}
```

### 3. Permissions Required ✅ **CONFIGURED**

**app.json configuration:**
```json
{
  "expo": {
    "plugins": [
      [
        "expo-audio",
        {
          "microphonePermission": "Este aplicativo precisa acessar o microfone para gravar áudios dos encontros médicos."
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Este aplicativo precisa acessar suas fotos para anexar imagens aos encontros médicos.",
          "cameraPermission": "Este aplicativo precisa acessar a câmera para capturar imagens dos encontros médicos."
        }
      ],
      [
        "expo-document-picker",
        {
          "iCloudContainerEnvironment": "Production"
        }
      ]
    ]
  }
}
```

---

## 📡 API Integration Details

### 📎 Attachment Upload ✅ **IMPLEMENTED**

**Endpoint:** `POST /attach/upload`

**Request:**
```typescript
const formData = new FormData();
formData.append('file', {
  uri: filePath,
  type: fileType,
  name: fileName,
});

// Headers:
{
  'patient': patientCpf,
  'pract': practitionerId,
  'encid': encounterId,
  'entity': 'encounter',
  'organization': userOrganization
}
```

**Response:**
```json
{
  "message": "Attachment uploaded successfully",
  "attachmentId": "attach_12345"
}
```

### 📷 Image Upload ✅ **IMPLEMENTED**

**Endpoint:** `POST /images/upload`

**Request:**
```typescript
const formData = new FormData();
formData.append('image', {
  uri: imagePath,
  type: 'image/jpeg',
  name: fileName,
});

// Headers:
{
  'patient': patientCpf,
  'pract': practitionerId,
  'encid': encounterId,
  'entity': 'encounter',
  'organization': userOrganization
}
```

**Response:**
```json
{
  "message": "Image uploaded successfully",
  "imageId": "img_12345"
}
```

### 🎤 Audio Recording Upload ✅ **IMPLEMENTED**

**Endpoint:** `POST /audio/uploadAudio`

**Headers:**
```typescript
{
  'patient': patientCpf,
  'pract': practitionerId,
  'encid': encounterId,
  'sequence': recordingNumber.toString(),
  'subentitytype': 'none',
  'entity': 'encounter',
  'organization': userOrganization
}
```

**Request:**
```typescript
const formData = new FormData();
formData.append('audio', {
  uri: audioPath,
  type: 'audio/mp4',
  name: `recording_${Date.now()}.mp4`,
});
```

**Response:**
```json
{
  "message": "Audio uploaded successfully",
  "audioId": "audio_12345"
}
```

---

## 🚀 Implementation Steps ✅ **COMPLETED**

### Phase 1: Basic Screen Setup ✅ **COMPLETED**
- ✅ Create EncounterViewScreen component
- ✅ Update navigation types
- ✅ Change button text from "Continuar" to "Abrir"
- ✅ Implement navigation from EncounterListScreen

### Phase 2: Attachment Feature ✅ **COMPLETED**
- ✅ Install expo-document-picker
- ✅ Implement file selection UI (AttachmentPicker component)
- ✅ Create attachment upload API integration
- ✅ Add upload progress indicator
- ✅ Handle success/error states
- ✅ File type validation (PDF, DOC, DOCX, TXT, Images)
- ✅ File size validation (10MB limit)

### Phase 3: Image Feature ✅ **COMPLETED**
- ✅ Install expo-image-picker
- ✅ Implement camera/gallery selection (ImagePicker component)
- ✅ Create image upload API integration
- ✅ Add image preview before upload
- ✅ Handle compression for large images (5MB limit)
- ✅ Permission handling for camera and photo library

### Phase 4: Audio Recording Feature ✅ **COMPLETED**
- ✅ Install expo-audio
- ✅ Implement recording UI with timer (AudioRecorder component)
- ✅ Create audio upload API integration
- ✅ Add playback preview
- ✅ Handle recording permissions
- ✅ Fix expo-audio API compatibility issues

### Phase 5: Testing & Polish ✅ **COMPLETED**
- ✅ Test all upload scenarios
- ✅ Add proper error handling
- ✅ Implement retry logic for failed uploads
- ✅ Performance optimization
- ✅ User feedback and loading states

---

## 🎯 Success Criteria

### Functional Requirements
- ✅ User can navigate to encounter view screen
- ✅ User can select and upload documents
- ✅ User can capture/select and upload images
- ✅ User can record and upload audio
- ✅ All uploads show progress indication
- ✅ Failed uploads can be retried

### Non-Functional Requirements
- ✅ Upload progress visible to user
- ✅ Handles network interruptions gracefully
- ✅ Supports offline queueing
- ✅ File size limits enforced (10MB attachments, 5MB images, 10min audio)
- ✅ Proper permission handling

### Performance Targets
- Upload initiation: < 1 second
- Progress updates: Real-time
- Error feedback: Immediate
- Memory usage: < 100MB for uploads

---

## 🔍 Testing Scenarios

### Happy Path Tests
1. Upload small PDF document
2. Take photo and upload
3. Record 30-second audio and upload
4. Upload multiple files sequentially

### Edge Case Tests
1. Upload large file (10MB)
2. Lose network during upload
3. Background app during upload
4. Deny camera/microphone permissions
5. Storage full scenarios

### Error Scenarios
1. Server returns 500 error
2. Invalid file type
3. Expired authentication token
4. Organization ID mismatch

---

## 📈 Future Enhancements

1. **Batch Upload**
   - Select multiple files at once
   - Upload queue management

2. **AI Integration**
   - Auto-transcribe audio recordings
   - Image analysis for clinical insights

3. **Templates**
   - Quick photo categories (wound, rash, etc.)
   - Audio recording prompts

4. **Compression**
   - Automatic image optimization
   - Audio compression options

---

## 📋 Implementation Summary

### ✅ **FEATURE COMPLETED - January 15, 2025**

**Total Implementation Time:** ~1 day (completed ahead of schedule)

### 🛠️ **Components Created:**
1. **AudioRecorder.tsx** - Complete audio recording with permissions, playback preview, and upload
2. **AttachmentPicker.tsx** - File selection with validation, preview, and upload
3. **ImagePicker.tsx** - Camera/gallery integration with image preview and upload
4. **Updated EncounterViewScreen.tsx** - Integrated all three upload features

### 🔧 **API Methods Added:**
- `uploadAudioRecording()` - Audio file upload with progress tracking
- `uploadAttachment()` - Document/file upload with validation
- `uploadImage()` - Image upload with compression

### 📦 **Dependencies Integrated:**
- expo-audio (v0.4.8) - Audio recording and playback
- expo-document-picker (v13.1.6) - File selection
- expo-image-picker (v16.1.4) - Camera and photo library access
- expo-file-system (v18.1.11) - File handling utilities

### 🔑 **Key Achievements:**
- ✅ Fixed expo-audio API compatibility issues
- ✅ Implemented proper permission handling for all media types
- ✅ Added comprehensive error handling and user feedback
- ✅ Created reusable component architecture
- ✅ Integrated with existing API endpoints
- ✅ Added real-time upload progress tracking

**Total Estimated Effort:** ~~12-16 days (2-3 weeks)~~ → **1 day (completed)**