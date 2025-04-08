// ========== GLOBAL VARIABLES ========== //
let items = JSON.parse(localStorage.getItem('items')) || [];
let toolHistory = JSON.parse(localStorage.getItem('toolHistory')) || [];

// ========== CORE FUNCTIONS ========== //

/**
 * Saves all data to localStorage and updates the dashboard if needed
 */
function saveData() {
    localStorage.setItem('items', JSON.stringify(items));
    localStorage.setItem('toolHistory', JSON.stringify(toolHistory));
    
    if (window.location.pathname.includes('dashboard.html')) {
        updateDashboard();
    }
}

/**
 * Reads a file and returns it as a Data URL
 * @param {File} file - The file to read
 * @returns {Promise<string>} Data URL of the file
 */
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ========== DASHBOARD FUNCTIONALITY ========== //

/**
 * Updates all dashboard statistics and charts
 */
function updateDashboard() {
    // Update statistics cards
    document.getElementById('totalItems').textContent = items.length;
    
    const lowStockCount = items.filter(item => item.quantity < 5).length;
    document.getElementById('lowStockItems').textContent = lowStockCount;
    document.getElementById('lowStockItems').closest('.stat-card').onclick = showLowStockItems;
    
    const assignedTools = toolHistory.filter(tool => tool.status === 'Assigned').length;
    document.getElementById('toolsAssigned').textContent = assignedTools;
    
    const overdueTools = toolHistory.filter(tool => {
        if (tool.status !== 'Assigned') return false;
        const issuedDate = new Date(tool.issuingDate);
        const today = new Date();
        const diffDays = (today - issuedDate) / (1000 * 60 * 60 * 24);
        return diffDays > 7;
    }).length;
    document.getElementById('toolsOverdue').textContent = overdueTools;
    
    // Update recent activity table
    updateRecentActivityTable();
    
    // Create/update charts
    createCharts();
}

/**
 * Updates the recent activity table with the latest 5 entries
 */
function updateRecentActivityTable() {
    const recentActivityTable = document.getElementById('recentActivityTable').getElementsByTagName('tbody')[0];
    recentActivityTable.innerHTML = '';
    const recentActivities = [...toolHistory].reverse().slice(0, 5);
    
    recentActivities.forEach(activity => {
        const row = recentActivityTable.insertRow();
        row.insertCell(0).textContent = activity.toolName;
        row.insertCell(1).textContent = activity.technicianName;
        row.insertCell(2).textContent = activity.siteName;
        
        const statusCell = row.insertCell(3);
        statusCell.innerHTML = `<span class="status ${activity.status.toLowerCase()}">${activity.status}</span>`;
        
        row.insertCell(4).textContent = activity.issuingDate;
    });
}

/**
 * Shows a modal with all low stock items
 */
function showLowStockItems() {
    const lowStockItems = items.filter(item => item.quantity < 5).sort((a, b) => a.quantity - b.quantity);
    
    if (lowStockItems.length === 0) {
        showAlert('No items are currently low in stock!', 'info');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Low Stock Items (${lowStockItems.length})</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <table>
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Serial</th>
                            <th>Quantity</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lowStockItems.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.serial}</td>
                                <td class="quantity-cell ${item.quantity < 3 ? 'critical' : 'warning'}">
                                    ${item.quantity}
                                </td>
                                <td>
                                    <button onclick="reorderItem('${item.serial}')" class="reorder-btn">
                                        <i class="fas fa-shopping-cart"></i> Reorder
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Close modal handlers
    modal.querySelector('.close-modal').addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
    });
}

/**
 * Closes a modal and cleans up
 * @param {HTMLElement} modal - The modal element to close
 */
function closeModal(modal) {
    document.body.removeChild(modal);
    document.body.style.overflow = '';
}

/**
 * Creates or updates dashboard charts
 */
