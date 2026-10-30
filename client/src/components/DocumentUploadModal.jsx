import React, { useState, useRef } from 'react';
import ProjIntelSpinner from './ProjIntelSpinner';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle2, 
  FileCode, 
  Presentation, 
  FileArchive, 
  Layers, 
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { uploadProjectDocument } from '../services/documentService';

const DocumentUploadModal = ({ 
  isOpen, 
  onClose, 
  project, 
  user, 
  onUploadSuccess 
}) => {
  if (!isOpen) return null;

  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [docType, setDocType] = useState('SRS');
  const [version, setVersion] = useState('1.0');
  const [customTitle, setCustomTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (!customTitle) setCustomTitle(file.name);
      setError(null);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!customTitle) setCustomTitle(file.name);
      setError(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText size={28} color="#EF4444" />;
    if (['ppt', 'pptx'].includes(ext)) return <Presentation size={28} color="#F59E0B" />;
    if (['zip', 'rar', 'tar', 'gz'].includes(ext)) return <FileArchive size={28} color="#8B5CF6" />;
    if (['doc', 'docx'].includes(ext)) return <FileText size={28} color="#3B82F6" />;
    return <FileCode size={28} color="#10B981" />;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select or drop a file to upload.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const res = await uploadProjectDocument(selectedFile, {
        projectId: project?._id || project?.id,
        docType: docType,
        version: version.trim() || '1.0',
        uploaderName: user?.name || project?.leadName || 'Student Lead',
        uploaderId: user?._id || user?.id,
        uploaderModel: user?.role || 'Student'
      });

      if (res && res.success) {
        if (onUploadSuccess) {
          onUploadSuccess(res.data);
        }
        onClose();
      } else {
        setError(res?.error || 'Failed to upload document.');
      }
    } catch (err) {
      console.error('Upload submission error:', err);
      setError(err.message || 'An error occurred while uploading.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 15, 30, 0.78)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '20px'
      }}
    >
      <div 
        className="modal-container" 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card-bg, #131b2e)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '540px',
          color: 'var(--text-primary, #f8fafc)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          animation: 'fadeInScale 0.25s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818CF8'
            }}>
              <Upload size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                Upload Project Document
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', margin: 0 }}>
                {project?.title ? project.title.substring(0, 38) + '...' : 'Project Repository'}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              color: '#F87171',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? '#6366F1' : selectedFile ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
              background: isDragging 
                ? 'rgba(99, 102, 241, 0.1)' 
                : selectedFile 
                  ? 'rgba(16, 185, 129, 0.04)' 
                  : 'rgba(0, 0, 0, 0.2)',
              borderRadius: '14px',
              padding: selectedFile ? '18px' : '28px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '18px'
            }}
          >
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.tar,.gz,.png,.jpg,.jpeg"
            />

            {selectedFile ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {getFileIcon(selectedFile.name)}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#F8FAFC', wordBreak: 'break-all' }}>
                      {selectedFile.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 600, marginTop: '2px' }}>
                      {formatFileSize(selectedFile.size)} • Ready to upload
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    color: '#EF4444',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#818CF8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <Upload size={22} />
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '4px' }}>
                  Click to browse or drag & drop files here
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>
                  Supports PDF, DOCX, PPTX, ZIP, PNG, JPG (Max: 50MB)
                </div>
              </div>
            )}
          </div>

          {/* Metadata Row: Document Type & Version */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div className="form-group">
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Document Category *
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="aesthetic-input"
                style={{ width: '100%', padding: '9px 12px', fontSize: '0.85rem' }}
              >
                <option value="IEEE">IEEE Format Paper / Manuscript (.pdf)</option>
                <option value="Synopsis">Synopsis / Project Abstract</option>
                <option value="SRS">Software Requirements (SRS)</option>
                <option value="Design Document">System Architecture & Design</option>
                <option value="Source Code">Source Code Archive (.zip)</option>
                <option value="Test Report">Test Report & QA Results</option>
                <option value="Final Report">Final Project Report</option>
                <option value="Presentation">Review Presentation (.pptx)</option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Version Tag *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 1.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="aesthetic-input"
                style={{ width: '100%', padding: '9px 12px', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="button"
              className="btn-aesthetic btn-glass-secondary btn-sm"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-aesthetic btn-primary-glow btn-sm"
              disabled={isUploading || !selectedFile}
              style={{ minWidth: '130px' }}
            >
              {isUploading ? (
                <ProjIntelSpinner size="xs" inline label="Uploading..." />
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>Upload File</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DocumentUploadModal;
