// content.js

let dictionary = {};

async function loadDictionary() {
  return new Promise((resolve) => {
    chrome.storage.local.get('dictionary', function(result) {
      if (result.dictionary && Object.keys(result.dictionary).length > 0) {
        dictionary = result.dictionary;
        console.log('Dictionary loaded:', Object.keys(dictionary).length, 'entries');
        resolve();
      } else {
        console.log('No dictionary found, waiting for background script to initialize');
        resolve();
      }
    });
  });
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

  const uniqueMeanings = new Set();
  const meanings = entries.map(entry => {
    const capitalizedTranslationEntry = entry.translationEntry.charAt(0).toUpperCase() + entry.translationEntry.slice(1);

    if (!uniqueMeanings.has(capitalizedTranslationEntry)) {
      uniqueMeanings.add(capitalizedTranslationEntry);

      let content = '';
      if (entry.dictionaryName && entry.dictionaryName !== 'default') {
        content += `<span class="dictionary-name" style="color: ${getColorForDictionary(entry.dictionaryName)};">${entry.dictionaryName}</span><br>`;
      }

      if (shouldHighlight) {
        const lowercaseTranslationEntry = capitalizedTranslationEntry.toLowerCase();
        const lowercaseSelectedWord = selectedWord.toLowerCase();
        const parts = lowercaseTranslationEntry.split(lowercaseSelectedWord);
        content += parts.join(`<span class="highlight">${lowercaseSelectedWord}</span>`);
      } else {
        content += capitalizedTranslationEntry;
      }

      return content;
    }
    return null;
  }).filter(meaning => meaning !== null);

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

  const closePopup = () => {
    popup.remove();
    document.removeEventListener('click', closePopup);
    document.removeEventListener('keydown', closePopup);
  };
  
  document.addEventListener('click', closePopup);
  document.addEventListener('keydown', closePopup);
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

    const uniqueMeanings = new Set();
    const meanings = entries.map(entry => {
      const capitalizedTranslationEntry = entry.translationEntry.charAt(0).toUpperCase() + entry.translationEntry.slice(1);
      if (!uniqueMeanings.has(capitalizedTranslationEntry)) {
        uniqueMeanings.add(capitalizedTranslationEntry);
        return capitalizedTranslationEntry;
      }
      return null;
    }).filter(meaning => meaning !== null);

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

  const closePopup = () => {
    popup.remove();
    document.removeEventListener('click', closePopup);
    document.removeEventListener('keydown', closePopup);
  };

  document.addEventListener('click', closePopup);
  document.addEventListener('keydown', closePopup);
}

function getColorForDictionary(dictionaryName) {
  // Generate a color based on the dictionary name
  let hash = 0;
  for (let i = 0; i < dictionaryName.length; i++) {
    hash = dictionaryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = `hsl(${hash % 360}, 70%, 45%)`;
  return color;
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

function findMatches(selectedText) {
  const normalizedText = selectedText.toLowerCase().replace(/[^a-z\s]/g, '');
  const words = normalizedText.split(/\s+/);
  const matches = [];

  // Check for exact matches (including bigrams and trigrams)
  if (words.length > 1 && words.every(w => w.length >= 4)) {
    const phrase = words.join('_');
    if (dictionary[phrase]) {
      return [{ type: 'exact', words: words, entries: dictionary[phrase] }];
    }
  }

  // If no exact multi-word match, proceed with the existing logic
  if (dictionary.hasOwnProperty(normalizedText)) {
    return [{ type: 'exact', words: [normalizedText], entries: dictionary[normalizedText] }];
  } else {
    // Use stemming and look in column1
    const stemmedWord = stemmer(normalizedText);
    if (dictionary.hasOwnProperty(stemmedWord)) {
      return [{ type: 'stemmed', words: [normalizedText], entries: dictionary[stemmedWord] }];
    } else {
      // Look for the word in column2
      const column2Entries = Object.values(dictionary).flat();
      const matchingEntry = column2Entries.find(entry => entry.translationEntry.toLowerCase().includes(normalizedText));

      if (matchingEntry) {
        return [{ type: 'translation', words: [normalizedText], entries: [matchingEntry] }];
      } else {
        // Correct the stemmed word and look in column1
        const correctedWord = correctStemmedWord(stemmedWord, dictionary);
        if (correctedWord) {
          return [{ type: 'corrected', words: [normalizedText], entries: dictionary[correctedWord] }];
        } else {
          // Look for a combination of partial word matches
          return findPartialMatches(normalizedText);
        }
      }
    }
  }
}

function findPartialMatches(normalizedText) {
  const words = Object.keys(dictionary).sort((a, b) => b.length - a.length);
  const matchedWords = [];
  let remainingText = normalizedText;

  while (remainingText.length > 0 && matchedWords.length < 3) {
    let matchFound = false;

    for (const word of words) {
      const stemmedWord = word.endsWith('s') ? word.slice(0, -1) : word;

      if (remainingText.startsWith(stemmedWord) && stemmedWord.length >= 4) {
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

  if (matchedWords.length > 1 && matchedWords.length <= 3 && matchedWords.every(w => w.length >= 4)) {
    return matchedWords.map(word => ({ type: 'partial', words: [word], entries: dictionary[word] }));
  }

  return [];
}


loadDictionary().then(() => {
  console.log('Dictionary loaded, adding event listener');
  document.addEventListener('dblclick', handleDoubleClick);
});

function handleDoubleClick(event) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  console.log('Selected text:', selectedText);

  if (selectedText.length === 0 || !/^[a-zA-Z\s]+$/.test(selectedText)) {
    console.log('Invalid selection, ignoring');
    return;
  }

  const matches = findMatches(selectedText);

  console.log('Matches found:', matches);

  if (matches.length > 0) {
    if (matches.length === 1) {
      console.log('Creating single match popup');
      createPopup(matches[0].entries, selectedText, matches[0].type === 'stemmed' || matches[0].type === 'translation', event.pageX, event.pageY);
    } else {
      console.log('Creating combination popup');
      createCombinationPopup(matches.map(m => m.words[0]), dictionary, selectedText, event.pageX, event.pageY);
    }
  } else {
    console.log('No matches found');
  }
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "dictionaryUpdated") {
    console.log('Dictionary update received, reloading');
    loadDictionary();
  }
});