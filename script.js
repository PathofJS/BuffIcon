document.addEventListener('DOMContentLoaded', async function() {
    const imageGallery = document.getElementById('imageGallery');
    const keywordFilterContainer = document.getElementById('keywordFilterContainer');
    const iconSearchInput = document.getElementById('iconSearchInput');
    const clearSearchButton = document.getElementById('clearSearchButton');
    const stickyHeader = document.getElementById('stickyHeader');
    const headerSpacer = document.getElementById('headerSpacer');
    const themeToggleButton = document.createElement('button'); // New: Theme toggle button

    let allImageData = [];

    // Function to set the height of the spacer div dynamically
    function setSpacerHeight() {
        const headerHeight = stickyHeader.offsetHeight;
        headerSpacer.style.height = `${headerHeight}px`;
    }

    // Function to fetch and process icon data from JSONs
    async function fetchAndMergeBuffData() {
        try {
            const [visualsResponse, definitionsResponse] = await Promise.all([
                fetch('BuffVisuals.json'),
                fetch('BuffDefinitions.json')
            ]);

            if (!visualsResponse.ok) {
                throw new Error(`HTTP error! status: ${visualsResponse.status} for BuffVisuals.json`);
            }
            if (!definitionsResponse.ok) {
                throw new Error(`HTTP error! status: ${definitionsResponse.status} for BuffDefinitions.json`);
            }

            const visualsData = await visualsResponse.json();
            const definitionsData = await definitionsResponse.json();

            const definitionsMap = new Map();
            definitionsData.forEach(def => {
                if (def.Id) {
                    definitionsMap.set(def.Id.toLowerCase(), def);
                }
            });

            const mergedData = visualsData.filter(function(item) {
                return item.BuffDDSFile !== "" && item.Id;
            }).map(function(item) {
                const fileName = item.BuffDDSFile.split('/').pop().replace('.dds', '');
                const definition = definitionsMap.get(item.Id.toLowerCase());

                const displayName = definition && definition.Name ? definition.Name : fileName;
                const displayDescription = definition ? definition.Description : 'No description available.';
                
                const searchableText = `${displayName.toLowerCase()} ${displayDescription.toLowerCase()} ${fileName.toLowerCase()}`;

                return {
                    src: `icons/${fileName}.png`, // From remembered instruction: .png in icons/ folder
                    alt: item.Id,
                    displayName: displayName,
                    displayDescription: displayDescription,
                    filename: fileName.toLowerCase(),
                    searchableText: searchableText
                };
            });
            return mergedData;

        } catch (error) {
            console.error("Error fetching or merging buff data:", error);
            imageGallery.innerHTML = `<p class="error-message">Failed to load buff data: ${error.message}</p>`;
            return [];
        }
    }

    async function processImage(icon) {
        return new Promise(function(resolve, reject) {
            const img = new Image();
            img.src = icon.src;

            img.onload = function() {
                resolve({
                    src: icon.src,
                    alt: icon.alt,
                    displayName: icon.displayName,
                    displayDescription: icon.displayDescription,
                    filename: icon.filename,
                    searchableText: icon.searchableText
                });
            };

            img.onerror = function() {
                console.error(`Failed to load image: ${icon.src} - Check file existence, path, and permissions.`);
                reject(`Failed to load image: ${icon.src}`);
            };
        });
    }

    async function loadAndAnalyzeImages() {
        imageGallery.innerHTML = '<p>Loading buffs... <span class="loading-spinner"></span></p>';
        
        const iconsToProcess = await fetchAndMergeBuffData();

        if (iconsToProcess.length === 0) {
            imageGallery.innerHTML = '<p class="error-message">No valid icons found to process.</p>';
            return;
        }

        try {
            const results = await Promise.allSettled(iconsToProcess.map(processImage));
            
            const successfullyProcessedImages = results
                .filter(function(result) { return result.status === 'fulfilled'; })
                .map(function(result) { return result.value; });

            const uniqueImageDataMap = new Map();
            successfullyProcessedImages.forEach(imageData => {
                if (!uniqueImageDataMap.has(imageData.src)) {
                    uniqueImageDataMap.set(imageData.src, imageData);
                }
            });
            allImageData = Array.from(uniqueImageDataMap.values());

            if (allImageData.length === 0) {
                imageGallery.innerHTML = '<p class="error-message">No icons could be successfully processed or all were duplicates. Check console for errors.</p>';
                return;
            }

            setupKeywordFilters();
            displayImages(allImageData, imageGallery);
            setSpacerHeight(); // Set spacer height after all content (including keyword filters) is rendered
        } catch (error) {
            imageGallery.innerHTML = `<p class="error-message">An error occurred during image loading: ${error}</p>`;
        }
    }

    function setupKeywordFilters() {
        const keywords = ['Flask', 'Tincture', 'Aura', 'Banner', 'Blood', 'Chaos', 'Azmeri', 'Charge', 'Herald', 'Fire', 'Tempest', 'Curse', 'Shield', 'Monster', 'Shrine'];
        keywordFilterContainer.innerHTML = '';

        const filterTitle = document.createElement('p');
        filterTitle.textContent = 'Filter by Keywords:';
        keywordFilterContainer.appendChild(filterTitle);

        keywords.forEach(keyword => {
            const label = document.createElement('label');
            label.className = 'keyword-label';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = keyword.toLowerCase();
            checkbox.id = `keyword-${keyword.toLowerCase()}`;
            checkbox.addEventListener('change', () => {
                applyFilters();
                setSpacerHeight(); // Recalculate spacer height if filter content might change header height
            });

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(keyword));
            keywordFilterContainer.appendChild(label);
        });

        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear Keyword Filters';
        clearButton.classList.add('clear-filter-button');
        clearButton.onclick = () => {
            document.querySelectorAll('#keywordFilterContainer input[type="checkbox"]').forEach(cb => cb.checked = false);
            applyFilters();
            setSpacerHeight(); // Recalculate spacer height
        };
        keywordFilterContainer.appendChild(clearButton);
        setSpacerHeight(); // Also call here in case filters cause a layout shift
    }

    function applyFilters() {
        const searchQuery = iconSearchInput.value.toLowerCase().trim();
        const selectedKeywords = Array.from(document.querySelectorAll('#keywordFilterContainer input[type="checkbox"]:checked'))
                                         .map(cb => cb.value);

        let filteredImages = allImageData.filter(imageData => {
            const matchesSearch = searchQuery === '' || imageData.searchableText.includes(searchQuery);
            // This ensures that ALL selected keywords are present in the searchableText
            const matchesKeywords = selectedKeywords.length === 0 || 
                                    selectedKeywords.every(selectedKw => imageData.searchableText.includes(selectedKw));
            return matchesSearch && matchesKeywords;
        });
        
        displayImages(filteredImages, imageGallery);
        toggleClearSearchButton();
    }

    function displayImages(imagesToDisplay, containerElement) {
        containerElement.innerHTML = '';
        if (imagesToDisplay.length === 0) {
            containerElement.innerHTML = '<p>No icons to display based on current filters.</p>';
            return;
        }

        imagesToDisplay.forEach(function(imageData) {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('image-item');

            const imgElement = document.createElement('img');
            imgElement.src = imageData.src;
            imgElement.alt = imageData.alt;
            itemDiv.appendChild(imgElement);

            const nameP = document.createElement('p');
            nameP.classList.add('icon-name');
            nameP.textContent = imageData.displayName;
            itemDiv.appendChild(nameP);

            if (imageData.displayDescription) {
                const descP = document.createElement('p');
                descP.classList.add('icon-description');
                descP.textContent = imageData.displayDescription;
                itemDiv.appendChild(descP);
            }

            containerElement.appendChild(itemDiv);
        });
    }

    iconSearchInput.addEventListener('input', applyFilters);

    function toggleClearSearchButton() {
        if (iconSearchInput.value.length > 0) {
            clearSearchButton.style.display = 'block';
        } else {
            clearSearchButton.style.display = 'none';
        }
    }

    clearSearchButton.addEventListener('click', () => {
        iconSearchInput.value = '';
        applyFilters();
    });

    toggleClearSearchButton();

    // Dark mode toggle functionality
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        // Store user preference in local storage
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
            themeToggleButton.textContent = 'Light Mode 💡';
        } else {
            localStorage.setItem('theme', 'light');
            themeToggleButton.textContent = 'Dark Mode 🌙';
        }
    }

    // Set initial theme based on local storage or system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-mode');
        themeToggleButton.textContent = 'Light Mode 💡';
    } else {
        themeToggleButton.textContent = 'Dark Mode 🌙';
    }

    // Add theme toggle button and title to a flexible container in the header
    themeToggleButton.classList.add('theme-toggle-button');
    themeToggleButton.addEventListener('click', toggleDarkMode);
    
    const headerTitleAndToggleContainer = document.createElement('div');
    headerTitleAndToggleContainer.style.display = 'flex';
    headerTitleAndToggleContainer.style.justifyContent = 'space-between';
    headerTitleAndToggleContainer.style.alignItems = 'center';
    headerTitleAndToggleContainer.style.width = '100%'; // Ensure it takes full width

    const h1Element = document.createElement('h1');
    h1Element.textContent = 'PoE Buff Icons';
    headerTitleAndToggleContainer.appendChild(h1Element);
    headerTitleAndToggleContainer.appendChild(themeToggleButton);

    // Insert this new container at the top of the sticky header
    stickyHeader.prepend(headerTitleAndToggleContainer);

    // Initial call to load and analyze images
    loadAndAnalyzeImages();

    // Add a resize listener to adjust spacer height if window size changes (which might affect header height)
    window.addEventListener('resize', setSpacerHeight);
});