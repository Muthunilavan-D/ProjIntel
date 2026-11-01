import React, { useEffect } from 'react';
import { X, Download, FileText, ExternalLink, AlertCircle, FileCheck } from 'lucide-react';
import { getFileUrl } from '../services/api';

/**
 * Resolves any relative or absolute file path to a fully accessible URL.
 */
export const resolveFileUrl = (filePath) => {
  if (!filePath) return '';
  if (filePath.startsWith('blob:') || filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('data:')) {
    return filePath;
  }
  return getFileUrl(filePath);
};

/**
 * Downloads a document directly in-page without navigating or opening a new browser tab.
 */
export const downloadFileDirectly = async (fileObj) => {
  if (!fileObj || !fileObj.filePath) return;
  const rawUrl = resolveFileUrl(fileObj.filePath);
  const fileName = fileObj.originalName || fileObj.fileName || 'document';

  try {
    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error('Fetch failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
  } catch (err) {
    // Fallback: standard link download attribute without target="_blank"
    const a = document.createElement('a');
    a.href = rawUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};

/**
 * In-App Modal Document Previewer
 * Eliminates all unwanted new-tab browser redirects.
 */
const DocumentPreviewModal = ({
  isOpen,
  onClose,
  document: doc,
  title = 'Document Preview'
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !doc) return null;

  const fileName = doc.originalName || doc.fileName || 'Document';
  const ext = String(fileName).split('.').pop()?.toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);
  const isDocx = ['doc', 'docx'].includes(ext);
  const fileUrl = resolveFileUrl(doc.filePath);

  return (
    <div
      className="ai-modal-overlay"
      style={{
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        className="ai-modal-box"
        style={{
          width: '100%',
          maxWidth: isPdf ? '900px' : isImage ? '720px' : '560px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card, #131722)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.18)',
                color: '#818CF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <FileCheck size={16} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  color: 'var(--text-main, #f8fafc)',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}
                title={fileName}
              >
                {fileName}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
                {title} • Format: <strong style={{ color: '#818CF8' }}>{ext?.toUpperCase() || 'FILE'}</strong>
                {doc.fileSize ? ` • ${doc.fileSize}` : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => downloadFileDirectly(doc)}
              className="btn-aesthetic btn-glass-secondary btn-sm"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', gap: '0.35rem' }}
              title="Download file directly to your computer"
            >
              <Download size={13} />
              <span>Download</span>
            </button>
            <button
              type="button"
              className="btn-ghost-icon"
              onClick={onClose}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Close preview"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body Preview Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isPdf ? '0' : '1.5rem',
            minHeight: isPdf ? '550px' : 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary, #0B0E14)'
          }}
        >
          {isPdf ? (
            <iframe
              src={`${fileUrl}#toolbar=1&navpanes=0`}
              title={fileName}
              style={{
                width: '100%',
                height: '580px',
                border: 'none',
                display: 'block'
              }}
            />
          ) : isImage ? (
            <div style={{ textAlign: 'center', maxWidth: '100%' }}>
              <img
                src={fileUrl}
                alt={fileName}
                style={{
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                  objectFit: 'contain'
                }}
              />
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem 1.5rem',
                maxWidth: '420px',
                margin: '0 auto'
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '12px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--primary, #6366F1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}
              >
                <FileText size={28} />
              </div>

              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main, #f8fafc)', marginBottom: '0.4rem' }}>
                {isDocx ? 'Microsoft Word Manuscript' : 'Attached Document File'}
              </h4>

              <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.825rem', lineHeight: '1.5', marginBottom: '1.25rem' }}>
                {isDocx
                  ? 'DOCX files cannot be previewed natively in-browser. Click the download button below to save and open in Microsoft Word or LibreOffice.'
                  : 'This file format is ready for local inspection. Click download below to save it directly.'}
              </p>

              <button
                type="button"
                onClick={() => downloadFileDirectly(doc)}
                className="btn-aesthetic btn-primary-glow btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.825rem',
                  margin: '0 auto'
                }}
              >
                <Download size={15} />
                <span>Download {fileName}</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
            fontSize: '0.75rem',
            color: 'var(--text-muted, #94a3b8)'
          }}
        >
          <span>Saved to secure institutional storage</span>
          <button
            type="button"
            className="btn-aesthetic btn-glass-secondary btn-sm"
            onClick={onClose}
            style={{ padding: '0.3rem 0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreviewModal;

