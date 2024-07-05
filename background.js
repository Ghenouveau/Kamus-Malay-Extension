// background.js

// Helper function to merge dictionaries
function mergeDictionaries(existing, newEntries) {
    const merged = { ...existing };
    for (const [key, value] of Object.entries(newEntries)) {
      if (merged[key]) {
        merged[key] = [...merged[key], ...value];
      } else {
        merged[key] = value;
      }
    }
    return merged;
  }
  
  // Helper function to filter dictionary based on enabled status
  function filterDictionary(dictionary, enabledDicts) {
    const filtered = {};
    for (const [key, entries] of Object.entries(dictionary)) {
      filtered[key] = entries.filter(entry => enabledDicts.includes(entry.dictionaryName));
      if (filtered[key].length === 0) {
        delete filtered[key];
      }
    }
    return filtered;
  }
  
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "getFilteredDictionary") {
        chrome.storage.local.get('dictionaries', result => {
          const dictionaries = result.dictionaries || {};
          const mergedDictionary = Object.values(dictionaries).reduce(mergeDictionaries, {});
          const filteredDictionary = filterDictionary(mergedDictionary, request.activeDictionaries);
          sendResponse({ filteredDictionary: filteredDictionary });
        });
        return true; // Indicates that the response will be sent asynchronously
      }
    else if (request.action === "loadDictionary") {
      const csvContent = request.data;
      const dictionaryName = request.name;
      const rows = csvContent.trim().split('\n');
      const newEntries = {};
  
      for (const row of rows) {
        const [word, ...translationParts] = row.split(',').map(item => item.trim());
        const translationEntry = translationParts.join(',').replace(/^"|"$/g, '');
  
        if (word && translationEntry) {
          const normalizedWord = word.toLowerCase().replace(/[^a-z\s]/g, '');
          const variations = [normalizedWord];
          
          // Add variations for bigrams and trigrams
          const words = normalizedWord.split(' ');
          if (words.length > 1) {
            variations.push(words.join('_'));
          }
  
          for (const variation of variations) {
            if (!newEntries[variation]) {
              newEntries[variation] = [];
            }
            newEntries[variation].push({ word, translationEntry, dictionaryName });
          }
        }
      }
  
      chrome.storage.local.get(['dictionaries', 'dictionaryList'], function(result) {
        const existingDictionaries = result.dictionaries || {};
        const dictionaryList = result.dictionaryList || [];
  
        existingDictionaries[dictionaryName] = newEntries;
        if (!dictionaryList.some(dict => dict.name === dictionaryName)) {
          dictionaryList.push({ name: dictionaryName, enabled: true });
        }
  
        const mergedDictionary = Object.values(existingDictionaries).reduce(mergeDictionaries, {});
        const enabledDicts = dictionaryList.filter(dict => dict.enabled).map(dict => dict.name);
        const filteredDictionary = filterDictionary(mergedDictionary, enabledDicts);
  
        chrome.storage.local.set({ 
          dictionaries: existingDictionaries,
          dictionary: filteredDictionary,
          dictionaryList: dictionaryList 
        }, function() {
          sendResponse({ message: "Dictionary updated successfully!" });
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "dictionaryUpdated"});
          });
        });
      });
  
      return true; // Indicates that the response will be sent asynchronously
    } else if (request.action === "toggleDictionary") {
      chrome.storage.local.get(['dictionaries', 'dictionaryList'], function(result) {
        const dictionaries = result.dictionaries || {};
        const dictionaryList = result.dictionaryList || [];
        
        const updatedList = dictionaryList.map(dict => {
          if (dict.name === request.name) {
            dict.enabled = !dict.enabled;
          }
          return dict;
        });
  
        const enabledDicts = updatedList.filter(dict => dict.enabled).map(dict => dict.name);
        const mergedDictionary = Object.values(dictionaries).reduce(mergeDictionaries, {});
        const filteredDictionary = filterDictionary(mergedDictionary, enabledDicts);
  
        chrome.storage.local.set({ 
          dictionary: filteredDictionary,
          dictionaryList: updatedList 
        }, function() {
          sendResponse({ message: "Dictionary toggled successfully!" });
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "dictionaryUpdated"});
          });
        });
      });
  
      return true;
    } else if (request.action === "removeDictionary") {
      chrome.storage.local.get(['dictionaries', 'dictionaryList'], function(result) {
        const dictionaries = result.dictionaries || {};
        const dictionaryList = result.dictionaryList || [];
        
        delete dictionaries[request.name];
        const updatedList = dictionaryList.filter(dict => dict.name !== request.name);
        
        const enabledDicts = updatedList.filter(dict => dict.enabled).map(dict => dict.name);
        const mergedDictionary = Object.values(dictionaries).reduce(mergeDictionaries, {});
        const filteredDictionary = filterDictionary(mergedDictionary, enabledDicts);
  
        chrome.storage.local.set({ 
          dictionaries: dictionaries,
          dictionary: filteredDictionary,
          dictionaryList: updatedList 
        }, function() {
          sendResponse({ message: "Dictionary removed successfully!" });
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "dictionaryUpdated"});
          });
        });
      });
  
      return true;
    } else if (request.action === "updateKeywords") {
    chrome.storage.local.get('dictionaryList', function(result) {
      const dictionaryList = result.dictionaryList || [];
      
      const updatedList = dictionaryList.map(dict => {
        if (dict.name === request.name) {
          dict.keywords = request.keywords;
        }
        return dict;
      });

      chrome.storage.local.set({ 
        dictionaryList: updatedList 
      }, function() {
        sendResponse({ message: "Keywords updated successfully!" });
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, {action: "dictionaryUpdated"});
        });
      });
    });

    return true;
  }

  });

  chrome.webNavigation.onCompleted.addListener(details => {
    if (details.frameId === 0) { // Only for main frame
      chrome.tabs.sendMessage(details.tabId, { action: "pageLoaded" });
    }
  });
  
  // Initialize the dictionary from the default CSV file if it doesn't exist
  chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.local.get(['dictionaries', 'dictionaryList'], function(result) {
      if (!result.dictionaries || !result.dictionaries.default) {
        fetch(chrome.runtime.getURL('dictionary.csv'))
          .then(response => response.text())
          .then(csv => {
            const rows = csv.trim().split('\n');
            const defaultDictionary = {};
  
            for (const row of rows) {
              const [word, ...translationParts] = row.split(',').map(item => item.trim());
              const translationEntry = translationParts.join(',').replace(/^"|"$/g, '');
  
              if (word && translationEntry) {
                const normalizedWord = word.toLowerCase().replace(/[^a-z\s]/g, '');
                const variations = [normalizedWord];
                
                // Add variations for bigrams and trigrams
                const words = normalizedWord.split(' ');
                if (words.length > 1) {
                  variations.push(words.join('_'));
                }
  
                for (const variation of variations) {
                  if (!defaultDictionary[variation]) {
                    defaultDictionary[variation] = [];
                  }
                  defaultDictionary[variation].push({ word, translationEntry, dictionaryName: 'default' });
                }
              }
            }
  
            chrome.storage.local.set({ 
              dictionaries: { default: defaultDictionary },
              dictionary: defaultDictionary,
              dictionaryList: [{ name: 'default', enabled: true }]
            });
          });
      }
    });
  });