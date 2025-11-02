import { Ollama } from 'ollama';
import fs from 'fs';

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

export async function analyzeImage(imagePath) {
  try {
    // Read image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const prompt = `Analyze this portrait photo for content categorization.

CLOTHING: What is the person wearing? State explicitly: fully clothed, lingerie, bikini, underwear, topless, or nude.

SETTING: Where was this taken? (bedroom, bathroom, outdoor, studio, kitchen, etc.)

POSE: How is the person positioned? (standing, sitting, lying down, kneeling, etc.)

MOOD: What's the atmosphere? (professional, casual, playful, sultry, intimate, etc.)

CONTENT RATING:
- PG: Fully clothed, no suggestive content
- R: Revealing clothing, partial nudity (topless/lingerie), or suggestive poses
- X-Rated: Full nudity or highly explicit content

Provide clear, single-word or short-phrase tags for each category.`;

    const response = await ollama.chat({
      model: 'llava:34b',
      messages: [{
        role: 'user',
        content: prompt,
        images: [base64Image]
      }]
    });

    return parseAIResponse(response.message.content);
  } catch (error) {
    console.error('AI analysis error:', error);
    throw error;
  }
}

function parseAIResponse(aiText) {
  const tags = [];
  const lines = aiText.toLowerCase().split('\n');
  let hasRating = false;
  
  // Extract content from each category
  for (const line of lines) {
    // Clothing tags
    if (line.includes('clothing:')) {
      const clothing = extractFromLine(line);
      if (clothing.includes('lingerie')) tags.push('lingerie');
      if (clothing.includes('bikini')) tags.push('bikini');
      if (clothing.includes('underwear')) tags.push('underwear');
      if (clothing.includes('topless')) tags.push('topless');
      if (clothing.includes('nude')) tags.push('nude');
      if (clothing.includes('fully clothed') || clothing.includes('dressed')) tags.push('fully clothed');
      if (clothing.includes('casual')) tags.push('casual');
      if (clothing.includes('formal')) tags.push('formal');
    }
    
    // Setting tags
    if (line.includes('setting:')) {
      const setting = extractFromLine(line);
      if (setting.includes('bedroom')) tags.push('bedroom');
      if (setting.includes('bathroom')) tags.push('bathroom');
      if (setting.includes('outdoor')) tags.push('outdoor');
      if (setting.includes('studio')) tags.push('studio');
      if (setting.includes('kitchen')) tags.push('kitchen');
      if (setting.includes('living room')) tags.push('living room');
    }
    
    // Pose tags
    if (line.includes('pose:')) {
      const pose = extractFromLine(line);
      if (pose.includes('standing')) tags.push('standing');
      if (pose.includes('sitting')) tags.push('sitting');
      if (pose.includes('lying') || pose.includes('laying')) tags.push('lying down');
      if (pose.includes('kneeling')) tags.push('kneeling');
    }
    
    // Mood tags
    if (line.includes('mood:')) {
      const mood = extractFromLine(line);
      if (mood.includes('professional')) tags.push('professional');
      if (mood.includes('casual')) tags.push('casual');
      if (mood.includes('playful')) tags.push('playful');
      if (mood.includes('sultry')) tags.push('sultry');
      if (mood.includes('intimate')) tags.push('intimate');
    }
    
    // Rating tags - UPDATED FORMAT
    if (line.includes('rating:') || line.includes('content rating:')) {
      if (line.includes('x-rated') || line.includes('x rated') || line.includes('explicit')) {
        tags.push('Rated: X');
        hasRating = true;
      } else if (line.includes('r-rated') || line.includes('r rated') || line.includes(' r ') || line.includes(' r:')) {
        tags.push('Rated: R');
        hasRating = true;
      } else if (line.includes('pg')) {
        tags.push('Rated: PG');
        hasRating = true;
      }
    }
  }

  // MANDATORY RATING: If no rating was detected, analyze the clothing tags to assign one
  if (!hasRating) {
    if (tags.includes('nude')) {
      tags.push('Rated: X');
    } else if (tags.includes('topless') || tags.includes('lingerie') || tags.includes('underwear')) {
      tags.push('Rated: R');
    } else {
      // Default to PG if fully clothed or unclear
      tags.push('Rated: PG');
    }
  }

  // Remove duplicates and return
  return [...new Set(tags)];
}

function extractFromLine(line) {
  return line
    .replace(/clothing:|setting:|pose:|mood:|rating:|content rating:/gi, '')
    .trim();
}