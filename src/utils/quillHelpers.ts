/**
 * Utility functions for working with Quill editor notes format
 * Quill uses a Delta format: { "ops": [{ "insert": "text\n" }] }
 */

interface QuillOp {
  insert: string;
  attributes?: any;
}

interface QuillDelta {
  ops: QuillOp[];
}

/**
 * Appends text to an existing Quill note
 * Handles different input formats (string, object, null)
 * Adds timestamp separator before the new text
 *
 * @param existingNote - The current note (can be string, Quill object, or null)
 * @param textToAppend - The new text to append
 * @returns JSON stringified Quill Delta with appended text
 */
export function appendToQuillNotes(existingNote: any, textToAppend: string): string {
  let quillDelta: QuillDelta = { ops: [] };

  // Parse existing note if it exists
  if (existingNote) {
    if (typeof existingNote === 'string') {
      try {
        const parsed = JSON.parse(existingNote);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.ops)) {
          quillDelta = parsed;
        } else {
          // If parse succeeded but not valid Quill format, treat as plain text
          quillDelta = { ops: [{ insert: existingNote + '\n' }] };
        }
      } catch (e) {
        // If parse fails, treat as plain text
        quillDelta = { ops: [{ insert: existingNote + '\n' }] };
      }
    } else if (typeof existingNote === 'object' && Array.isArray(existingNote.ops)) {
      quillDelta = existingNote;
    } else {
      // Unexpected format, convert to string and treat as plain text
      quillDelta = { ops: [{ insert: String(existingNote) + '\n' }] };
    }
  }

  // Ensure ops array exists and is valid
  if (!quillDelta.ops || !Array.isArray(quillDelta.ops)) {
    quillDelta.ops = [];
  }

  // Check if existing note has actual content (not just empty or whitespace)
  const hasExistingContent = quillDelta.ops.some(op => {
    const text = op.insert || '';
    return text.trim().length > 0;
  });

  // Create timestamp in Brazilian format
  const now = new Date();
  const timestamp = now.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Build the text to append with timestamp
  let newContent: string;
  if (hasExistingContent) {
    // Appending to existing content - add separator
    newContent = `\n--- ${timestamp} ---\n${textToAppend}\n`;
  } else {
    // First note - no separator needed, start fresh
    quillDelta.ops = []; // Clear any empty ops
    newContent = `--- ${timestamp} ---\n${textToAppend}\n`;
  }

  // Append new operations to the ops array
  quillDelta.ops.push({
    insert: newContent,
  });

  // Return JSON stringified result
  return JSON.stringify(quillDelta);
}

/**
 * Converts a Quill Delta to plain text
 * Useful for displaying notes in read-only mode
 *
 * @param quillNote - The Quill note (string or object)
 * @returns Plain text representation
 */
export function quillToPlainText(quillNote: any): string {
  if (!quillNote) {
    return '';
  }

  let quillDelta: QuillDelta;

  // Parse if string
  if (typeof quillNote === 'string') {
    try {
      quillDelta = JSON.parse(quillNote);
    } catch (e) {
      // If parsing fails, return as-is
      return quillNote;
    }
  } else if (typeof quillNote === 'object' && Array.isArray(quillNote.ops)) {
    quillDelta = quillNote;
  } else {
    return String(quillNote);
  }

  // Extract text from ops array
  if (!quillDelta.ops || !Array.isArray(quillDelta.ops)) {
    return '';
  }

  return quillDelta.ops
    .map(op => op.insert || '')
    .join('');
}

/**
 * Validates if a note is in valid Quill format
 *
 * @param note - The note to validate
 * @returns true if valid Quill format
 */
export function isValidQuillFormat(note: any): boolean {
  if (!note) {
    return false;
  }

  let parsed = note;

  if (typeof note === 'string') {
    try {
      parsed = JSON.parse(note);
    } catch (e) {
      return false;
    }
  }

  return (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray(parsed.ops) &&
    parsed.ops.every((op: any) => typeof op.insert === 'string')
  );
}
