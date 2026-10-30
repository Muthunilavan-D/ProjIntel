import React from 'react';
import {
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Calendar,
  Flag,
  Zap,
  ArrowRight,
  ListOrdered,
  AlertCircle,
  Eye,
  CircleDot,
  CheckCircle2,
  ListChecks,
  Layers,
  ChevronRight,
  Code
} from 'lucide-react';

/**
 * Priority Badge Component
 */
const PriorityBadge = ({ priority }) => {
  const p = (priority || 'MEDIUM').toUpperCase().trim();
  let badgeClass = 'ai-badge-medium';
  
  if (p === 'HIGH' || p === 'CRITICAL' || p === 'URGENT') {
    badgeClass = 'ai-badge-high';
  } else if (p === 'LOW') {
    badgeClass = 'ai-badge-low';
  }

  return (
    <span className={`ai-badge ${badgeClass}`}>
      {p}
    </span>
  );
};

/**
 * Status Badge Component
 */
const StatusBadge = ({ status }) => {
  const s = (status || 'TODO').toUpperCase().trim();
  let badgeClass = 'ai-status-todo';
  let label = s.replace(/_/g, ' ');

  if (s === 'COMPLETED' || s === 'APPROVED' || s === 'DONE') {
    badgeClass = 'ai-status-completed';
  } else if (s === 'IN_PROGRESS' || s === 'ACTIVE') {
    badgeClass = 'ai-status-progress';
  } else if (s === 'OVERDUE' || s === 'REVISION_REQUIRED' || s === 'BLOCKED') {
    badgeClass = 'ai-status-overdue';
  }

  return (
    <span className={`ai-badge ${badgeClass}`}>
      {label}
    </span>
  );
};

/**
 * Parse and render inline elements: backticks `code`, bold **text**, and known badges
 */
const renderInlineMarkdown = (text) => {
  if (!text) return null;
  const str = String(text);

  // Tokens regex: `code`, **bold**, or standard words
  const parts = [];
  let remaining = str;
  let keyIdx = 0;

  // Pattern matches `code` or **bold** or __bold__
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|__[^\_]+__)/g;
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(str)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      const plain = str.substring(lastIndex, match.index);
      parts.push(<span key={`text-${keyIdx++}`}>{renderBadgesInText(plain, keyIdx)}</span>);
    }

    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      const codeContent = token.slice(1, -1);
      parts.push(
        <code key={`code-${keyIdx++}`} className="ai-inline-code">
          {codeContent}
        </code>
      );
    } else if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
      const boldContent = token.slice(2, -2);
      parts.push(
        <strong key={`bold-${keyIdx++}`} className="ai-bold-text">
          {renderInlineMarkdown(boldContent)}
        </strong>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < str.length) {
    const trailing = str.substring(lastIndex);
    parts.push(<span key={`text-${keyIdx++}`}>{renderBadgesInText(trailing, keyIdx)}</span>);
  }

  return parts.length > 0 ? parts : str;
};

/**
 * Replace keywords with visual badges if they match exact keywords
 */
function renderBadgesInText(text, baseKey = 0) {
  if (!text) return text;

  // Split by whitespace/punctuation boundaries
  const words = text.split(/(\s+|[,;()])/);
  return words.map((w, i) => {
    const trimmed = w.trim().toUpperCase();
    if (trimmed === 'HIGH' || trimmed === 'CRITICAL') {
      return <span key={`${baseKey}-badge-${i}`} className="ai-badge ai-badge-high">{w}</span>;
    }
    if (trimmed === 'MEDIUM') {
      return <span key={`${baseKey}-badge-${i}`} className="ai-badge ai-badge-medium">{w}</span>;
    }
    if (trimmed === 'LOW') {
      return <span key={`${baseKey}-badge-${i}`} className="ai-badge ai-badge-low">{w}</span>;
    }
    if (trimmed === 'COMPLETED' || trimmed === 'APPROVED') {
      return <span key={`${baseKey}-badge-${i}`} className="ai-badge ai-status-completed">{w}</span>;
    }
    if (trimmed === 'IN_PROGRESS') {
      return <span key={`${baseKey}-badge-${i}`} className="ai-badge ai-status-progress">IN PROGRESS</span>;
    }
    if (trimmed === 'TODO') {
      return <span key={`${baseKey}-badge-${i}`} className="ai-badge ai-status-todo">{w}</span>;
    }
    if (trimmed === 'OVERDUE') {
      return <span key={`${baseKey}-badge-${i}`} className="ai-badge ai-status-overdue">{w}</span>;
    }
    return w;
  });
}

