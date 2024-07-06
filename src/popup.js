// popup.js
document.addEventListener('DOMContentLoaded', function() {
    const loadDictionaryBtn = document.getElementById('loadDictionary');
    const fileInput = document.getElementById('csvFile');
    const statusDiv = document.getElementById('status');
    const dictionaryListDiv = document.getElementById('dictionaryList');
  
    loadDictionaryBtn.addEventListener('click', function() {
      const file = fileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const csvContent = e.target.result;
          const dictionaryName = file.name.replace('.csv', '');
          chrome.runtime.sendMessage({action: "loadDictionary", data: csvContent, name: dictionaryName}, function(response) {
            statusDiv.textContent = response.message;
            updateDictionaryList();
          });
        };
        reader.readAsText(file);
      } else {
        statusDiv.textContent = "Please select a CSV file.";
      }
    });
  
    function updateDictionaryList() {
      chrome.storage.local.get('dictionaryList', function(result) {
        const dictionaryList = result.dictionaryList || [];
        dictionaryListDiv.innerHTML = '<h3>Loaded Dictionaries</h3>';
        dictionaryList.forEach(function(dict) {
          const dictDiv = document.createElement('div');
          dictDiv.className = 'dictionary-item';
          dictDiv.innerHTML = `
            <span>${dict.name}</span>
            <div>
              <button class="toggle-dict" data-name="${dict.name}">${dict.enabled ? 'Disable' : 'Enable'}</button>
              <button class="remove-dict" data-name="${dict.name}">Remove</button>
            </div>
          `;
          dictionaryListDiv.appendChild(dictDiv);
        });
  
        // Add event listeners for toggle and remove buttons
        document.querySelectorAll('.toggle-dict').forEach(btn => {
          btn.addEventListener('click', function() {
            const dictName = this.getAttribute('data-name');
            chrome.runtime.sendMessage({action: "toggleDictionary", name: dictName}, function(response) {
              statusDiv.textContent = response.message;
              updateDictionaryList();
            });
          });
        });
  
        document.querySelectorAll('.remove-dict').forEach(btn => {
          btn.addEventListener('click', function() {
            const dictName = this.getAttribute('data-name');
            chrome.runtime.sendMessage({action: "removeDictionary", name: dictName}, function(response) {
              statusDiv.textContent = response.message;
              updateDictionaryList();
            });
          });
        });
      });
    }
  
    // Initial load of dictionary list
    updateDictionaryList();
  });