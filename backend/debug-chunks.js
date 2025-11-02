import fs from 'fs/promises';
import pngChunksExtract from 'png-chunks-extract';

const buffer = await fs.readFile('/Users/hullsai/Projects/webapps/ComfyUI/output/CyberRealistic_FaceSwap_00001_.png');
const chunks = pngChunksExtract(buffer);

console.log('Looking at tEXt chunks:\n');

chunks.forEach((chunk, i) => {
  if (chunk.name === 'tEXt') {
    console.log(`\nChunk ${i}:`);
    console.log('First 200 bytes as buffer:', chunk.data.slice(0, 200));
    console.log('As string:', chunk.data.toString('utf8', 0, 100));
    
    // Find null terminator
    let nullIndex = -1;
    for (let j = 0; j < chunk.data.length; j++) {
      if (chunk.data[j] === 0) {
        nullIndex = j;
        break;
      }
    }
    
    if (nullIndex > -1) {
      const keyword = chunk.data.toString('utf8', 0, nullIndex);
      const value = chunk.data.toString('utf8', nullIndex + 1, nullIndex + 100);
      console.log('Keyword:', keyword);
      console.log('Value preview:', value);
    }
  }
});