function createCharts() {
    // Tool Status Distribution Chart
    const statusCtx = document.getElementById('toolStatusChart');
    if (statusCtx) {
        if (statusCtx.chart) statusCtx.chart.destroy();
        
        const statusCounts = {
            Assigned: toolHistory.filter(tool => tool.status === 'Assigned').length,
            Returned: toolHistory.filter(tool => tool.status === 'Returned').length,
            Overdue: toolHistory.filter(tool => {
                if (tool.status !== 'Assigned') return false;
                const issuedDate = new Date(tool.issuingDate);
                const today = new Date();
                const diffDays = (today - issuedDate) / (1000 * 60 * 60 * 24);
                return diffDays > 7;
            }).length
        };
        
        statusCtx.chart = new Chart(statusCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Assigned', 'Returned', 'Overdue'],
                datasets: [{
                    data: [statusCounts.Assigned, statusCounts.Returned, statusCounts.Overdue],
                    backgroundColor: ['#4e73df', '#1cc88a', '#e74a3b'],
                    hoverBackgroundColor: ['#2e59d9', '#17a673', '#be2617'],
                    hoverBorderColor: "rgba(234, 236, 244, 1)",
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    // Most Used Tools Chart
    const toolsCtx = document.getElementById('mostUsedToolsChart');
    if (toolsCtx) {
        if (toolsCtx.chart) toolsCtx.chart.destroy();
        
        const toolUsage = {};
        toolHistory.forEach(tool => {
            toolUsage[tool.toolName] = (toolUsage[tool.toolName] || 0) + (tool.quantity || 1);
        });
        
        const sortedTools = Object.entries(toolUsage)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        toolsCtx.chart = new Chart(toolsCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: sortedTools.map(tool => tool[0]),
                datasets: [{
                    label: 'Usage Count',
                    data: sortedTools.map(tool => tool[1]),
                    backgroundColor: '#36b9cc',
                    hoverBackgroundColor: '#2c9faf',
                    hoverBorderColor: "rgba(234, 236, 244, 1)",
                }]
            },
            options: {
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// ========== STORE ITEMS MANAGEMENT ========== //

if (document.getElementById('itemForm')) {
    const itemForm = document.getElementById('itemForm');
    const itemTable = document.getElementById('itemTable').getElementsByTagName('tbody')[0];
    let documents = { manual: null, warranty: null, photos: null };

    // Initialize the items table
    renderItems();

    // Handle document uploads
    document.querySelectorAll('.doc-input').forEach(input => {
        input.addEventListener('change', async function(e) {
            const docType = this.dataset.docType;
            const docDisplay = document.querySelector(`.doc-display[data-for="${docType}"]`);
            
            if (e.target.files.length > 0) {
                try {
                    const file = e.target.files[0];
                    documents[docType] = await handleDocumentUpload(file, docType);
                    
                    docDisplay.innerHTML = `
                        <div class="doc-preview">
                            <span>${file.name}</span>
                            <button onclick="removeDocument('${docType}')" class="remove-doc">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `;
                } catch (error) {
                    console.error('Error processing document:', error);
                    showAlert(`Error uploading document: ${error.message}`, 'error');
                    documents[docType] = null;
                }
            }
        });
    });

    /**
     * Handles document upload with validation
     * @param {File} file - The file to upload
     * @param {string} docType - Type of document ('manual', 'warranty', 'photos')
     * @returns {Promise<Object>} Document object
     */
    async function handleDocumentUpload(file, docType) {
        // File size limit (5MB)
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('File size exceeds 5MB limit');
        }
        
        // Allowed types for each document type
        const validTypes = {
            'manual': ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            'warranty': ['application/pdf', 'image/jpeg', 'image/png'],
            'photos': ['image/jpeg', 'image/png']
        };
        
        if (!validTypes[docType].includes(file.type)) {
            throw new Error(`Invalid file type for ${docType}. Allowed: ${validTypes[docType].join(', ')}`);
        }
        
        return {
            name: file.name,
            type: file.type,
            dataUrl: await readFileAsDataURL(file),
            size: file.size,
            uploadedAt: new Date().toISOString()
        };
    }

    /**
     * Removes a document from the form
     * @param {string} docType - Type of document to remove
     */
    window.removeDocument = function(docType) {
        documents[docType] = null;
        document.querySelector(`.doc-input[data-doc-type="${docType}"]`).value = '';
        document.querySelector(`.doc-display[data-for="${docType}"]`).innerHTML = '';
    };

    /**
     * Renders all items in the table
     * @param {Array} filteredItems - Optional filtered items to display
     */
    function renderItems(filteredItems = items) {
        itemTable.innerHTML = '';
        filteredItems.forEach((item, index) => {
            const row = itemTable.insertRow();
            row.insertCell(0).textContent = item.name;
            row.insertCell(1).textContent = item.serial;
            row.insertCell(2).textContent = item.quantity;
            
            // Documents cell
            const docsCell = row.insertCell(3);
            docsCell.innerHTML = getDocumentIconsHTML(item, index);
            
            // Actions cell
            const actionCell = row.insertCell(4);
            actionCell.innerHTML = `
                <button onclick="editItem(${index})" class="edit-btn">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="deleteItem(${index})" class="delete-btn">
                    <i class="fas fa-trash"></i> Delete
                </button>
            `;
        });
    }

    /**
     * Generates HTML for document icons
     * @param {Object} item - The item object
     * @param {number} index - Item index
     * @returns {string} HTML string
     */
    function getDocumentIconsHTML(item, index) {
        const hasDocs = item.documents && (item.documents.manual || item.documents.warranty || item.documents.photos);
        
        if (!hasDocs) return '<span class="no-docs">None</span>';
        
        return `
            <div class="doc-icons">
                ${item.documents.manual ? `
                    <button onclick="viewDocument(${index}, 'manual')" class="doc-btn">
                        <i class="fas fa-file-pdf"></i> Manual
                    </button>
                ` : ''}
                ${item.documents.warranty ? `
                    <button onclick="viewDocument(${index}, 'warranty')" class="doc-btn">
                        <i class="fas fa-file-contract"></i> Warranty
                    </button>
                ` : ''}
                ${item.documents.photos ? `
                    <button onclick="viewDocument(${index}, 'photos')" class="doc-btn">
                        <i class="fas fa-images"></i> Photos
                    </button>
                ` : ''}
            </div>
        `;
    }

    /**
     * Views a document in a new window
     * @param {number} index - Item index
     * @param {string} docType - Type of document to view
     */
    window.viewDocument = function(index, docType) {
        const item = items[index];
        const doc = item.documents?.[docType];
        
        if (!doc) {
            showAlert('Document not found!', 'error');
            return;
        }
        
        const win = window.open('', '_blank');
        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${doc.name}</title>
                <style>
                    body { margin: 0; padding: 20px; background: #f5f5f5; }
                    .doc-container { 
                        max-width: 100%; 
                        margin: 0 auto; 
                        background: white; 
                        padding: 20px; 
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
                        border-radius: 8px;
                    }
                    .doc-actions { 
                        margin-top: 20px; 
                        text-align: center; 
                    }
                    .doc-actions button { 
                        padding: 8px 16px; 
                        margin: 0 5px; 
                        cursor: pointer; 
                        background: #3498db;
                        color: white;
                        border: none;
                        border-radius: 4px;
                    }
                    .doc-title {
                        margin-bottom: 15px;
                        color: #333;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="doc-container">
                    <h3 class="doc-title">${doc.name}</h3>
                    
                    ${doc.type.includes('pdf') ? `
                        <embed src="${doc.dataUrl}" width="100%" height="600px" type="${doc.type}">
                    ` : doc.type.includes('image') ? `
                        <img src="${doc.dataUrl}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;">
                    ` : `
                        <p>This document type cannot be previewed in the browser.</p>
                        <p>Please download the file to view it.</p>
                    `}
                    
                    <div class="doc-actions">
                        <a href="${doc.dataUrl}" download="${doc.name}">
                            <button>
                                <i class="fas fa-download"></i> Download
                            </button>
                        </a>
                        <button onclick="window.print()">
                            <i class="fas fa-print"></i> Print
                        </button>
                        <button onclick="window.close()">
                            <i class="fas fa-times"></i> Close
                        </button>
                    </div>
                </div>
            </body>
            </html>
        `);
    };

    // Form submission
    itemForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const itemName = document.getElementById('itemName').value.trim();
        const itemSerial = document.getElementById('itemSerial').value.trim();
        const itemQuantity = parseInt(document.getElementById('itemQuantity').value);

        // Validation
        if (!itemName || !itemSerial || isNaN(itemQuantity)) {
            showAlert('Please fill all fields with valid data!', 'error');
            return;
        }

        if (items.some(item => item.serial === itemSerial)) {
            showAlert('Serial number already exists!', 'error');
            return;
        }

        // Add new item with documents
        items.push({ 
            serial: itemSerial, 
            name: itemName, 
            quantity: itemQuantity,
            documents: {
                manual: documents.manual,
                warranty: documents.warranty,
                photos: documents.photos
            }
        });
        
        // Reset form and update UI
        renderItems();
        saveData();
        itemForm.reset();
        documents = { manual: null, warranty: null, photos: null };
        document.querySelectorAll('.doc-display').forEach(display => display.innerHTML = '');
        
        showAlert('Item added successfully!', 'success');
    });

    /**
     * Edits an existing item
     * @param {number} index - Index of item to edit
     */
    window.editItem = function(index) {
        const item = items[index];
        const newName = prompt('Item Name:', item.name);
        const newSerial = prompt('Serial Number:', item.serial);
        const newQuantity = prompt('Quantity:', item.quantity);

        if (newName && newSerial && newQuantity) {
            // Check if serial number is being changed to one that already exists
            if (newSerial !== item.serial && items.some(i => i.serial === newSerial)) {
                showAlert('Serial number already exists!', 'error');
                return;
            }

            items[index] = { 
                serial: newSerial, 
                name: newName, 
                quantity: parseInt(newQuantity),
                documents: item.documents
            };
            renderItems();
            saveData();
            showAlert('Item updated successfully!', 'success');
        }
    };

    /**
     * Deletes an item
     * @param {number} index - Index of item to delete
     */
    window.deleteItem = function(index) {
        if (confirm('Are you sure you want to delete this item?')) {
            items.splice(index, 1);
            renderItems();
            saveData();
            showAlert('Item deleted successfully!', 'success');
        }
    };

    /**
     * Searches items based on user input
     */
    window.searchItems = function() {
        const searchTerm = document.getElementById('searchItem').value.toLowerCase();
        const filteredItems = items.filter(item => 
            item.serial.toLowerCase().includes(searchTerm) || 
            item.name.toLowerCase().includes(searchTerm)
        );
        renderItems(filteredItems);
    };
}

// ========== TOOL TRACKING ========== //

if (document.getElementById('toolForm')) {
    const toolForm = document.getElementById('toolForm');
    const toolTable = document.getElementById('toolTable').getElementsByTagName('tbody')[0];

    // Initialize
    renderTools();

    /**
     * Shows tool suggestions based on user input
     */
    window.showSuggestions = function() {
        const input = document.getElementById('toolName').value.toLowerCase();
        const suggestions = document.getElementById('suggestions');
        suggestions.innerHTML = '';

        if (!input) {
            suggestions.style.display = 'none';
            return;
        }

        const matchedItems = items.filter(item => 
            item.name.toLowerCase().includes(input) && item.quantity > 0
        );

        if (matchedItems.length > 0) {
            matchedItems.forEach(item => {
                const suggestion = document.createElement('div');
                suggestion.className = 'suggestion-item';
                suggestion.innerHTML = `
                    <div class="suggestion-name">${item.name}</div>
                    <div class="suggestion-details">
                        <span>Serial: ${item.serial}</span>
                        <span>Available: ${item.quantity}</span>
                    </div>
                `;
                suggestion.onclick = () => {
                    document.getElementById('toolName').value = item.name;
                    document.getElementById('toolSerial').value = item.serial;
                    document.getElementById('toolQuantity').max = item.quantity;
                    document.getElementById('toolQuantity').value = 1;
                    suggestions.style.display = 'none';
                };
                suggestions.appendChild(suggestion);
            });
            suggestions.style.display = 'block';
        } else {
            suggestions.style.display = 'none';
        }
    };

    // Form submission
    toolForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const toolName = document.getElementById('toolName').value;
        const toolSerial = document.getElementById('toolSerial').value;
        const quantity = parseInt(document.getElementById('toolQuantity').value);
        const technicianName = document.getElementById('technicianName').value;
        const siteName = document.getElementById('siteName').value;

        // Validate
        if (!toolName || !toolSerial || !quantity || !technicianName || !siteName) {
            showAlert('Please fill all fields!', 'error');
            return;
        }

        const itemIndex = items.findIndex(item => item.serial === toolSerial);
        if (itemIndex === -1) {
            showAlert('Tool not found in inventory!', 'error');
            return;
        }

        if (quantity > items[itemIndex].quantity) {
            showAlert(`Only ${items[itemIndex].quantity} available!`, 'error');
            return;
        }

        // Update inventory and history
        items[itemIndex].quantity -= quantity;
        toolHistory.push({
            toolName,
            toolSerial,
            quantity,
            technicianName,
            siteName,
            issuingDate: new Date().toLocaleDateString(),
            returningDate: '-',
            status: 'Assigned',
            remarks: '-'
        });

        renderTools();
        saveData();
        toolForm.reset();
        showAlert('Tool assigned successfully!', 'success');
    });

    /**
     * Renders all tools in the tracking table
     */
    function renderTools() {
        toolTable.innerHTML = '';
        toolHistory.forEach((tool, index) => {
            const row = toolTable.insertRow();
            row.insertCell(0).textContent = tool.toolName;
            row.insertCell(1).textContent = tool.toolSerial;
            row.insertCell(2).textContent = tool.quantity;
            row.insertCell(3).textContent = tool.technicianName;
            row.insertCell(4).textContent = tool.siteName;
            row.insertCell(5).textContent = tool.issuingDate;
            row.insertCell(6).textContent = tool.returningDate;
            
            const statusCell = row.insertCell(7);
            statusCell.innerHTML = `<span class="status ${tool.status.toLowerCase()}">${tool.status}</span>`;
            
            row.insertCell(8).textContent = tool.remarks;
            
            const actionCell = row.insertCell(9);
            if (tool.status === 'Assigned') {
                actionCell.innerHTML = `
                    <button onclick="returnTool(${index})" class="return-btn">
                        <i class="fas fa-undo"></i> Return
                    </button>
                `;
            } else {
                actionCell.textContent = '-';
            }
        });
    }

    /**
     * Marks a tool as returned
     * @param {number} index - Index of tool to return
     */
    window.returnTool = function(index) {
        const tool = toolHistory[index];
        const remarks = prompt('Return Remarks:', tool.remarks);
        
        if (remarks === null) return; // User cancelled
        
        // Return quantity to inventory
        const itemIndex = items.findIndex(item => item.serial === tool.toolSerial);
        if (itemIndex !== -1) {
            items[itemIndex].quantity += tool.quantity;
        }

        // Update tool history
        toolHistory[index].status = 'Returned';
        toolHistory[index].remarks = remarks || 'No remarks';
        toolHistory[index].returningDate = new Date().toLocaleDateString();

        renderTools();
        saveData();
        showAlert('Tool marked as returned!', 'success');
    };
}

// ========== TOOL ASSIGNMENT PAGE ========== //

if (document.getElementById('multiAssignForm')) {
    const form = document.getElementById('multiAssignForm');
    let assignedTools = [];
    
    // Initialize
    updateAssignedToolsList();

    /**
     * Shows tool suggestions for assignment
     */
    window.showToolSuggestions = function() {
        const input = document.getElementById('toolName').value.toLowerCase();
        const suggestions = document.getElementById('toolSuggestions');
        suggestions.innerHTML = '';

        if (!input) {
            suggestions.style.display = 'none';
            return;
        }

        const matchedItems = items.filter(item => 
            item.name.toLowerCase().includes(input) && item.quantity > 0
        );

        if (matchedItems.length > 0) {
            matchedItems.forEach(item => {
                const suggestion = document.createElement('div');
                suggestion.className = 'suggestion-item';
                suggestion.innerHTML = `
                    <div class="suggestion-name">${item.name}</div>
                    <div class="suggestion-details">
                        <span>Serial: ${item.serial}</span>
                        <span>Available: ${item.quantity}</span>
                    </div>
                `;
                suggestion.onclick = () => {
                    document.getElementById('toolName').value = item.name;
                    document.getElementById('toolSerial').value = item.serial;
                    document.getElementById('toolQuantity').max = item.quantity;
                    document.getElementById('toolQuantity').value = 1;
                    suggestions.style.display = 'none';
                };
                suggestions.appendChild(suggestion);
            });
            suggestions.style.display = 'block';
        } else {
            suggestions.style.display = 'none';
        }
    };

    /**
     * Adds a tool to the assignment list
     */
    window.addToolToList = function() {
        const toolName = document.getElementById('toolName').value.trim();
        const serial = document.getElementById('toolSerial').value.trim();
        const quantity = parseInt(document.getElementById('toolQuantity').value);
        const item = items.find(item => item.serial === serial);

        // Validate
        if (!toolName || !serial || isNaN(quantity)) {
            showAlert('Please select a tool and enter quantity!', 'error');
            return;
        }

        if (!item) {
            showAlert('Selected tool not found in inventory!', 'error');
            return;
        }

        // Calculate already assigned quantity
        const alreadyAssigned = assignedTools
            .filter(t => t.serial === serial)
            .reduce((sum, t) => sum + t.quantity, 0);

        if (quantity > (item.quantity - alreadyAssigned)) {
            showAlert(`Only ${item.quantity - alreadyAssigned} available!`, 'error');
            return;
        }

        // Add to assignment list
        const existingIndex = assignedTools.findIndex(t => t.serial === serial);
        if (existingIndex >= 0) {
            assignedTools[existingIndex].quantity += quantity;
        } else {
            assignedTools.push({
                name: toolName,
                serial: serial,
                quantity: quantity
            });
        }

        updateAssignedToolsList();
        document.getElementById('toolName').value = '';
        document.getElementById('toolSerial').value = '';
        document.getElementById('toolQuantity').value = '1';
    };

    /**
     * Updates the assigned tools list display
     */
    function updateAssignedToolsList() {
        const table = document.getElementById('assignedToolsTable');
        table.innerHTML = '';

        assignedTools.forEach((tool, index) => {
            const row = table.insertRow();
            row.insertCell(0).textContent = tool.name;
            row.insertCell(1).textContent = tool.serial;
            row.insertCell(2).textContent = tool.quantity;
            
            const actionCell = row.insertCell(3);
            actionCell.innerHTML = `
                <button onclick="removeAssignedTool(${index})" class="remove-btn">
                    <i class="fas fa-times"></i> Remove
                </button>
            `;
        });
    }

    /**
     * Removes a tool from the assignment list
     * @param {number} index - Index of tool to remove
     */
    window.removeAssignedTool = function(index) {
        assignedTools.splice(index, 1);
        updateAssignedToolsList();
    };

    // Form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validate form
        const technician = document.getElementById('technicianName').value.trim();
        const site = document.getElementById('siteName').value.trim();
        const destination = document.getElementById('destination').value.trim();
        const issueDate = document.getElementById('issueDate').value;
        const incharge = document.getElementById('siteIncharge').value.trim();

        if (!technician || !site || !destination || !issueDate || !incharge) {
            showAlert('Please fill all assignment details!', 'error');
            return;
        }

        if (assignedTools.length === 0) {
            showAlert('Please add at least one tool!', 'error');
            return;
        }

        // Process assignment
        assignedTools.forEach(tool => {
            const itemIndex = items.findIndex(item => item.serial === tool.serial);
            if (itemIndex >= 0) {
                items[itemIndex].quantity -= tool.quantity;
            }

            toolHistory.push({
                toolName: tool.name,
                toolSerial: tool.serial,
                quantity: tool.quantity,
                technicianName: technician,
                siteName: site,
                issuingDate: new Date().toLocaleDateString(),
                returningDate: '-',
                status: 'Assigned',
                remarks: `Multi-assignment to ${technician} at ${site}`
            });
        });

        saveData();
        generatePrintView({
            technicianName: technician,
            siteName: site,
            destination: destination,
            issueDate: issueDate,
            siteIncharge: incharge,
            tools: [...assignedTools],
            date: new Date().toLocaleDateString()
        });

        // Reset form
        form.reset();
        assignedTools = [];
        updateAssignedToolsList();
        showAlert('Tools assigned successfully!', 'success');
    });

    /**
     * Generates a print view of the assignment
     * @param {Object} assignment - Assignment details
     */
    function generatePrintView(assignment) {
        const printWindow = window.open('', '_blank');
        const formattedDate = new Date(assignment.issueDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const totalTools = assignment.tools.reduce((sum, tool) => sum + tool.quantity, 0);
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Tool Assignment - ${assignment.technicianName}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
                    .header { text-align: center; margin-bottom: 20px; }
                    h1 { color: #2c3e50; margin-bottom: 5px; }
                    .subtitle { color: #7f8c8d; margin-top: 0; }
                    .assignment-info { margin-bottom: 30px; }
                    .info-grid { 
                        display: grid; 
                        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); 
                        gap: 15px; 
                        margin-bottom: 20px;
                    }
                    .info-item strong { display: block; color: #7f8c8d; font-size: 0.9em; }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin: 20px 0;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    }
                    th { 
                        background-color: #3498db; 
                        color: white; 
                        padding: 12px; 
                        text-align: left; 
                    }
                    td { 
                        padding: 10px 12px; 
                        border-bottom: 1px solid #ecf0f1; 
                    }
                    tr:nth-child(even) { background-color: #f8f9fa; }
                    .summary { 
                        margin-top: 20px; 
                        padding: 15px; 
                        background-color: #f8f9fa; 
                        border-radius: 5px;
                    }
                    .signatures { 
                        display: flex; 
                        justify-content: space-between; 
                        margin-top: 50px;
                    }
                    .signature-box { 
                        width: 200px; 
                        text-align: center;
                    }
                    .signature-line { 
                        border-top: 1px solid #333; 
                        margin: 40px 0 10px;
                    }
                    .no-print { display: none; }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Tool Assignment Form</h1>
                    <p class="subtitle">Issued on ${assignment.date}</p>
                </div>
                
                <div class="assignment-info">
                    <div class="info-grid">
                        <div class="info-item">
                            <strong>Technician</strong>
                            ${assignment.technicianName}
                        </div>
                        <div class="info-item">
                            <strong>Site</strong>
                            ${assignment.siteName}
                        </div>
                        <div class="info-item">
                            <strong>Destination</strong>
                            ${assignment.destination}
                        </div>
                        <div class="info-item">
                            <strong>Issue Date</strong>
                            ${formattedDate}
                        </div>
                        <div class="info-item">
                            <strong>Site Incharge</strong>
                            ${assignment.siteIncharge}
                        </div>
                    </div>
                </div>
                
                <h3>Assigned Tools</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Tool Name</th>
                            <th>Serial Number</th>
                            <th>Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${assignment.tools.map(tool => `
                            <tr>
                                <td>${tool.name}</td>
                                <td>${tool.serial}</td>
                                <td>${tool.quantity}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="summary">
                    <strong>Total Tools Assigned:</strong> ${totalTools}
                </div>
                
                <div class="signatures">
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <p>Technician Signature</p>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <p>Site Incharge Signature</p>
                    </div>
                </div>
                
                <div class="no-print" style="text-align: center; margin-top: 30px;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Print This Form
                    </button>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">
                        Close Window
                    </button>
                </div>
                
                <script>
                    window.onload = function() {
                        // Auto-print if desired
                        // window.print();
                    };
                </script>
            </body>
            </html>
        `);
    }
}

// ========== DATA EXPORT FUNCTIONS ========== //

/**
 * Exports store items to CSV
 */
function exportData() {
    try {
        // Create CSV content
        let csvContent = "Serial Number,Item Name,Quantity,Manual,Warranty,Photos\n";
        
        // Add all items to CSV
        items.forEach(item => {
            const manual = item.documents?.manual ? 'Yes' : 'No';
            const warranty = item.documents?.warranty ? 'Yes' : 'No';
            const photos = item.documents?.photos ? 'Yes' : 'No';
            
            csvContent += `"${item.serial}","${item.name}","${item.quantity}","${manual}","${warranty}","${photos}"\n`;
        });

        // Create download link
        downloadCSV(csvContent, `store_items_${new Date().toISOString().slice(0,10)}.csv`);
    } catch (error) {
        console.error('Export failed:', error);
        showAlert('Export failed. Please check console for details.', 'error');
    }
}

/**
 * Exports tool history to CSV
 */
function exportToolHistory() {
    try {
        // Create CSV content
        let csvContent = "Tool Name,Serial Number,Quantity,Technician,Site,Issued Date,Returned Date,Status,Remarks\n";
        
        // Add all history entries to CSV
        toolHistory.forEach(tool => {
            csvContent += `"${tool.toolName}","${tool.toolSerial || ''}","${tool.quantity || 1}",` +
                          `"${tool.technicianName}","${tool.siteName}","${tool.issuingDate}",` +
                          `"${tool.returningDate}","${tool.status}","${tool.remarks}"\n`;
        });

        downloadCSV(csvContent, `tool_history_${new Date().toISOString().slice(0,10)}.csv`);
    } catch (error) {
        console.error('Export failed:', error);
        showAlert('Export failed. Please check console for details.', 'error');
    }
}

/**
 * Downloads a CSV file
 * @param {string} content - CSV content
 * @param {string} filename - Name for the downloaded file
 */
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ========== UTILITY FUNCTIONS ========== //

/**
 * Shows a styled alert message
 * @param {string} message - Message to display
 * @param {string} type - Type of alert ('error', 'success', 'info', 'warning')
 */
function showAlert(message, type = 'error') {
    const types = {
        error: { bg: '#f8d7da', text: '#721c24', border: '#f5c6cb', icon: 'fa-exclamation-circle' },
        success: { bg: '#d4edda', text: '#155724', border: '#c3e6cb', icon: 'fa-check-circle' },
        info: { bg: '#d1ecf1', text: '#0c5460', border: '#bee5eb', icon: 'fa-info-circle' },
        warning: { bg: '#fff3cd', text: '#856404', border: '#ffeeba', icon: 'fa-exclamation-triangle' }
    };
    
    const alertBox = document.createElement('div');
    alertBox.className = 'alert-box';
    alertBox.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${types[type].bg};
        color: ${types[type].text};
        border: 1px solid ${types[type].border};
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1100;
        max-width: 400px;
        display: flex;
        align-items: center;
        animation: slideIn 0.3s ease-out;
    `;
    
    alertBox.innerHTML = `
        <i class="fas ${types[type].icon}" style="margin-right: 10px; font-size: 1.2em;"></i>
        <span style="flex-grow: 1;">${message}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; font-size: 1em; cursor: pointer; margin-left: 15px; color: inherit;">
            &times;
        </button>
    `;
    
    document.body.appendChild(alertBox);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alertBox.parentNode) {
            alertBox.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => alertBox.remove(), 300);
        }
    }, 5000);
}

// Add CSS for animations if not already present
if (!document.getElementById('alert-animations')) {
    const style = document.createElement('style');
    style.id = 'alert-animations';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// ========== INITIALIZATION ========== //

// Initialize dashboard if on that page
if (window.location.pathname.includes('dashboard.html')) {
    document.addEventListener('DOMContentLoaded', updateDashboard);
}

// Reorder item function (used in low stock items modal)
window.reorderItem = function(serial) {
    const item = items.find(i => i.serial === serial);
    if (item) {
        const newQuantity = prompt(`Enter new quantity for ${item.name} (current: ${item.quantity})`, item.quantity + 10);
        if (newQuantity && !isNaN(newQuantity)) {
            item.quantity = parseInt(newQuantity);
            saveData();
            showAlert(`Quantity updated for ${item.name}`, 'success');
            
            // Refresh if on dashboard
            if (window.location.pathname.includes('dashboard.html')) {
                updateDashboard();
            }
        }
    }
};