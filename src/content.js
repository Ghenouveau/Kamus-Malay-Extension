// content.js

async function loadDictionary() {
  const dictionaryUrl = chrome.runtime.getURL('dictionary.csv');
  const response = await fetch(dictionaryUrl);
  const csv = await response.text();

  const dictionary = {};
  const rows = csv.trim().split('\n');

  for (const row of rows) {
    const [word, ...translationParts] = row.split(',').map(item => item.trim());
    const translationEntry = translationParts.join(',').replace(/^"|"$/g, '');

    if (word && translationEntry) {
      const normalizedWord = word.toLowerCase().replace(/[^a-z]/g, '');
      const variations = [
        normalizedWord, // Normalized word
        `${normalizedWord}s`, // Plural form
      ];

      for (const variation of variations) {
        if (!dictionary[variation]) {
          dictionary[variation] = [];
        }

        dictionary[variation].push({ word, translationEntry });
      }
    }
  }

  return dictionary;
}

function createPopup(entry, selectedWord, shouldHighlight, x, y) {
  const { word, translationEntry } = entry;

  const popup = document.createElement('div');
  popup.className = 'translation-popup';

  const wordElement = document.createElement('div');
  wordElement.classList.add('word');
  wordElement.textContent = word;
  popup.appendChild(wordElement);

  const translationElement = document.createElement('div');
  translationElement.classList.add('translation');

  if (shouldHighlight && translationEntry.includes(selectedWord)) {
    const parts = translationEntry.split(selectedWord);
    translationElement.innerHTML = parts.join(`<span class="highlight">${selectedWord}</span>`);
  } else {
    translationElement.textContent = translationEntry;
  }

  popup.appendChild(translationElement);

  document.body.appendChild(popup);

  const popupRect = popup.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Adjust x-coordinate if popup exceeds viewport width
  if (x + popupRect.width > viewportWidth) {
    x = viewportWidth - popupRect.width;
  }

  // Adjust y-coordinate if popup exceeds viewport height
  if (y - popupRect.height < 0) {
    y = popupRect.height;
  }

  popup.style.left = `${x}px`;
  popup.style.top = `${y - popupRect.height}px`;
  popup.style.zIndex = '999999';

  popup.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', () => popup.remove());
}

function correctStemmedWord(stemmedWord, dictionary) {
  const vowels = ['a', 'e', 'i', 'o', 'u'];
  
  for (const vowel of vowels) {
    const correctedWord = stemmedWord + vowel;
    if (dictionary.hasOwnProperty(correctedWord)) {
      return correctedWord;
    }
  }
  
  return null;
}

loadDictionary()
  .then(dictionary => {
    document.addEventListener('dblclick', event => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim().toLowerCase().replace(/[^a-z]/g, '');

      // First try: Look for the word in column1
      if (dictionary.hasOwnProperty(selectedText)) {
        const entries = dictionary[selectedText];
        const selectedWord = selection.toString().trim();
        createPopup(entries[0], selectedWord, false, event.pageX, event.pageY);
      } else {
        // Second try: Use stemming and look in column1
        const stemmedWord = stemmer(selectedText);
        if (dictionary.hasOwnProperty(stemmedWord)) {
          const entries = dictionary[stemmedWord];
          const selectedWord = selection.toString().trim();
          createPopup(entries[0], selectedWord, false, event.pageX, event.pageY);
        } else {
          // Third try: Look for the word in column2
          const column2Entries = Object.values(dictionary).flat();
          const matchingEntry = column2Entries.find(entry => entry.translationEntry.includes(selectedText));

          if (matchingEntry) {
            const selectedWord = selection.toString().trim();
            createPopup(matchingEntry, selectedWord, true, event.pageX, event.pageY);
          } else {
            // Fourth try: Correct the stemmed word and look in column1
            const correctedWord = correctStemmedWord(stemmedWord, dictionary);
            if (correctedWord) {
              const entries = dictionary[correctedWord];
              const selectedWord = selection.toString().trim();
              createPopup(entries[0], selectedWord, false, event.pageX, event.pageY);
            }
          }
        }
      }
    });
  })
  .catch(error => {
    console.error('Error loading dictionary:', error);
  });