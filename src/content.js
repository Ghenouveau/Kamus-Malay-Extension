// content.js

/**
 * Loads the dictionary from the dictionary.csv file.
 * @returns {Promise<Object>} A Promise that resolves with the dictionary object.
 */
async function loadDictionary() {
  const dictionaryUrl = chrome.runtime.getURL('dictionary.csv');
  const response = await fetch(dictionaryUrl);
  const csv = await response.text();

  const dictionary = {};
  const rows = csv.trim().split('\n');

  for (const row of rows) {
    const [word, translation, pronunciation, meaning] = row.split(',').map(item => item.trim().replace(/^"|"$/g, ''));

    if (word && translation) {
      const normalizedWord = word.toLowerCase().replace(/[^a-z]/g, '');
      const variations = [
        normalizedWord, // Normalized word
        `${normalizedWord}s`, // Plural form
      ];

      for (const variation of variations) {
        if (!dictionary[variation]) {
          dictionary[variation] = [];
        }

        dictionary[variation].push({ translation, pronunciation, meaning });
      }
    }
  }

  return dictionary;
}

/**
 * Creates a translation popup at the specified coordinates.
 * @param {Array} entries The dictionary entries for the selected word.
 * @param {string} word The selected English word.
 * @param {number} x The x-coordinate of the popup position.
 * @param {number} y The y-coordinate of the popup position.
 */
function createPopup(entries, word, stemmedPart, x, y) {
  const popup = document.createElement('div');
  popup.className = 'translation-popup';

  const wordElement = document.createElement('div');
  wordElement.classList.add('word');
  wordElement.textContent = word;
  popup.appendChild(wordElement);

  for (const entry of entries) {
    const entryElement = document.createElement('div');
    entryElement.classList.add('entry');

    const translationElement = document.createElement('div');
    translationElement.classList.add('translation');
    translationElement.textContent = entry.translation;

    const pronunciationElement = document.createElement('div');
    pronunciationElement.classList.add('pronunciation');
    pronunciationElement.textContent = entry.pronunciation || '';

    const meaningElement = document.createElement('div');
    meaningElement.classList.add('meaning');
    meaningElement.textContent = entry.meaning || '';

    entryElement.appendChild(translationElement);
    entryElement.appendChild(pronunciationElement);
    entryElement.appendChild(meaningElement);

    popup.appendChild(entryElement);
  }

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

loadDictionary()
  .then(dictionary => {
    document.addEventListener('dblclick', event => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim().toLowerCase().replace(/[^a-z]/g, '');

      if (dictionary.hasOwnProperty(selectedText)) {
        const entries = dictionary[selectedText];
        const word = selection.toString().trim();
        createPopup(entries, word, null, event.pageX, event.pageY);
      } else {
        // Use Porter stemmer as a fallback
        const stemmedWord = stemmer(selectedText);
        if (dictionary.hasOwnProperty(stemmedWord)) {
          const entries = dictionary[stemmedWord];
          const word = selection.toString().trim();
          const stemmedPart = selectedText.slice(stemmedWord.length);
          createPopup(entries, word, stemmedPart, event.pageX, event.pageY);
        }
      }
    });
  })
  .catch(error => {
    console.error('Error loading dictionary:', error);
  });