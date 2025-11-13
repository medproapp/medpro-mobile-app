import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';

// Constants
const CHUNK_SIZE_MB = 5; // 5MB chunks
const CHUNK_SIZE_BYTES = CHUNK_SIZE_MB * 1024 * 1024;
const MAX_CONCURRENT_UPLOADS = 2;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second
const STORAGE_KEY_PREFIX = 'chunked_recording_session_';

// Types
export interface ChunkedUploadOptions {
  audioPath: string;
  encounterId: string;
  patientCpf: string;
  practitionerId: string;
  sequence: number;
  onProgress?: (progress: UploadProgress) => void;
  onChunkProgress?: (chunkIndex: number, percent: number) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
}

export interface UploadProgress {
  chunksUploaded: number;
  totalChunks: number;
  percentComplete: number;
  currentChunk?: number;
  status: 'initializing' | 'uploading' | 'completing' | 'completed' | 'error';
  message?: string;
}

export interface ChunkInfo {
  index: number;
  start: number;
  end: number;
  size: number;
  uploaded: boolean;
  retries: number;
}

interface SessionState {
  sessionId: string;
  audioPath: string;
  encounterId: string;
  patientCpf: string;
  practitionerId: string;
  sequence: number;
  totalChunks: number;
  chunksUploaded: number;
  chunks: ChunkInfo[];
  createdAt: number;
}

/**
 * Service for handling chunked audio recording uploads
 * Provides resilient upload with retry logic, concurrent upload management,
 * and session persistence for crash recovery
 */
export class ChunkedRecordingService {
  private activeUploads: Set<number> = new Set();
  private uploadQueue: ChunkInfo[] = [];
  private currentSession: SessionState | null = null;
  private aborted: boolean = false;

