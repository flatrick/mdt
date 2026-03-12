const fs = require('fs');
const path = require('path');

const WORKFLOW_CONTRACT_ROOT = path.join(__dirname, '..', '..', 'workflow-contracts');

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadWorkflowContract(contractRoot = WORKFLOW_CONTRACT_ROOT) {
  const metadataPath = path.join(contractRoot, 'metadata.json');
  const workflowsDir = path.join(contractRoot, 'workflows');
  const metadata = readJsonFile(metadataPath);
  const workflows = fs
    .readdirSync(workflowsDir)
    .filter(fileName => fileName.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map(fileName => readJsonFile(path.join(workflowsDir, fileName)));

  return {
    workflows,
    smokeProbes: metadata.smokeProbes
  };
}

const TOOL_WORKFLOW_CONTRACT = loadWorkflowContract();
const TOOL_ORDER = readJsonFile(path.join(WORKFLOW_CONTRACT_ROOT, 'metadata.json')).toolOrder;

module.exports = {
  WORKFLOW_CONTRACT_ROOT,
  loadWorkflowContract,
  TOOL_WORKFLOW_CONTRACT,
  TOOL_ORDER
};
