const { callGroqChat } = require('./groqClient');

const SYSTEM_PROMPT = `You are the ProjIntel Academic Project Similarity & Redundancy Advisor for University Academic Projects.
Compare the student's proposed project proposal with existing institutional repository projects within the same department and cohort.
STRICT RULES:
- Do NOT make definitive plagiarism accusations. Wording MUST be advisory (e.g. "Advisory: Similar project concept detected", "Conceptually overlapping themes").
- Identify common concepts, technologies, domain objectives, and methodologies.
- Provide a percentage estimate (0-100%) of conceptual similarity for each candidate.
- Classify whether the project has excessive similarity (>= 40% is considered notable overlap requiring advisory warning, < 40% is considered safe and novel).
- Provide a clear, constructive advisory recommendation for the student team.`;

/**
 * Tokenize string removing punctuation and academic common stopwords
 */
function tokenize(text) {
  if (!text) return [];
  const stopwords = new Set([
    'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'as', 'is', 'are', 'was', 'were',
    'this', 'that', 'these', 'those', 'it', 'its', 'from', 'be', 'been', 'being', 'system', 'project', 'based', 'using',
    'approach', 'model', 'method', 'application', 'framework', 'development', 'design', 'implementation', 'web', 'app',
    'study', 'algorithm', 'via', 'through', 'based', 'automated', 'autonomous', 'real', 'time'
  ]);
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
}

/**
 * Calculate Jaccard similarity between two token arrays
 */
function calculateJaccard(tokensA, tokensB) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/**
 * Deterministic NLP similarity fallback
 */
function calculateDeterministicSimilarity(targetProject, candidateProjects = []) {
  const targetTitleTokens = tokenize(targetProject.title);
  const targetAbstractTokens = tokenize(targetProject.abstract || targetProject.description || targetProject.problemStatement);
  const targetTechTokens = tokenize(Array.isArray(targetProject.technologies) ? targetProject.technologies.join(' ') : targetProject.technologies);
  const targetAllTokens = [...targetTitleTokens, ...targetAbstractTokens];

  const comparisons = [];
  let maxSimilarityPct = 0;
  let mostSimilarProject = null;
  const globalCommonConcepts = new Set();

  for (const cand of candidateProjects) {
    const candTitleTokens = tokenize(cand.title);
    const candAbstractTokens = tokenize(cand.abstract || cand.description || cand.problemStatement);
    const candTechTokens = tokenize(Array.isArray(cand.technologies) ? cand.technologies.join(' ') : cand.technologies);
    const candAllTokens = [...candTitleTokens, ...candAbstractTokens];

    const titleSim = calculateJaccard(targetTitleTokens, candTitleTokens);
    const abstractSim = calculateJaccard(targetAbstractTokens, candAbstractTokens);
    const techSim = calculateJaccard(targetTechTokens, candTechTokens);
    const overallSim = calculateJaccard(targetAllTokens, candAllTokens);

    // Weighted similarity: Title has highest weight (50%), Abstract (35%), Tech (15%)
    let score = (titleSim * 0.50) + (abstractSim * 0.35) + (techSim * 0.15);
    // Boost if overall word overlap is significant
    if (overallSim > score) score = (score * 0.6) + (overallSim * 0.4);

    let similarityPct = Math.round(score * 100);
    // Exact or near-exact title match clamp
    if (targetProject.title && cand.title && targetProject.title.toLowerCase().trim() === cand.title.toLowerCase().trim()) {
      similarityPct = Math.max(similarityPct, 95);
    }

    // Identify shared keywords
    const shared = targetAllTokens.filter(t => candAllTokens.includes(t));
    const uniqueShared = Array.from(new Set(shared)).slice(0, 5);
    uniqueShared.forEach(c => globalCommonConcepts.add(c));

    let overlapSummary = 'Different focus and methodologies.';
    if (similarityPct >= 65) {
      overlapSummary = `High conceptual overlap in keywords: ${uniqueShared.join(', ') || 'shared themes'}.`;
    } else if (similarityPct >= 40) {
      overlapSummary = `Moderate topical overlap in: ${uniqueShared.join(', ') || 'related concepts'}.`;
    } else if (similarityPct > 15) {
      overlapSummary = `Minor keyword overlap in domain terminology (${uniqueShared.join(', ') || 'general terminology'}).`;
    }

    if (similarityPct > maxSimilarityPct) {
      maxSimilarityPct = similarityPct;
      mostSimilarProject = cand;
    }

    comparisons.push({
      projectId: cand.id || cand._id,
      title: cand.title,
      similarityPct,
      overlapSummary,
      commonConcepts: uniqueShared
    });
  }

  // Sort comparisons descending by similarity percentage
  comparisons.sort((a, b) => b.similarityPct - a.similarityPct);

  const hasSimilarProjects = maxSimilarityPct >= 40;
  const isSafe = !hasSimilarProjects;

  let recommendation = '';
  if (isSafe) {
    recommendation = `Safe Signal: No closely overlapping projects detected within your department and cohort. Your proposed project appears novel and distinct!`;
  } else if (maxSimilarityPct >= 70) {
    recommendation = `Advisory Warning: High similarity (${maxSimilarityPct}%) detected with "${mostSimilarProject?.title}". Please review the problem statement, unique innovations, or implementation methodologies to avoid conceptual duplication.`;
  } else {
    recommendation = `Advisory Note: Moderate similarity (${maxSimilarityPct}%) found with "${mostSimilarProject?.title}". Verify that your objectives and technical architecture contain distinct contributions.`;
  }

  return {
    success: true,
    isSafe,
    hasSimilarProjects,
    maxSimilarityPct,
    mostSimilarProjectId: mostSimilarProject?.id || mostSimilarProject?._id || null,
    mostSimilarProjectTitle: mostSimilarProject?.title || null,
    commonConcepts: Array.from(globalCommonConcepts).slice(0, 6),
    comparisons: comparisons.slice(0, 5),
    recommendation
  };
}

