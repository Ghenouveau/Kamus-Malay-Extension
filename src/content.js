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

function createPopup(entries, selectedWord, shouldHighlight, x, y) {
  const popup = document.createElement('div');
  popup.className = 'kamus-translation-popup';

  const wordElement = document.createElement('div');
  wordElement.classList.add('word');
  wordElement.textContent = entries[0].word.charAt(0).toUpperCase() + entries[0].word.slice(1);
  popup.appendChild(wordElement);

  const translationElement = document.createElement('div');
  translationElement.classList.add('translation');

  const meanings = entries.map(entry => {
    const capitalizedTranslationEntry = entry.translationEntry.charAt(0).toUpperCase() + entry.translationEntry.slice(1);

    if (shouldHighlight) {
      const lowercaseTranslationEntry = capitalizedTranslationEntry.toLowerCase();
      const lowercaseSelectedWord = selectedWord.toLowerCase();
      const parts = lowercaseTranslationEntry.split(lowercaseSelectedWord);
      return parts.join(`<br><br><span class="highlight">${lowercaseSelectedWord}</span>`);
    } else {
      return capitalizedTranslationEntry;
    }
  });

  translationElement.innerHTML = meanings.join('<br><br>');
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

function createCombinationPopup(matchedWords, dictionary, selectedWord, x, y) {
  const popup = document.createElement('div');
  popup.className = 'kamus-translation-popup';

  const wordElement = document.createElement('div');
  wordElement.classList.add('word');

  const formattedWordParts = matchedWords.map(word => {
    const stemmedWord = word.endsWith('s') ? word.slice(0, -1) : word;
    const partialWord = selectedWord.substr(selectedWord.toLowerCase().indexOf(stemmedWord), stemmedWord.length);
    return partialWord.charAt(0).toUpperCase() + partialWord.slice(1);
  });

  wordElement.textContent = formattedWordParts.join(' + ');
  popup.appendChild(wordElement);

  matchedWords.forEach((word, index) => {
    const entries = dictionary[word];

    const wordTitleElement = document.createElement('div');
    wordTitleElement.classList.add('word-title');
    wordTitleElement.textContent = formattedWordParts[index];
    popup.appendChild(wordTitleElement);

    const translationElement = document.createElement('div');
    translationElement.classList.add('translation');

    const meanings = entries.map(entry => {
      const capitalizedTranslationEntry = entry.translationEntry.charAt(0).toUpperCase() + entry.translationEntry.slice(1);
      return capitalizedTranslationEntry;
    });

    translationElement.innerHTML = meanings.join('<br><br>');
    popup.appendChild(translationElement);

    if (index < matchedWords.length - 1) {
      const separator = document.createElement('div');
      separator.classList.add('separator');
      popup.appendChild(separator);
    }
  });

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
      const selectedText = selection.toString().trim();

      if (selectedText.split(' ').length > 1) {
        return;
      }

      if (!/^[a-zA-Z]+$/.test(selectedText)) {
        return;
      }

      const normalizedText = selectedText.toLowerCase().replace(/[^a-z]/g, '');

      // First try: Look for the word in column1
      if (dictionary.hasOwnProperty(normalizedText)) {
        const entries = dictionary[normalizedText];
        createPopup(entries, selectedText, false, event.pageX, event.pageY);
      } else {
        // Second try: Use stemming and look in column1
        const stemmedWord = stemmer(normalizedText);
        if (dictionary.hasOwnProperty(stemmedWord)) {
          const entries = dictionary[stemmedWord];
          createPopup(entries, selectedText, false, event.pageX, event.pageY);
        } else {
          // Third try: Look for the word in column2
          const column2Entries = Object.values(dictionary).flat();
          const matchingEntry = column2Entries.find(entry => entry.translationEntry.toLowerCase().includes(normalizedText));

          if (matchingEntry) {
            createPopup([matchingEntry], selectedText, true, event.pageX, event.pageY);
          } else {
            // Fourth try: Correct the stemmed word and look in column1
            const correctedWord = correctStemmedWord(stemmedWord, dictionary);
            if (correctedWord) {
              const entries = dictionary[correctedWord];
              createPopup(entries, selectedText, false, event.pageX, event.pageY);
            } else {
              // Fifth try: Look for a combination of partial word matches
              const words = Object.keys(dictionary).sort((a, b) => b.length - a.length);
              const matchedWords = [];
              let remainingText = normalizedText;

              while (remainingText.length > 0 && matchedWords.length < 3) {
                let matchFound = false;

                for (const word of words) {
                  const stemmedWord = word.endsWith('s') ? word.slice(0, -1) : word;

                  if (remainingText.startsWith(stemmedWord)) {
                    matchedWords.push(word);
                    remainingText = remainingText.slice(stemmedWord.length);
                    matchFound = true;
                    break;
                  }
                }

                if (!matchFound) {
                  break;
                }
              }

              if (matchedWords.length > 1 && matchedWords.length <= 3) {
                createCombinationPopup(matchedWords, dictionary, selectedText, event.pageX, event.pageY);
              }
            }
          }
        }
      }
    });
  })
  .catch(error => {
    console.error('Error loading dictionary:', error);
  });