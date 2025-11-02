import { parseComfyUIMetadata } from './imageParser.js';

const result = await parseComfyUIMetadata('/Users/hullsai/Projects/webapps/ComfyUI/output/CyberRealistic_FaceSwap_00001_.png');

console.log('Has metadata:', result.hasMetadata);
console.log('Prompt:', result.prompt);
console.log('Workflow exists:', !!result.workflow);
if (result.workflow) {
  console.log('Workflow nodes:', Object.keys(result.workflow.nodes || result.workflow).length);
}
console.log('\nNode Info:', JSON.stringify(result.nodeInfo, null, 2));