/* assets/macros.js - DeFi Macro System
 * Allows users to create, save, and execute sequences of DeFi operations
 */

// Available macro step types and their configurations
const MACRO_STEP_TYPES = {
  CLAIM_REWARDS: {
    name: 'Claim LP Rewards',
    description: 'Claim rewards from a liquidity pool',
    params: [
      { id: 'farmId', name: 'Farm ID', type: 'select', options: 'farms' }
    ]
  },
  SWAP: {
    name: 'Swap Tokens',
    description: 'Swap one token for another',
    params: [
      { id: 'fromToken', name: 'From Token', type: 'select', options: 'tokens' },
      { id: 'toToken', name: 'To Token', type: 'select', options: 'tokens' },
      { id: 'amount', name: 'Amount', type: 'text', placeholder: 'Amount or % (e.g. 50%)' },
      { id: 'slippage', name: 'Slippage %', type: 'number', default: '1.0' }
    ]
  },
  ADD_LIQUIDITY: {
    name: 'Add Liquidity',
    description: 'Add liquidity to a pool',
    params: [
      { id: 'pairId', name: 'Pair ID', type: 'select', options: 'pairs' },
      { id: 'amount0', name: 'Token 0 Amount', type: 'text', placeholder: 'Amount or % (e.g. 100%)' },
      { id: 'amount1', name: 'Token 1 Amount', type: 'text', placeholder: 'Amount or leave empty for auto' }
    ]
  },
  REMOVE_LIQUIDITY: {
    name: 'Remove Liquidity',
    description: 'Remove liquidity from a pool',
    params: [
      { id: 'pairId', name: 'Pair ID', type: 'select', options: 'pairs' },
      { id: 'percentage', name: 'Percentage to Remove', type: 'number', default: '100' }
    ]
  },
  ADD_TO_FARM: {
    name: 'Add to Farm',
    description: 'Stake LP tokens in a farm',
    params: [
      { id: 'farmId', name: 'Farm ID', type: 'select', options: 'farms' },
      { id: 'amount', name: 'Amount', type: 'text', placeholder: 'Amount or % (e.g. 100%)' }
    ]
  }
};

// DOM Elements
const macroNameInput = document.getElementById('macroName');
const macroStepsContainer = document.getElementById('macroSteps');
const addStepBtn = document.getElementById('addStepBtn');
const saveMacroBtn = document.getElementById('saveMacroBtn');
const clearMacroBtn = document.getElementById('clearMacroBtn');
const savedMacrosContainer = document.getElementById('savedMacros');
const shareLinkInput = document.getElementById('shareLink');
const copyShareLinkBtn = document.getElementById('copyShareLinkBtn');
const importLinkInput = document.getElementById('importLink');
const importMacroBtn = document.getElementById('importMacroBtn');
const executeMacroSelect = document.getElementById('executeMacroSelect');
const executeMacroBtn = document.getElementById('executeMacroBtn');
const executionStatus = document.getElementById('executionStatus');
const executionSteps = document.getElementById('executionSteps');

// State
let currentMacro = {
  name: '',
  steps: []
};

let savedMacros = [];
let availableFarms = [];
let availablePairs = [];
let availableTokens = [];

// Initialize the macros system
function initMacros() {
  // Load saved macros from localStorage
  loadSavedMacros();
  
  // Set up event listeners
  addStepBtn.addEventListener('click', showAddStepModal);
  saveMacroBtn.addEventListener('click', saveMacro);
  clearMacroBtn.addEventListener('click', clearMacro);
  copyShareLinkBtn.addEventListener('click', copyShareLink);
  importMacroBtn.addEventListener('click', importMacro);
  executeMacroBtn.addEventListener('click', executeMacro);
  
  // Load available options for selects
  loadAvailableOptions();
  
  // Create the add step modal
  createAddStepModal();
}

// Load saved macros from localStorage
function loadSavedMacros() {
  try {
    const saved = localStorage.getItem('xianDexMacros');
    if (saved) {
      savedMacros = JSON.parse(saved);
      renderSavedMacros();
      updateExecuteMacroSelect();
    }
  } catch (err) {
    console.error('Failed to load saved macros:', err);
    savedMacros = [];
  }
}

