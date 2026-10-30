function parseMarkdownToBlocks(text) {
  if (!text) return [];
  const lines = String(text).split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i++;
      continue;
    }

    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push({ type: 'divider' });
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].replace(/\*\*/g, '').replace(/__/g, '').trim();
      blocks.push({ type: 'heading', level, text: headingText });
      i++;
      continue;
    }

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
        const headerCols = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map(c => c.trim());

        let dataStart = 1;
        if (tableLines[1].replace(/[\s\-|:]/g, '').length === 0) {
          dataStart = 2;
        }

        const dataRows = [];
        for (let r = dataStart; r < tableLines.length; r++) {
          const rawRow = tableLines[r].trim();
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

    blocks.push({ type: 'paragraph', text: line });
    i++;
  }

  return blocks;
}

const sample3 = `### Suggested Next Task for Your Mentee
| Field | Details |
|---|---|
| Task ID | \`t2-1\` (new sub-task under Milestone m4 - System Design) |
| Title | Complete Express REST Endpoints for Project & Milestone CRUD |
| Description | - Review the partially-implemented routes from task t2.
• Finish the remaining CRUD operations for Project and Milestone resources (Create, Read, Update, Delete).
• Add input validation (e.g., using Joi or express-validator).
• Write unit tests for each endpoint (using Jest or Mocha).
• Update the API documentation (Swagger/OpenAPI) to reflect the completed endpoints. |
| Priority | HIGH |
| Due Date | September 14 (aligns with the original due date of task t2) |`;

const blocks = parseMarkdownToBlocks(sample3);
console.log('Sample 3 blocks:', JSON.stringify(blocks, null, 2));
