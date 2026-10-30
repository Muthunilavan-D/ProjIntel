const Groq = require('groq-sdk');

// Cache instance
let groqInstance = null;

function isGroqConfigured() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed === '' || trimmed === 'YOUR_GROQ_API_KEY_HERE' || trimmed === 'YOUR_API_KEY') {
    return false;
  }
  return true;
}

function getGroqClient() {
  if (!isGroqConfigured()) {
    return null;
  }
  if (!groqInstance) {
    groqInstance = new Groq({
      apiKey: process.env.GROQ_API_KEY.trim(),
    });
  }
  return groqInstance;
}

/**
 * Execute a chat completion call with Groq.
 * @param {Array<{role: string, content: string}>} messages 
 * @param {Object} options 
 * @returns {Promise<{success: boolean, content?: string, data?: any, error?: string, unconfigured?: boolean}>}
 */
async function callGroqChat(messages, options = {}) {
  if (!isGroqConfigured()) {
    return {
      success: false,
      unconfigured: true,
      error: 'AI service is not configured. Please configure the Groq API key.',
    };
  }

  const client = getGroqClient();
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  try {
    const completion = await client.chat.completions.create({
      model: model,
      messages: messages,
      temperature: options.temperature !== undefined ? options.temperature : 0.3,
      max_tokens: options.max_tokens || 3000,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    });

    const content = completion.choices?.[0]?.message?.content || '';

    if (options.jsonMode) {
      try {
        const parsed = JSON.parse(content);
        return { success: true, data: parsed, content };
      } catch (parseErr) {
        // Fallback if JSON parse fails: try extracting JSON block
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            return { success: true, data: parsed, content };
          } catch (e) {
            // Ignore and return raw
          }
        }
        return { success: true, data: null, content };
      }
    }

    return { success: true, content };
  } catch (err) {
    console.error('[AI Service Error]:', err.message || err);

    if (err.status === 401 || (err.message && err.message.includes('API key'))) {
      return {
        success: false,
        error: 'Invalid Groq API key. Please verify your environment configuration.',
      };
    }
    if (err.status === 429) {
      return {
        success: false,
        error: 'AI service rate limit reached. Please try again in a few seconds.',
      };
    }

    return {
      success: false,
      error: 'AI service is temporarily unavailable. Please try again.',
    };
  }
}

module.exports = {
  isGroqConfigured,
  getGroqClient,
  callGroqChat,
};