// Save macros to localStorage
function saveMacrosToStorage() {
  try {
    localStorage.setItem('xianDexMacros', JSON.stringify(savedMacros));
  } catch (err) {
    console.error('Failed to save macros to localStorage:', err);
    showToast('Failed to save macros', 'error');
  }
}

// Render the list of saved macros
function renderSavedMacros() {
  savedMacrosContainer.innerHTML = '';
  
  if (savedMacros.length === 0) {
    savedMacrosContainer.innerHTML = '<div class="text-sm text-gray-400 italic">No saved macros yet</div>';
    return;
  }
  
  savedMacros.forEach((macro, index) => {
    const macroEl = document.createElement('div');
    macroEl.className = 'bg-white/5 rounded p-3 relative';
    
    macroEl.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <h3 class="font-medium">${macro.name}</h3>
        <div class="flex gap-1">
          <button class="edit-macro-btn p-1 text-xs rounded hover:bg-white/10" data-index="${index}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button class="delete-macro-btn p-1 text-xs rounded hover:bg-white/10" data-index="${index}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      <div class="text-xs text-gray-400 mb-2">${macro.steps.length} step${macro.steps.length !== 1 ? 's' : ''}</div>
      <div class="text-xs space-y-1">
        ${macro.steps.map(step => `<div class="bg-white/5 px-2 py-1 rounded">${MACRO_STEP_TYPES[step.type].name}</div>`).join('')}
      </div>
    `;
    
    // Add event listeners
    savedMacrosContainer.appendChild(macroEl);
  });
  
  // Add event listeners for edit and delete buttons
  document.querySelectorAll('.edit-macro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      editMacro(index);
    });
  });
  
  document.querySelectorAll('.delete-macro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      deleteMacro(index);
    });
  });
}

// Update the execute macro select dropdown
function updateExecuteMacroSelect() {
  executeMacroSelect.innerHTML = '<option value="">-- Select a macro --</option>';
  
  savedMacros.forEach((macro, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = macro.name;
    executeMacroSelect.appendChild(option);
  });
}

// Load available options for selects (farms, pairs, tokens)
function loadAvailableOptions() {
  // In a real implementation, these would be loaded from the blockchain
  // For now, we'll use placeholder data
  
  // Load farms
  try {
    // This would normally be loaded from the blockchain
    availableFarms = [
      { id: '1', name: 'XIAN-USDC Farm' },
      { id: '2', name: 'XIAN-ETH Farm' },
      { id: '3', name: 'USDC-ETH Farm' }
    ];
  } catch (err) {
    console.error('Failed to load farms:', err);
    availableFarms = [];
  }
  
  // Load pairs
  try {
    // This would normally be loaded from the blockchain
    availablePairs = [
      { id: '1', name: 'XIAN-USDC' },
      { id: '2', name: 'XIAN-ETH' },
      { id: '3', name: 'USDC-ETH' }
    ];
  } catch (err) {
    console.error('Failed to load pairs:', err);
    availablePairs = [];
  }
  
  // Load tokens
  try {
    // This would normally be loaded from the blockchain
    availableTokens = [
      { id: 'con_xian', name: 'XIAN' },
      { id: 'con_usdc', name: 'USDC' },
      { id: 'con_eth', name: 'ETH' }
    ];
  } catch (err) {
    console.error('Failed to load tokens:', err);
    availableTokens = [];
  }
}

// Create the modal for adding steps
function createAddStepModal() {
  const modal = document.createElement('div');
  modal.id = 'addStepModal';
  modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 hidden';
  
  modal.innerHTML = `
    <div class="bg-brand-card rounded-lg p-4 max-w-md w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Add Macro Step</h3>
        <button id="closeStepModal" class="p-1 hover:bg-white/10 rounded">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-400 mb-1">Step Type</label>
        <select id="stepTypeSelect" class="w-full rounded bg-white/5 px-3 py-2 
                focus:outline-none focus:ring-2 focus:ring-brand-cyan">
          <option value="">-- Select step type --</option>
          ${Object.entries(MACRO_STEP_TYPES).map(([type, config]) => 
            `<option value="${type}">${config.name}</option>`
          ).join('')}
        </select>
      </div>
      
      <div id="stepParamsContainer" class="space-y-3">
        <!-- Parameters will be added here dynamically -->
      </div>
      
      <div class="flex justify-end mt-4">
        <button id="addStepToMacroBtn" class="px-4 py-2 font-medium rounded-md
                 bg-brand-cyan text-black
                 hover:bg-brand-cyan/90 active:bg-brand-cyan/80
                 focus:outline-none focus:ring-2 focus:ring-brand-cyan
                 transition">
          Add Step
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners
  document.getElementById('closeStepModal').addEventListener('click', hideAddStepModal);
  document.getElementById('stepTypeSelect').addEventListener('change', updateStepParams);
  document.getElementById('addStepToMacroBtn').addEventListener('click', addStepToMacro);
}

// Show the add step modal
function showAddStepModal() {
  const modal = document.getElementById('addStepModal');
  modal.classList.remove('hidden');
  document.getElementById('stepTypeSelect').value = '';
  document.getElementById('stepParamsContainer').innerHTML = '';
}

// Hide the add step modal
function hideAddStepModal() {
  const modal = document.getElementById('addStepModal');
  modal.classList.add('hidden');
}

// Update the step parameters based on the selected step type
function updateStepParams() {
  const stepType = document.getElementById('stepTypeSelect').value;
  const paramsContainer = document.getElementById('stepParamsContainer');
  
  paramsContainer.innerHTML = '';
  
  if (!stepType || !MACRO_STEP_TYPES[stepType]) {
    return;
  }
  
  const stepConfig = MACRO_STEP_TYPES[stepType];
  
  stepConfig.params.forEach(param => {
    const paramEl = document.createElement('div');
    
    let inputHtml = '';
    
    if (param.type === 'select') {
      let options = [];
      
      if (param.options === 'farms') {
        options = availableFarms.map(farm => `<option value="${farm.id}">${farm.name}</option>`);
      } else if (param.options === 'pairs') {
        options = availablePairs.map(pair => `<option value="${pair.id}">${pair.name}</option>`);
      } else if (param.options === 'tokens') {
        options = availableTokens.map(token => `<option value="${token.id}">${token.name}</option>`);
      }
      
      inputHtml = `
        <select id="param_${param.id}" class="w-full rounded bg-white/5 px-3 py-2 
                focus:outline-none focus:ring-2 focus:ring-brand-cyan">
          <option value="">-- Select ${param.name} --</option>
          ${options.join('')}
        </select>
      `;
    } else if (param.type === 'number') {
      inputHtml = `
        <input type="number" id="param_${param.id}" 
               class="w-full rounded bg-white/5 px-3 py-2 
               focus:outline-none focus:ring-2 focus:ring-brand-cyan"
               value="${param.default || ''}" step="0.1" min="0">
      `;
    } else {
      inputHtml = `
        <input type="text" id="param_${param.id}" 
               class="w-full rounded bg-white/5 px-3 py-2 
               focus:outline-none focus:ring-2 focus:ring-brand-cyan"
               placeholder="${param.placeholder || ''}" value="${param.default || ''}">
      `;
    }
    
    paramEl.innerHTML = `
      <label class="block text-sm font-medium text-gray-400 mb-1">${param.name}</label>
      ${inputHtml}
    `;
    
    paramsContainer.appendChild(paramEl);
  });
}

// Add a step to the current macro
function addStepToMacro() {
  const stepType = document.getElementById('stepTypeSelect').value;
  
  if (!stepType || !MACRO_STEP_TYPES[stepType]) {
    showToast('Please select a step type', 'error');
    return;
  }
  
  const stepConfig = MACRO_STEP_TYPES[stepType];
  const params = {};
  
  // Validate and collect parameters
  let isValid = true;
  
  stepConfig.params.forEach(param => {
    const paramEl = document.getElementById(`param_${param.id}`);
    const value = paramEl.value.trim();
    
    if (!value && param.required !== false) {
      isValid = false;
      paramEl.classList.add('ring-2', 'ring-red-500');
    } else {
      paramEl.classList.remove('ring-2', 'ring-red-500');
      params[param.id] = value;
    }
  });
  
  if (!isValid) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  
  // Add the step to the current macro
  currentMacro.steps.push({
    type: stepType,
    params
  });
  
  // Render the updated steps
  renderMacroSteps();
  
  // Hide the modal
  hideAddStepModal();
  
  // Update share link
  updateShareLink();
}

// Render the current macro steps
function renderMacroSteps() {
  macroStepsContainer.innerHTML = '';
  
  if (currentMacro.steps.length === 0) {
    macroStepsContainer.innerHTML = '<div class="text-sm text-gray-400 italic">No steps added yet</div>';
    return;
  }
  
  currentMacro.steps.forEach((step, index) => {
    const stepEl = document.createElement('div');
    stepEl.className = 'bg-white/5 rounded p-3 relative';
    
    const stepConfig = MACRO_STEP_TYPES[step.type];
    
    let paramsHtml = '';
    
    Object.entries(step.params).forEach(([key, value]) => {
      const paramConfig = stepConfig.params.find(p => p.id === key);
      if (!paramConfig) return;
      
      let displayValue = value;
      
      // Format display values for selects
      if (paramConfig.type === 'select') {
        if (paramConfig.options === 'farms') {
          const farm = availableFarms.find(f => f.id === value);
          if (farm) displayValue = farm.name;
        } else if (paramConfig.options === 'pairs') {
          const pair = availablePairs.find(p => p.id === value);
          if (pair) displayValue = pair.name;
        } else if (paramConfig.options === 'tokens') {
          const token = availableTokens.find(t => t.id === value);
          if (token) displayValue = token.name;
        }
      }
      
      paramsHtml += `
        <div class="flex justify-between text-xs mb-1">
          <span class="text-gray-400">${paramConfig.name}:</span>
          <span>${displayValue}</span>
        </div>
      `;
    });
    
    stepEl.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <h3 class="font-medium">${index + 1}. ${stepConfig.name}</h3>
        <div class="flex gap-1">
          <button class="move-step-up-btn p-1 text-xs rounded hover:bg-white/10 ${index === 0 ? 'opacity-50 cursor-not-allowed' : ''}" 
                  data-index="${index}" ${index === 0 ? 'disabled' : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <button class="move-step-down-btn p-1 text-xs rounded hover:bg-white/10 ${index === currentMacro.steps.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}" 
                  data-index="${index}" ${index === currentMacro.steps.length - 1 ? 'disabled' : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <button class="delete-step-btn p-1 text-xs rounded hover:bg-white/10" data-index="${index}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      ${paramsHtml}
    `;
    
    macroStepsContainer.appendChild(stepEl);
  });
  
  // Add event listeners for step buttons
  document.querySelectorAll('.move-step-up-btn').forEach(btn => {
    if (btn.disabled) return;
    
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      moveStepUp(index);
    });
  });
  
  document.querySelectorAll('.move-step-down-btn').forEach(btn => {
    if (btn.disabled) return;
    
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      moveStepDown(index);
    });
  });
  
  document.querySelectorAll('.delete-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      deleteStep(index);
    });
  });
}

// Move a step up in the macro
function moveStepUp(index) {
  if (index <= 0 || index >= currentMacro.steps.length) return;
  
  const temp = currentMacro.steps[index];
  currentMacro.steps[index] = currentMacro.steps[index - 1];
  currentMacro.steps[index - 1] = temp;
  
  renderMacroSteps();
  updateShareLink();
}

// Move a step down in the macro
function moveStepDown(index) {
  if (index < 0 || index >= currentMacro.steps.length - 1) return;
  
  const temp = currentMacro.steps[index];
  currentMacro.steps[index] = currentMacro.steps[index + 1];
  currentMacro.steps[index + 1] = temp;
  
  renderMacroSteps();
  updateShareLink();
}

// Delete a step from the macro
function deleteStep(index) {
  if (index < 0 || index >= currentMacro.steps.length) return;
  
  currentMacro.steps.splice(index, 1);
  
  renderMacroSteps();
  updateShareLink();
}

// Save the current macro
function saveMacro() {
  const name = macroNameInput.value.trim();
  
  if (!name) {
    showToast('Please enter a macro name', 'error');
    macroNameInput.focus();
    return;
  }
  
  if (currentMacro.steps.length === 0) {
    showToast('Please add at least one step', 'error');
    return;
  }
  
  // Check if we're editing an existing macro
  const existingIndex = savedMacros.findIndex(m => m.id === currentMacro.id);
  
  if (existingIndex >= 0) {
    // Update existing macro
    savedMacros[existingIndex] = {
      ...currentMacro,
      name
    };
  } else {
    // Add new macro
    savedMacros.push({
      id: Date.now().toString(),
      name,
      steps: [...currentMacro.steps]
    });
  }
  
  // Save to localStorage
  saveMacrosToStorage();
  
  // Update UI
  renderSavedMacros();
  updateExecuteMacroSelect();
  
  // Show success message
  showToast('Macro saved successfully', 'success');
  
  // Clear the form
  clearMacro();
}

// Clear the current macro
function clearMacro() {
  currentMacro = {
    name: '',
    steps: []
  };
  
  macroNameInput.value = '';
  renderMacroSteps();
  updateShareLink();
}

// Edit an existing macro
function editMacro(index) {
  if (index < 0 || index >= savedMacros.length) return;
  
  const macro = savedMacros[index];
  
  currentMacro = {
    id: macro.id,
    name: macro.name,
    steps: [...macro.steps]
  };
  
  macroNameInput.value = macro.name;
  renderMacroSteps();
  updateShareLink();
  
  // Scroll to the top of the macros view
  document.getElementById('macrosView').scrollTo(0, 0);
}

// Delete a saved macro
function deleteMacro(index) {
  if (index < 0 || index >= savedMacros.length) return;
  
  if (!confirm(`Are you sure you want to delete the macro "${savedMacros[index].name}"?`)) {
    return;
  }
  
  savedMacros.splice(index, 1);
  
  // Save to localStorage
  saveMacrosToStorage();
  
  // Update UI
  renderSavedMacros();
  updateExecuteMacroSelect();
  
  // Show success message
  showToast('Macro deleted', 'info');
}

// Update the share link for the current macro
function updateShareLink() {
  if (currentMacro.steps.length === 0) {
    shareLinkInput.value = '';
    return;
  }
  
  const macroData = {
    name: macroNameInput.value.trim() || 'Unnamed Macro',
    steps: currentMacro.steps
  };
  
  const encoded = btoa(JSON.stringify(macroData));
  shareLinkInput.value = encoded;
}

// Copy the share link to clipboard
function copyShareLink() {
  const shareLink = shareLinkInput.value;
  
  if (!shareLink) {
    showToast('No macro to share', 'error');
    return;
  }
  
  navigator.clipboard.writeText(shareLink)
    .then(() => {
      showToast('Macro code copied to clipboard', 'success');
    })
    .catch(err => {
      console.error('Failed to copy:', err);
      showToast('Failed to copy to clipboard', 'error');
    });
}

// Import a macro from a share link
function importMacro() {
  const importCode = importLinkInput.value.trim();
  
  if (!importCode) {
    showToast('Please enter a macro code', 'error');
    importLinkInput.focus();
    return;
  }
  
  try {
    const decoded = atob(importCode);
    const macroData = JSON.parse(decoded);
    
    if (!macroData.name || !Array.isArray(macroData.steps)) {
      throw new Error('Invalid macro format');
    }
    
    // Validate steps
    macroData.steps.forEach(step => {
      if (!step.type || !MACRO_STEP_TYPES[step.type]) {
        throw new Error(`Invalid step type: ${step.type}`);
      }
    });
    
    // Set as current macro
    currentMacro = {
      name: macroData.name,
      steps: macroData.steps
    };
    
    macroNameInput.value = macroData.name;
    renderMacroSteps();
    updateShareLink();
    
    // Clear import field
    importLinkInput.value = '';
    
    // Show success message
    showToast('Macro imported successfully', 'success');
    
  } catch (err) {
    console.error('Failed to import macro:', err);
    showToast('Invalid macro code', 'error');
  }
}

// Execute a macro
async function executeMacro() {
  const macroIndex = executeMacroSelect.value;
  
  if (!macroIndex) {
    showToast('Please select a macro to execute', 'error');
    return;
  }
  
  const macro = savedMacros[macroIndex];
  
  if (!macro || !macro.steps || macro.steps.length === 0) {
    showToast('Invalid macro', 'error');
    return;
  }
  
  // Check if wallet is connected
  try {
    const walletInfo = await XianWalletUtils.requestWalletInfo();
    if (!walletInfo || !walletInfo.address) {
      showToast('Please connect your wallet first', 'error');
      return;
    }
  } catch (err) {
    console.error('Failed to check wallet:', err);
    showToast('Please connect your wallet first', 'error');
    return;
  }
  
  // Show execution status
  executionStatus.classList.remove('hidden');
  executionSteps.innerHTML = '';
  
  // Disable execute button
  executeMacroBtn.disabled = true;
  executeMacroBtn.classList.add('opacity-50', 'cursor-not-allowed');
  
  // Execute each step sequentially
  for (let i = 0; i < macro.steps.length; i++) {
    const step = macro.steps[i];
    const stepConfig = MACRO_STEP_TYPES[step.type];
    
    // Add step to UI
    const stepEl = document.createElement('div');
    stepEl.className = 'flex items-center gap-2';
    stepEl.innerHTML = `
      <div class="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
        <span class="text-xs">${i + 1}</span>
      </div>
      <div class="flex-1">
        <div class="font-medium">${stepConfig.name}</div>
        <div class="text-xs text-gray-400 step-status">Pending...</div>
      </div>
      <div class="step-indicator">
        <div class="animate-spin rounded-full h-4 w-4 border-t-2 border-brand-cyan"></div>
      </div>
    `;
    
    executionSteps.appendChild(stepEl);
    
    // Execute the step
    try {
      await executeStep(step);
      
      // Update UI to show success
      stepEl.querySelector('.step-status').textContent = 'Completed';
      stepEl.querySelector('.step-indicator').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
      `;
    } catch (err) {
      console.error(`Failed to execute step ${i + 1}:`, err);
      
      // Update UI to show error
      stepEl.querySelector('.step-status').textContent = `Error: ${err.message || 'Unknown error'}`;
      stepEl.querySelector('.step-indicator').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
      `;
      
      // Stop execution
      break;
    }
  }
  
  // Re-enable execute button
  executeMacroBtn.disabled = false;
  executeMacroBtn.classList.remove('opacity-50', 'cursor-not-allowed');
}

// Execute a single step of a macro
async function executeStep(step) {
  // Execute the step based on its type
  switch (step.type) {
    case 'CLAIM_REWARDS':
      return await claimRewards(step.params);
    case 'SWAP':
      return await swapTokens(step.params);
    case 'ADD_LIQUIDITY':
      return await addLiquidity(step.params);
    case 'REMOVE_LIQUIDITY':
      return await removeLiquidity(step.params);
    case 'ADD_TO_FARM':
      return await addToFarm(step.params);
    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

// Claim rewards from a farm
async function claimRewards(params) {
  const { farmId } = params;
  
  try {
    // Get farm contract from the farm ID
    const farmContract = `con_farm_${farmId}`;
    
    // Call the claim_rewards method on the farm contract
    const result = await XianWalletUtils.sendTransaction(
      farmContract,
      'claim_rewards',
      {}
    );
    
    console.log('Claim rewards result:', result);
    return result;
  } catch (err) {
    console.error('Failed to claim rewards:', err);
    throw new Error(`Failed to claim rewards: ${err.message || 'Unknown error'}`);
  }
}

// Swap tokens
async function swapTokens(params) {
  const { fromToken, toToken, amount, slippage } = params;
  
  try {
    // Determine if amount is a percentage
    let actualAmount;
    if (amount.endsWith('%')) {
      // Get percentage value
      const percentage = parseFloat(amount) / 100;
      
      // Get balance of fromToken
      const balance = await XianWalletUtils.getBalance(fromToken);
      
      // Calculate amount based on percentage
      actualAmount = Math.floor(parseFloat(balance) * percentage).toString();
    } else {
      actualAmount = amount;
    }
    
    // Get the DEX contract
    const dexContract = 'con_dex_01';
    
    // Calculate minimum amount out based on slippage
    // In a real implementation, you would get the current price and calculate this
    const slippageMultiplier = (100 - parseFloat(slippage)) / 100;
    
    // Call the swap method on the DEX contract
    const result = await XianWalletUtils.sendTransaction(
      dexContract,
      'swap',
      {
        token_contract: fromToken,
        to_token: toToken,
        amount: actualAmount
      }
    );
    
    console.log('Swap result:', result);
    return result;
  } catch (err) {
    console.error('Failed to swap tokens:', err);
    throw new Error(`Failed to swap tokens: ${err.message || 'Unknown error'}`);
  }
}

// Add liquidity to a pool
async function addLiquidity(params) {
  const { pairId, amount0, amount1 } = params;
  
  try {
    // Get pair info
    const pair = availablePairs.find(p => p.id === pairId);
    if (!pair) {
      throw new Error(`Pair with ID ${pairId} not found`);
    }
    
    // Parse token contracts from pair name (this is a simplification)
    const [token0Symbol, token1Symbol] = pair.name.split('-');
    const token0 = availableTokens.find(t => t.name === token0Symbol)?.id;
    const token1 = availableTokens.find(t => t.name === token1Symbol)?.id;
    
    if (!token0 || !token1) {
      throw new Error(`Could not determine token contracts for pair ${pair.name}`);
    }
    
    // Determine if amount0 is a percentage
    let actualAmount0;
    if (amount0.endsWith('%')) {
      // Get percentage value
      const percentage = parseFloat(amount0) / 100;
      
      // Get balance of token0
      const balance = await XianWalletUtils.getBalance(token0);
      
      // Calculate amount based on percentage
      actualAmount0 = Math.floor(parseFloat(balance) * percentage).toString();
    } else {
      actualAmount0 = amount0;
    }
    
    // Determine amount1 (if not provided, it will be calculated by the contract)
    let actualAmount1 = amount1;
    if (amount1 && amount1.endsWith('%')) {
      // Get percentage value
      const percentage = parseFloat(amount1) / 100;
      
      // Get balance of token1
      const balance = await XianWalletUtils.getBalance(token1);
      
      // Calculate amount based on percentage
      actualAmount1 = Math.floor(parseFloat(balance) * percentage).toString();
    }
    
    // Get the DEX contract
    const dexContract = 'con_dex_01';
    
    // Call the add_liquidity method on the DEX contract
    const result = await XianWalletUtils.sendTransaction(
      dexContract,
      'add_liquidity',
      {
        token_a: token0,
        token_b: token1,
        amount_a: actualAmount0,
        amount_b: actualAmount1 || '0' // If not provided, contract will calculate
      }
    );
    
    console.log('Add liquidity result:', result);
    return result;
  } catch (err) {
    console.error('Failed to add liquidity:', err);
    throw new Error(`Failed to add liquidity: ${err.message || 'Unknown error'}`);
  }
}

// Remove liquidity from a pool
async function removeLiquidity(params) {
  const { pairId, percentage } = params;
  
  try {
    // Get pair info
    const pair = availablePairs.find(p => p.id === pairId);
    if (!pair) {
      throw new Error(`Pair with ID ${pairId} not found`);
    }
    
    // Parse token contracts from pair name (this is a simplification)
    const [token0Symbol, token1Symbol] = pair.name.split('-');
    const token0 = availableTokens.find(t => t.name === token0Symbol)?.id;
    const token1 = availableTokens.find(t => t.name === token1Symbol)?.id;
    
    if (!token0 || !token1) {
      throw new Error(`Could not determine token contracts for pair ${pair.name}`);
    }
    
    // Get the DEX contract
    const dexContract = 'con_dex_01';
    
    // Get LP token contract
    const lpTokenContract = `con_lp_${token0}_${token1}`;
    
    // Get LP token balance
    const lpBalance = await XianWalletUtils.getBalance(lpTokenContract);
    
    // Calculate amount to remove based on percentage
    const percentageValue = parseFloat(percentage) / 100;
    const amountToRemove = Math.floor(parseFloat(lpBalance) * percentageValue).toString();
    
    // Call the remove_liquidity method on the DEX contract
    const result = await XianWalletUtils.sendTransaction(
      dexContract,
      'remove_liquidity',
      {
        token_a: token0,
        token_b: token1,
        amount: amountToRemove
      }
    );
    
    console.log('Remove liquidity result:', result);
    return result;
  } catch (err) {
    console.error('Failed to remove liquidity:', err);
    throw new Error(`Failed to remove liquidity: ${err.message || 'Unknown error'}`);
  }
}

// Add LP tokens to a farm
async function addToFarm(params) {
  const { farmId, amount } = params;
  
  try {
    // Get farm contract from the farm ID
    const farmContract = `con_farm_${farmId}`;
    
    // Get farm info to determine LP token
    const farm = availableFarms.find(f => f.id === farmId);
    if (!farm) {
      throw new Error(`Farm with ID ${farmId} not found`);
    }
    
    // Parse token contracts from farm name (this is a simplification)
    const [token0Symbol, token1Symbol] = farm.name.split('-');
    const token0 = availableTokens.find(t => t.name === token0Symbol)?.id;
    const token1 = availableTokens.find(t => t.name === token1Symbol)?.id;
    
    if (!token0 || !token1) {
      throw new Error(`Could not determine token contracts for farm ${farm.name}`);
    }
    
    // Get LP token contract
    const lpTokenContract = `con_lp_${token0}_${token1}`;
    
    // Determine if amount is a percentage
    let actualAmount;
    if (amount.endsWith('%')) {
      // Get percentage value
      const percentage = parseFloat(amount) / 100;
      
      // Get balance of LP token
      const balance = await XianWalletUtils.getBalance(lpTokenContract);
      
      // Calculate amount based on percentage
      actualAmount = Math.floor(parseFloat(balance) * percentage).toString();
    } else {
      actualAmount = amount;
    }
    
    // Call the stake method on the farm contract
    const result = await XianWalletUtils.sendTransaction(
      farmContract,
      'stake',
      {
        amount: actualAmount
      }
    );
    
    console.log('Add to farm result:', result);
    return result;
  } catch (err) {
    console.error('Failed to add to farm:', err);
    throw new Error(`Failed to add to farm: ${err.message || 'Unknown error'}`);
  }
}

// Show a toast notification
function showToast(message, type = 'info') {
  // Create toast element if it doesn't exist
  let toastContainer = document.getElementById('toastContainer');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2';
    document.body.appendChild(toastContainer);
  }
  
  // Create toast
  const toast = document.createElement('div');
  toast.className = 'px-4 py-2 rounded-md text-sm font-medium shadow-lg transform transition-all duration-300 translate-y-2 opacity-0';
  
  // Set color based on type
  if (type === 'success') {
    toast.classList.add('bg-green-500', 'text-white');
  } else if (type === 'error') {
    toast.classList.add('bg-red-500', 'text-white');
  } else if (type === 'warning') {
    toast.classList.add('bg-yellow-500', 'text-white');
  } else {
    toast.classList.add('bg-brand-cyan', 'text-black');
  }
  
  toast.textContent = message;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);
  
  // Remove after delay
  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Check if the current hash is #macros
function isMacrosHashLocal() {
  return location.hash === '#macros';
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (isMacrosHashLocal()) {
    initMacros();
  }
});

// Initialize when the hash changes to #macros
window.addEventListener('hashchange', () => {
  if (isMacrosHashLocal()) {
    initMacros();
  }
});