  /**
   * Start a chunked upload for an audio recording
   * @param options Upload configuration
   * @returns Promise that resolves when upload is complete
   */
  async uploadRecording(options: ChunkedUploadOptions): Promise<{
    success: boolean;
    recordingId?: string;
    message?: string;
  }> {
    this.aborted = false;

    try {
      // Step 1: Get file info and calculate chunks
      options.onProgress?.({
        chunksUploaded: 0,
        totalChunks: 0,
        percentComplete: 0,
        status: 'initializing',
        message: 'Preparando upload...',
      });

      const fileInfo = await FileSystem.getInfoAsync(options.audioPath);

      if (!fileInfo.exists || !fileInfo.size) {
        throw new Error('Arquivo de áudio não encontrado ou vazio');
      }

      const fileSize = fileInfo.size;
      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE_BYTES);

      console.log('[ChunkedRecording] File info:', {
        size: fileSize,
        totalChunks,
        chunkSize: CHUNK_SIZE_MB + 'MB'
      });

      // Step 2: Create chunks metadata
      const chunks: ChunkInfo[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE_BYTES;
        const end = Math.min(start + CHUNK_SIZE_BYTES, fileSize);
        chunks.push({
          index: i,
          start,
          end,
          size: end - start,
          uploaded: false,
          retries: 0,
        });
      }

      // Step 3: Create upload session on backend
      options.onProgress?.({
        chunksUploaded: 0,
        totalChunks,
        percentComplete: 0,
        status: 'initializing',
        message: 'Criando sessão de upload...',
      });

      const sessionResponse = await apiService.createChunkedSession({
        encounterId: options.encounterId,
        patientCpf: options.patientCpf,
        practitionerId: options.practitionerId,
        sequence: options.sequence,
        chunkExpected: totalChunks,
        maxChunkDurationSeconds: 300, // 5 minutes max per chunk
      });

      const sessionId = sessionResponse.sessionId;

      // Step 4: Store session state
      this.currentSession = {
        sessionId,
        audioPath: options.audioPath,
        encounterId: options.encounterId,
        patientCpf: options.patientCpf,
        practitionerId: options.practitionerId,
        sequence: options.sequence,
        totalChunks,
        chunksUploaded: 0,
        chunks,
        createdAt: Date.now(),
      };

      await this.saveSessionState();

      // Step 5: Upload all chunks with concurrency control
      options.onProgress?.({
        chunksUploaded: 0,
        totalChunks,
        percentComplete: 0,
        status: 'uploading',
        message: `Enviando chunk 1 de ${totalChunks}...`,
      });

      this.uploadQueue = [...chunks];
      await this.processUploadQueue(options);

      if (this.aborted) {
        throw new Error('Upload cancelado pelo usuário');
      }

      // Step 6: Complete the session
      options.onProgress?.({
        chunksUploaded: totalChunks,
        totalChunks,
        percentComplete: 99,
        status: 'completing',
        message: 'Finalizando gravação...',
      });

      const completionResponse = await apiService.completeChunkedSession(sessionId);

      // Step 7: Clean up session state
      await this.clearSessionState();
      this.currentSession = null;

      options.onProgress?.({
        chunksUploaded: totalChunks,
        totalChunks,
        percentComplete: 100,
        status: 'completed',
        message: 'Upload concluído com sucesso!',
      });

      return {
        success: true,
        recordingId: completionResponse.recordingId,
        message: completionResponse.message || 'Gravação enviada com sucesso',
      };

    } catch (error: any) {
      console.error('[ChunkedRecording] Upload failed:', error);

      // Try to cancel the session on the backend
      if (this.currentSession?.sessionId) {
        try {
          await apiService.cancelChunkedSession(this.currentSession.sessionId);
        } catch (cancelError) {
          console.error('[ChunkedRecording] Failed to cancel session:', cancelError);
        }
        await this.clearSessionState();
      }

      this.currentSession = null;

      options.onProgress?.({
        chunksUploaded: 0,
        totalChunks: 0,
        percentComplete: 0,
        status: 'error',
        message: error.message || 'Erro ao enviar gravação',
      });

      throw error;
    }
  }

  /**
   * Process the upload queue with concurrency control and retry logic
   */
  private async processUploadQueue(options: ChunkedUploadOptions): Promise<void> {
    const uploadPromises: Promise<void>[] = [];

    while (this.uploadQueue.length > 0 || this.activeUploads.size > 0) {
      if (this.aborted) {
        throw new Error('Upload aborted');
      }

      // Start new uploads up to the concurrency limit
      while (
        this.uploadQueue.length > 0 &&
        this.activeUploads.size < MAX_CONCURRENT_UPLOADS
      ) {
        const chunk = this.uploadQueue.shift()!;
        this.activeUploads.add(chunk.index);

        const uploadPromise = this.uploadChunk(chunk, options)
          .then(() => {
            this.activeUploads.delete(chunk.index);
            chunk.uploaded = true;

            if (this.currentSession) {
              this.currentSession.chunksUploaded++;
              this.saveSessionState();
            }

            options.onChunkComplete?.(chunk.index, this.currentSession?.totalChunks || 0);
          })
          .catch((error) => {
            this.activeUploads.delete(chunk.index);

            // Retry logic
            if (chunk.retries < MAX_RETRIES) {
              chunk.retries++;
              console.log(`[ChunkedRecording] Retrying chunk ${chunk.index}, attempt ${chunk.retries}/${MAX_RETRIES}`);

              // Add back to queue with exponential backoff
              setTimeout(() => {
                if (!this.aborted) {
                  this.uploadQueue.push(chunk);
                }
              }, INITIAL_RETRY_DELAY_MS * Math.pow(2, chunk.retries - 1));
            } else {
              console.error(`[ChunkedRecording] Chunk ${chunk.index} failed after ${MAX_RETRIES} retries:`, error);
              throw new Error(`Falha ao enviar chunk ${chunk.index + 1}: ${error.message}`);
            }
          });

        uploadPromises.push(uploadPromise);
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);
  }

  /**
   * Upload a single chunk
   */
  private async uploadChunk(chunk: ChunkInfo, options: ChunkedUploadOptions): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const { sessionId, audioPath } = this.currentSession;

    console.log('[ChunkedRecording] Uploading chunk:', {
      index: chunk.index,
      start: chunk.start,
      end: chunk.end,
      size: chunk.size,
    });

    // Read the chunk from the file
    const chunkData = await FileSystem.readAsStringAsync(audioPath, {
      encoding: FileSystem.EncodingType.Base64,
      position: chunk.start,
      length: chunk.size,
    });

    // Convert base64 to blob
    const blob = this.base64ToBlob(chunkData, 'audio/mp4');

    // Create FormData for the chunk
    const formData = new FormData();
    formData.append('chunk', blob as any, `chunk_${chunk.index}.mp4`);

    // Upload the chunk
    await apiService.uploadChunk(
      sessionId,
      formData,
      chunk.index,
      (percent) => {
        options.onChunkProgress?.(chunk.index, percent);

        // Update overall progress
        if (this.currentSession) {
          const totalProgress =
            ((this.currentSession.chunksUploaded + (percent / 100)) / this.currentSession.totalChunks) * 100;

          options.onProgress?.({
            chunksUploaded: this.currentSession.chunksUploaded,
            totalChunks: this.currentSession.totalChunks,
            percentComplete: Math.floor(totalProgress),
            currentChunk: chunk.index + 1,
            status: 'uploading',
            message: `Enviando chunk ${chunk.index + 1} de ${this.currentSession.totalChunks}... ${Math.floor(percent)}%`,
          });
        }
      }
    );

    console.log('[ChunkedRecording] Chunk uploaded successfully:', chunk.index);
  }

  /**
   * Convert base64 string to Blob
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * Abort the current upload
   */
  async abortUpload(): Promise<void> {
    console.log('[ChunkedRecording] Aborting upload...');
    this.aborted = true;

    if (this.currentSession?.sessionId) {
      try {
        await apiService.cancelChunkedSession(this.currentSession.sessionId);
      } catch (error) {
        console.error('[ChunkedRecording] Error canceling session:', error);
      }

      await this.clearSessionState();
      this.currentSession = null;
    }

    this.uploadQueue = [];
    this.activeUploads.clear();
  }

  /**
   * Save session state to AsyncStorage for crash recovery
   */
  private async saveSessionState(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const key = STORAGE_KEY_PREFIX + this.currentSession.sessionId;
      await AsyncStorage.setItem(key, JSON.stringify(this.currentSession));
    } catch (error) {
      console.error('[ChunkedRecording] Error saving session state:', error);
    }
  }

  /**
   * Clear session state from AsyncStorage
   */
  private async clearSessionState(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const key = STORAGE_KEY_PREFIX + this.currentSession.sessionId;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('[ChunkedRecording] Error clearing session state:', error);
    }
  }

  /**
   * Resume an interrupted upload session (future enhancement)
   */
  async resumeSession(sessionId: string): Promise<void> {
    // TODO: Implement session recovery
    console.log('[ChunkedRecording] Session resume not yet implemented');
  }
}

// Export singleton instance
export const chunkedRecordingService = new ChunkedRecordingService();