function cleanDanglingTrailing(text) {
  if (!text) return '';
  let str = String(text).trim();
  // Strip trailing unclosed hyphens/slashes/connectors e.g. "intended AI-" -> "intended AI."
  if (/[-–—/]\s*$/.test(str)) {
    str = str.replace(/[-–—/]\s*$/, '').trim();
    if (str.length > 0 && !/[.!?]$/.test(str)) {
      str += '.';
    }
  }
  return str;
}

/**
 * Split cell content if it contains internal bullet points or linebreaks
 */
const renderCellContent = (content) => {
  if (!content) return <span className="text-muted">—</span>;
  const rawStr = cleanDanglingTrailing(String(content).replace(/<br\s*\/?>/gi, '\n'));
  const lines = rawStr.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length <= 1 && !rawStr.startsWith('•') && !rawStr.startsWith('-')) {
    return renderInlineMarkdown(rawStr);
  }

  return (
    <div className="ai-cell-multiline">
      {lines.map((line, idx) => {
        const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');
        const cleanLine = line.replace(/^[-*•]\s*/, '');
        return (
          <div key={idx} className={isBullet ? "ai-cell-bullet-row" : "ai-cell-text-row"}>
            {isBullet && <span className="ai-cell-bullet-dot">•</span>}
            <span>{renderInlineMarkdown(cleanLine)}</span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Render a Markdown Table as a native responsive HTML table or Property Grid
 */
const MarkdownTable = ({ headers, rows }) => {
  if (!headers || headers.length === 0 || !rows || rows.length === 0) {
    return null;
  }

  // Detect if this is a 2-column Key-Value / Property table (e.g. Field | Details)
  const isPropertyTable = headers.length === 2 && 
    (headers[0].toLowerCase().includes('field') || 
     headers[0].toLowerCase().includes('property') || 
     headers[0].toLowerCase().includes('parameter') || 
     headers[0].toLowerCase().includes('item') ||
     headers[0].toLowerCase().includes('key'));

  if (isPropertyTable) {
    return (
      <div className="ai-card ai-property-card">
        <div className="ai-property-grid">
          {rows.map((row, rIdx) => {
            const label = row[0] || `Property ${rIdx + 1}`;
            const value = row[1] || '';
            return (
              <div key={rIdx} className="ai-property-row">
                <div className="ai-property-label">
                  {renderInlineMarkdown(label)}
                </div>
                <div className="ai-property-value">
                  {renderCellContent(value)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Multi-column Data Table (e.g. Area | Suggested Technology | How it complements... | Typical integration point)
  return (
    <div className="ai-table-wrapper">
      <table className="ai-task-table ai-md-table">
        <thead>
          <tr>
            {headers.map((h, hIdx) => (
              <th key={hIdx}>
                {renderInlineMarkdown(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="ai-task-row">
              {headers.map((_, cIdx) => (
                <td key={cIdx}>
                  {renderCellContent(row[cIdx] || '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Parse raw markdown text into structured semantic blocks
 */
function parseMarkdownToBlocks(text) {
  if (!text) return [];
  const lines = String(text).split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // 1. Skip empty lines
    if (!line) {
      i++;
      continue;
    }

    // 2. Horizontal Divider (---, ***, ___)
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push({ type: 'divider' });
      i++;
      continue;
    }

    // 3. Headings (#, ##, ###, ####, #####)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].replace(/\*\*/g, '').replace(/__/g, '').trim();
      blocks.push({ type: 'heading', level, text: headingText });
      i++;
      continue;
    }

    // 4. Markdown Table detection (| col1 | col2 |)
    if (line.startsWith('|') && line.length > 1) {
      const tableLines = [];
      while (i < lines.length) {
        const curLine = lines[i].trim();
        if (!curLine) break; // empty line ends table
        if (curLine.startsWith('|')) {
          tableLines.push(curLine);
          i++;
        } else if (tableLines.length > 0 && !curLine.match(/^(#{1,6})\s+/) && !/^\d+\.\s+/.test(curLine)) {
          // Multi-line continuation inside cell (e.g. bullet points or text)
          tableLines[tableLines.length - 1] += '\n' + curLine;
          i++;
        } else {
          break;
        }
      }

      if (tableLines.length >= 2) {
        // Parse headers
        const headerCols = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map(c => c.trim());

        // Check if second line is divider (|---|---|)
        let dataStart = 1;
        if (tableLines[1].replace(/[\s\-|:]/g, '').length === 0) {
          dataStart = 2;
        }

        const dataRows = [];
        for (let r = dataStart; r < tableLines.length; r++) {
          const rawRow = tableLines[r].trim();
          // Strip leading and trailing pipe
          const cleanedRow = rawRow.replace(/^\|/, '').replace(/\|$/, '');
          const rowCols = cleanedRow
            .split('|')
            .map(c => c.trim());
          if (rowCols.some(c => c.length > 0)) {
            dataRows.push(rowCols);
          }
        }

        if (headerCols.length > 0 && dataRows.length > 0) {
          blocks.push({ type: 'table', headers: headerCols, rows: dataRows });
          continue;
        }
      }
    }

    // 5. Numbered Checklist / Steps (1. Item, 2. Item)
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s+/, '');
        items.push(itemText);
        i++;
      }
      blocks.push({ type: 'checklist', items });
      continue;
    }

    // 6. Bulleted List (- Item, * Item, • Item)
    if (/^[-*•]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^[-*•]\s+/, '');
        items.push(itemText);
        i++;
      }
      blocks.push({ type: 'bullet_list', items });
      continue;
    }

    // 7. Standard Paragraph
    blocks.push({ type: 'paragraph', text: line });
    i++;
  }

  return blocks;
}

/**
 * Universal Markdown Block Renderer
 */
const RenderMarkdownBlocks = ({ text }) => {
  const blocks = parseMarkdownToBlocks(text);

  if (blocks.length === 0) return null;

  return (
    <div className="ai-markdown-structured-content">
      {blocks.map((b, idx) => {
        if (b.type === 'divider') {
          return <div key={idx} className="ai-divider-line" />;
        }

        if (b.type === 'heading') {
          return (
            <div key={idx} className={`ai-block-heading-row level-${b.level}`}>
              <Sparkles size={15} className="ai-card-icon text-indigo" />
              <h4 className="ai-block-heading-text">{b.text}</h4>
            </div>
          );
        }

        if (b.type === 'table') {
          return (
            <div key={idx} className="ai-table-block-container">
              <MarkdownTable headers={b.headers} rows={b.rows} />
            </div>
          );
        }

        if (b.type === 'checklist') {
          return (
            <div key={idx} className="ai-card ai-checklist-card">
              <div className="ai-checklist-items">
                {b.items.map((item, itIdx) => (
                  <div key={itIdx} className="ai-checklist-row">
                    <span className="ai-step-badge">{itIdx + 1}</span>
                    <div className="ai-step-text">
                      {renderInlineMarkdown(item)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (b.type === 'bullet_list') {
          return (
            <div key={idx} className="ai-card ai-bullets-card">
              <ul className="ai-bullet-list">
                {b.items.map((item, itIdx) => (
                  <li key={itIdx} className="ai-bullet-item">
                    <span className="ai-bullet-indicator">•</span>
                    <span>{renderInlineMarkdown(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        if (b.type === 'paragraph') {
          return (
            <p key={idx} className="ai-plain-paragraph">
              {renderInlineMarkdown(b.text)}
            </p>
          );
        }

        return null;
      })}
    </div>
  );
};

/**
 * Risk Level Badge & Card
 */
const RiskSection = ({ risk }) => {
  if (!risk || (!risk.level && (!risk.reason || risk.reason.length === 0))) {
    return null;
  }

  const level = (risk.level || 'LOW').toUpperCase();
  let levelClass = 'ai-risk-low';
  let RiskIcon = ShieldCheck;

  if (level === 'HIGH' || level === 'CRITICAL') {
    levelClass = 'ai-risk-high';
    RiskIcon = ShieldAlert;
  } else if (level === 'MEDIUM' || level === 'MODERATE') {
    levelClass = 'ai-risk-medium';
    RiskIcon = AlertTriangle;
  }

  const reasons = Array.isArray(risk.reason) 
    ? risk.reason 
    : (risk.reason ? [String(risk.reason)] : []);

  return (
    <div className={`ai-card ai-risk-card ${levelClass}`}>
      <div className="ai-card-header">
        <div className="ai-card-title-group">
          <RiskIcon size={16} className="ai-card-icon" />
          <h4 className="ai-card-heading">Risk Assessment</h4>
        </div>
        <span className={`ai-risk-pill ${levelClass}`}>
          {level} RISK
        </span>
      </div>

      {reasons.length > 0 && (
        <ul className="ai-bullet-list">
          {reasons.map((r, i) => (
            <li key={i} className="ai-bullet-item">
              <span className="ai-bullet-indicator">•</span>
              <span>{renderInlineMarkdown(r)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Priority Tasks Table Component
 */
const PriorityTasksSection = ({ tasks }) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return null;
  }

  return (
    <div className="ai-card ai-tasks-card">
      <div className="ai-card-header">
        <div className="ai-card-title-group">
          <ListOrdered size={16} className="ai-card-icon text-indigo" />
          <h4 className="ai-card-heading">Priority Tasks & Next Actions</h4>
        </div>
        <span className="ai-count-pill">{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</span>
      </div>

      <div className="ai-table-wrapper">
        <table className="ai-task-table">
          <thead>
            <tr>
              <th style={{ width: '45px', textAlign: 'center' }}>#</th>
              <th>Task Details</th>
              <th style={{ width: '90px' }}>Priority</th>
              <th style={{ width: '100px' }}>Status</th>
              <th style={{ width: '105px' }}>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, idx) => (
              <tr key={idx} className="ai-task-row">
                <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                  {task.rank || idx + 1}
                </td>
                <td>
                  <div className="ai-task-info">
                    <div className="ai-task-title-row">
                      <span className="ai-task-title">{task.title}</span>
                      {task.task_id && (
                        <span className="ai-task-id-tag">{task.task_id}</span>
                      )}
                    </div>
                    {task.action && (
                      <div className="ai-task-action">
                        <span className="ai-label-inline">Action:</span> {renderInlineMarkdown(task.action)}
                      </div>
                    )}
                    {task.reason && (
                      <div className="ai-task-reason">
                        <span className="ai-label-inline">Reason:</span> {renderInlineMarkdown(task.reason)}
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <PriorityBadge priority={task.priority} />
                </td>
                <td>
                  <StatusBadge status={task.status} />
                </td>
                <td>
                  {task.due_date ? (
                    <span className="ai-date-text">
                      <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />
                      {task.due_date}
                    </span>
                  ) : (
                    <span className="ai-date-text text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Next Milestone Card Component
 */
const NextMilestoneSection = ({ milestone }) => {
  if (!milestone || (!milestone.title && !milestone.milestone_number)) {
    return null;
  }

  const progress = typeof milestone.progress === 'number' ? Math.min(100, Math.max(0, milestone.progress)) : 0;

  return (
    <div className="ai-card ai-milestone-card">
      <div className="ai-card-header">
        <div className="ai-card-title-group">
          <Flag size={16} className="ai-card-icon text-indigo" />
          <h4 className="ai-card-heading">
            Target Milestone {milestone.milestone_number ? `M${milestone.milestone_number}` : ''}
          </h4>
        </div>
        {milestone.status && (
          <StatusBadge status={milestone.status} />
        )}
      </div>

      <div className="ai-milestone-body">
        <div className="ai-milestone-title-row">
          <span className="ai-milestone-name">{milestone.title || 'Upcoming Milestone'}</span>
          {milestone.due_date && (
            <span className="ai-date-text">
              <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
              Due: {milestone.due_date}
            </span>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="ai-progress-section">
          <div className="ai-progress-header">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Progress Target</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>{progress}%</span>
          </div>
          <div className="ai-progress-track">
            <div 
              className="ai-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {milestone.focus && (
          <div className="ai-milestone-focus">
            <span className="ai-label-inline">Key Focus:</span> {renderInlineMarkdown(milestone.focus)}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Recommendations Card Component
 */
const RecommendationSection = ({ recommendation }) => {
  if (!recommendation || (!recommendation.immediate_action && !recommendation.next_step)) {
    return null;
  }

  return (
    <div className="ai-card ai-recommendation-card">
      <div className="ai-card-header">
        <div className="ai-card-title-group">
          <Zap size={16} className="ai-card-icon text-amber" />
          <h4 className="ai-card-heading">Strategic Recommendation</h4>
        </div>
      </div>

      <div className="ai-recommendation-body">
        {recommendation.immediate_action && (
          <div className="ai-action-box immediate">
            <div className="ai-action-label">
              <CircleDot size={13} className="text-indigo" />
              Immediate Action
            </div>
            <p className="ai-action-text">{renderInlineMarkdown(recommendation.immediate_action)}</p>
          </div>
        )}

        {recommendation.next_step && (
          <div className="ai-action-box next-step">
            <div className="ai-action-label">
              <ArrowRight size={13} className="text-muted" />
              Next Step
            </div>
            <p className="ai-action-text">{renderInlineMarkdown(recommendation.next_step)}</p>
          </div>
        )}

        {recommendation.reason && (
          <div className="ai-recommendation-reason">
            <span className="ai-label-inline">Rationale:</span> {renderInlineMarkdown(recommendation.reason)}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Observations & Context Section
 */
const ObservationSection = ({ observation }) => {
  if (!observation) return null;

  const keyPoints = Array.isArray(observation.key_points) ? observation.key_points : [];
  const blockers = Array.isArray(observation.blockers) ? observation.blockers : [];
  const statusOverview = observation.status_overview;

  if (keyPoints.length === 0 && blockers.length === 0 && !statusOverview) {
    return null;
  }

  return (
    <div className="ai-card ai-observation-card">
      <div className="ai-card-header">
        <div className="ai-card-title-group">
          <Eye size={16} className="ai-card-icon text-indigo" />
          <h4 className="ai-card-heading">Project Observations</h4>
        </div>
      </div>

      <div className="ai-card-body">
        {statusOverview && (
          <p className="ai-status-overview-text">{renderInlineMarkdown(statusOverview)}</p>
        )}

        {keyPoints.length > 0 && (
          <ul className="ai-bullet-list">
            {keyPoints.map((point, idx) => (
              <li key={idx} className="ai-bullet-item">
                <span className="ai-bullet-indicator">•</span>
                <span>{renderInlineMarkdown(point)}</span>
              </li>
            ))}
          </ul>
        )}

        {blockers.length > 0 && (
          <div className="ai-blockers-callout">
            <div className="ai-blockers-title">
              <AlertCircle size={14} /> Reported Blockers:
            </div>
            <ul className="ai-bullet-list">
              {blockers.map((b, idx) => (
                <li key={idx} className="ai-bullet-item">
                  <span className="ai-bullet-indicator text-danger">•</span>
                  <span>{renderInlineMarkdown(b)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Main AI Structured Response Component
 */
const AIStructuredResponse = ({ data, rawFallback }) => {
  let structured = null;

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    structured = data;
  } else if (typeof rawFallback === 'string') {
    try {
      const parsed = JSON.parse(rawFallback);
      if (parsed && typeof parsed === 'object') {
        structured = parsed;
      }
    } catch (e) {
      // String is not JSON, we will render via RenderMarkdownBlocks
    }
  }

  // If valid structured JSON object
  if (structured && (structured.title || structured.summary || structured.priority_tasks || structured.recommendation)) {
    const responseTypeLabel = (structured.response_type || 'project_insight')
      .replace(/_/g, ' ')
      .toUpperCase();

    return (
      <div className="ai-structured-response">
        {/* Header with Title and Response Type */}
        <div className="ai-response-main-header">
          <div className="ai-header-left">
            <div className="ai-icon-badge">
              <Sparkles size={16} />
            </div>
            <h3 className="ai-response-title">
              {structured.title || 'Project Intelligence Insight'}
            </h3>
          </div>
          <span className="ai-response-type-pill">
            {responseTypeLabel}
          </span>
        </div>

        {/* Summary Card */}
        {structured.summary && (
          <div className="ai-summary-card">
            <p className="ai-summary-text">{renderInlineMarkdown(structured.summary)}</p>
          </div>
        )}

        {/* Observations & Blocker Highlights */}
        {structured.observation && (
          <ObservationSection observation={structured.observation} />
        )}

        {/* Deterministic Risk Section */}
        {structured.risk && (
          <RiskSection risk={structured.risk} />
        )}

        {/* Priority Tasks Table */}
        {structured.priority_tasks && structured.priority_tasks.length > 0 && (
          <PriorityTasksSection tasks={structured.priority_tasks} />
        )}

        {/* Next Milestone Tracker */}
        {structured.next_milestone && (
          <NextMilestoneSection milestone={structured.next_milestone} />
        )}

        {/* Recommendations & Immediate Actions */}
        {structured.recommendation && (
          <RecommendationSection recommendation={structured.recommendation} />
        )}
      </div>
    );
  }

  // Fallback: Markdown and Text semantic block parser
  const textContent = typeof data === 'string' ? data : (rawFallback || '');
  return <RenderMarkdownBlocks text={textContent} />;
};

export default AIStructuredResponse;
