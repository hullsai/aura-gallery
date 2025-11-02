import fs from 'fs/promises';
import pngChunksExtract from 'png-chunks-extract';

export async function parseComfyUIMetadata(filepath) {
  try {
    const buffer = await fs.readFile(filepath);
    const chunks = pngChunksExtract(buffer);
    
    let workflowData = null;
    let promptText = null;
    let nodeInfo = null;

    // Look for text chunks
    for (const chunk of chunks) {
      if (chunk.name === 'tEXt') {
        // Find the null byte separator
        let nullIndex = -1;
        for (let i = 0; i < chunk.data.length; i++) {
          if (chunk.data[i] === 0) {
            nullIndex = i;
            break;
          }
        }
        
        if (nullIndex === -1) continue;
        
        // Extract keyword and value as buffers, then convert to strings
        const keyword = Buffer.from(chunk.data.slice(0, nullIndex)).toString('utf8');
        const value = Buffer.from(chunk.data.slice(nullIndex + 1)).toString('utf8');
        
        if (keyword === 'workflow') {
          try {
            workflowData = JSON.parse(value);
          } catch (e) {
            console.error('Failed to parse workflow JSON:', e);
          }
        }
        
        if (keyword === 'prompt') {
          try {
            const promptData = JSON.parse(value);
            promptText = extractPromptText(promptData);
            nodeInfo = extractNodeInfo(promptData);
          } catch (e) {
            console.error('Failed to parse prompt JSON:', e);
          }
        }
      }
    }

    return {
      workflow: workflowData,
      prompt: promptText,
      nodeInfo: nodeInfo,
      hasMetadata: !!(workflowData || promptText)
    };
  } catch (error) {
    console.error('Error parsing image metadata:', error);
    return {
      workflow: null,
      prompt: null,
      nodeInfo: null,
      hasMetadata: false
    };
  }
}

// Extract readable prompt text from ComfyUI prompt structure
function extractPromptText(promptData) {
  const prompts = [];
  
  // ComfyUI stores prompts in node objects
  for (const nodeId in promptData) {
    const node = promptData[nodeId];
    if (node.class_type === 'CLIPTextEncode' && node.inputs?.text) {
      prompts.push(node.inputs.text);
    }
  }
  
  return prompts.join('\n\n');
}

// Extract important node information
function extractNodeInfo(promptData) {
  const info = {
    checkpoint: null,
    sampler: null,
    steps: null,
    cfg: null,
    seed: null,
    dimensions: null,
    scheduler: null,
    denoise: null,
    otherNodes: []
  };

  for (const nodeId in promptData) {
    const node = promptData[nodeId];
    
    // Extract checkpoint/model
    if (node.class_type === 'CheckpointLoaderSimple' && node.inputs?.ckpt_name) {
      info.checkpoint = node.inputs.ckpt_name;
    }
    
    // Extract sampler settings
    if (node.class_type === 'KSampler') {
      info.sampler = node.inputs?.sampler_name;
      info.steps = node.inputs?.steps;
      info.cfg = node.inputs?.cfg;
      info.seed = node.inputs?.seed;
      info.scheduler = node.inputs?.scheduler;
      info.denoise = node.inputs?.denoise;
    }
    
    // Extract dimensions
    if (node.class_type === 'EmptyLatentImage') {
      info.dimensions = {
        width: node.inputs?.width,
        height: node.inputs?.height,
        batch_size: node.inputs?.batch_size
      };
    }
    
    // Track other interesting nodes
    if (!['CLIPTextEncode', 'CheckpointLoaderSimple', 'KSampler', 'EmptyLatentImage', 'SaveImage', 'VAEDecode'].includes(node.class_type)) {
      info.otherNodes.push({
        type: node.class_type,
        id: nodeId
      });
    }
  }
  
  return info;
}

export async function getImageStats(filepath) {
  try {
    const stats = await fs.stat(filepath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    };
  } catch (error) {
    console.error('Error getting image stats:', error);
    return null;
  }
}