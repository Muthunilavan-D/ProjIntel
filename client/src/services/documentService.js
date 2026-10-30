/**
 * Document Repository & Upload Client Service
 * Handles multipart file uploads and document fetching with backend fallback.
 */

import { API_ORIGIN } from './api';

const API_BASE_URL = `${API_ORIGIN}/api/documents`;
const REVIEW_API_URL = `${API_ORIGIN}/api/reviews`;

/**
 * Upload an actual file to the project's document repository.
 */
export async function uploadProjectDocument(file, metadata = {}) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata.projectId) formData.append('projectId', metadata.projectId);
    if (metadata.docType) formData.append('docType', metadata.docType);
    if (metadata.version) formData.append('version', metadata.version);
    if (metadata.uploaderName) formData.append('uploaderName', metadata.uploaderName);
    if (metadata.uploaderId) formData.append('uploaderId', metadata.uploaderId);
    if (metadata.uploaderModel) formData.append('uploaderModel', metadata.uploaderModel);

    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Upload failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn('[DocumentService] Upload to backend failed, falling back to local object:', err.message);
    
    // Graceful offline fallback
    const mockDoc = {
      id: `doc-${Date.now()}`,
      _id: `doc-${Date.now()}`,
      fileName: file.name,
      originalName: file.name,
      docType: metadata.docType || 'Synopsis',
      documentType: file.name.split('.').pop().toUpperCase() || 'PDF',
      version: metadata.version || '1.0',
      uploadedBy: metadata.uploaderId || null,
      uploaderName: metadata.uploaderName || 'Student',
      uploadDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      fileSize: file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${(file.size / 1024).toFixed(1)} KB`,
      filePath: URL.createObjectURL(file),
      fileUrl: URL.createObjectURL(file)
    };

    return {
      success: true,
      message: `Document "${file.name}" uploaded locally (Offline mode).`,
      data: mockDoc,
      isOffline: true
    };
  }
}

/**
 * Fetch all documents associated with a project.
 */
export async function fetchProjectDocuments(projectId) {
  try {
    const res = await fetch(`${API_BASE_URL}/project/${projectId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[DocumentService] Failed to fetch documents from backend:', err.message);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Fetch all repository documents (for Guide & Admin overview).
 */
export async function fetchAllRepositoryDocuments() {
  try {
    const res = await fetch(`${API_BASE_URL}/all`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[DocumentService] Failed to fetch all documents:', err.message);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Delete a document by ID.
 */
export async function deleteProjectDocument(documentId) {
  try {
    const res = await fetch(`${API_BASE_URL}/${documentId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[DocumentService] Failed to delete document on backend:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Upload a real file deliverable (PPT, PDF, ZIP) for a specific review.
 */
export async function uploadReviewDeliverableFile(reviewId, file, metadata = {}) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata.projectId) formData.append('projectId', metadata.projectId);
    if (metadata.studentId) formData.append('studentId', metadata.studentId);
    if (metadata.documentType) formData.append('documentType', metadata.documentType);
    if (metadata.notes) formData.append('notes', metadata.notes);
    if (metadata.progressSummary) formData.append('progressSummary', metadata.progressSummary);
    if (metadata.presentationUrl) formData.append('presentationUrl', metadata.presentationUrl);
    if (metadata.demoUrl) formData.append('demoUrl', metadata.demoUrl);
    if (metadata.keyAchievements) {
      formData.append(
        'keyAchievements',
        typeof metadata.keyAchievements === 'string'
          ? metadata.keyAchievements
          : JSON.stringify(metadata.keyAchievements)
      );
    }
    if (metadata.roadblocks) formData.append('roadblocks', metadata.roadblocks);

    const res = await fetch(`${REVIEW_API_URL}/${reviewId}/upload-deliverable`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Review upload failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn('[DocumentService] Backend review deliverable upload failed, using fallback:', err.message);
    
    const mockSub = {
      id: `sub-${Date.now()}`,
      _id: `sub-${Date.now()}`,
      fileName: file.name,
      filePath: URL.createObjectURL(file),
      fileUrl: URL.createObjectURL(file),
      documentType: file.name.split('.').pop().toUpperCase() || 'PDF',
      fileSize: file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${(file.size / 1024).toFixed(1)} KB`,
      notes: metadata.notes || '',
      submissionTime: new Date().toISOString(),
      status: 'SUBMITTED'
    };

    return {
      success: true,
      message: `Review deliverable "${file.name}" uploaded locally.`,
      data: mockSub,
      isOffline: true
    };
  }
}