/**
 * Compare a project proposal with other projects in the repository.
 * Strictly within the same department and academic year/batch.
 */
async function analyzeProjectSimilarity(targetProject, allProjects = []) {
  if (!targetProject || !targetProject.title) {
    return {
      success: false,
      error: 'Project title and details are required for similarity evaluation.'
    };
  }

  const targetId = String(targetProject.id || targetProject._id || '');

  // Filter out the target project itself from comparisons
  const candidateProjects = allProjects
    .filter(p => {
      const pid = String(p.id || p._id || '');
      return !targetId || pid !== targetId;
    })
    .map(p => ({
      id: p.id || p._id,
      _id: p._id || p.id,
      title: p.title || '',
      domain: p.domain || '',
      dept: p.dept || (p.department?.name || ''),
      technologies: p.technologies || '',
      abstract: p.abstract || p.description || '',
      problemStatement: p.problemStatement || ''
    }));

  if (candidateProjects.length === 0) {
    return {
      success: true,
      isSafe: true,
      hasSimilarProjects: false,
      maxSimilarityPct: 0,
      mostSimilarProjectId: null,
      mostSimilarProjectTitle: null,
      commonConcepts: [],
      comparisons: [],
      recommendation: 'Safe Signal: No other registered projects found in your department and batch. Your project proposal is completely unique!'
    };
  }

  // Calculate deterministic baseline first (ensures immediate fallback reliability)
  const fallbackResult = calculateDeterministicSimilarity(targetProject, candidateProjects);

  try {
    const prompt = `Evaluate conceptual similarity between the TARGET PROJECT PROPOSAL and existing DEPARTMENT REPOSITORY PROJECTS:
TARGET PROPOSAL:
- Title: ${targetProject.title}
- Domain: ${targetProject.domain || 'Not specified'}
- Tech: ${Array.isArray(targetProject.technologies) ? targetProject.technologies.join(', ') : (targetProject.technologies || 'Not specified')}
- Problem Statement: ${targetProject.problemStatement || ''}
- Abstract / Description: ${targetProject.abstract || targetProject.description || ''}

CANDIDATE REPOSITORY PROJECTS IN SAME DEPARTMENT AND BATCH:
${JSON.stringify(candidateProjects.map(c => ({
  id: c.id,
  title: c.title,
  domain: c.domain,
  problemStatement: c.problemStatement,
  abstract: c.abstract
})), null, 2)}

Provide a JSON object with EXACTLY the following structure:
{
  "maxSimilarityPct": 65,
  "mostSimilarProjectId": "${candidateProjects[0]?.id || ''}",
  "mostSimilarProjectTitle": "${candidateProjects[0]?.title || ''}",
  "commonConcepts": [
    "Overlapping concept 1",
    "Overlapping concept 2"
  ],
  "comparisons": [
    {
      "projectId": "${candidateProjects[0]?.id || ''}",
      "title": "${candidateProjects[0]?.title || ''}",
      "similarityPct": 65,
      "overlapSummary": "Shares core vision tracking and alert framework.",
      "commonConcepts": ["vision", "telemetry"]
    }
  ],
  "recommendation": "Advisory feedback explaining whether the proposal is safe or needs differentiation."
}`;

    const aiResponse = await callGroqChat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ], { jsonMode: true, temperature: 0.1 });

    if (aiResponse && aiResponse.success && aiResponse.data) {
      const data = aiResponse.data;
      const maxPct = typeof data.maxSimilarityPct === 'number' 
        ? Math.min(100, Math.max(0, data.maxSimilarityPct)) 
        : fallbackResult.maxSimilarityPct;
      const hasSimilar = maxPct >= 40;

      return {
        success: true,
        isSafe: !hasSimilar,
        hasSimilarProjects: hasSimilar,
        maxSimilarityPct: maxPct,
        mostSimilarProjectId: data.mostSimilarProjectId || fallbackResult.mostSimilarProjectId,
        mostSimilarProjectTitle: data.mostSimilarProjectTitle || fallbackResult.mostSimilarProjectTitle,
        commonConcepts: Array.isArray(data.commonConcepts) && data.commonConcepts.length > 0 
          ? data.commonConcepts 
          : fallbackResult.commonConcepts,
        comparisons: Array.isArray(data.comparisons) && data.comparisons.length > 0
          ? data.comparisons
          : fallbackResult.comparisons,
        recommendation: data.recommendation || fallbackResult.recommendation
      };
    }
  } catch (err) {
    console.warn('Groq AI similarity call failed, using deterministic NLP engine:', err.message);
  }

  return fallbackResult;
}

module.exports = {
  analyzeProjectSimilarity,
  calculateDeterministicSimilarity
};
