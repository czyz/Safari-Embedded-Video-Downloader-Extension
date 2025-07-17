console.log("Hello World!", browser);

// Popup script for YouTube Video Controller
document.addEventListener('DOMContentLoaded', function() {
    const statusText = document.getElementById('status-text');
    const cookiesBrowserSelect = document.getElementById('cookies-browser');
    const saveSettingsButton = document.getElementById('save-settings');
    
    // Load saved settings
    loadSettings();
    
    // Save settings when button is clicked
    saveSettingsButton.addEventListener('click', saveSettings);
    
    function loadSettings() {
        browser.storage.local.get(['cookiesBrowser']).then((result) => {
            if (result.cookiesBrowser) {
                cookiesBrowserSelect.value = result.cookiesBrowser;
            } else {
                // Default to safari
                cookiesBrowserSelect.value = 'safari';
            }
        }).catch((error) => {
            console.error('Error loading settings:', error);
            // Default to safari on error
            cookiesBrowserSelect.value = 'safari';
        });
    }
    
    function saveSettings() {
        const cookiesBrowser = cookiesBrowserSelect.value;
        
        browser.storage.local.set({
            cookiesBrowser: cookiesBrowser
        }).then(() => {
            // Show success message
            const originalText = saveSettingsButton.textContent;
            saveSettingsButton.textContent = 'Saved!';
            saveSettingsButton.style.background = '#28a745';
            
            setTimeout(() => {
                saveSettingsButton.textContent = originalText;
                saveSettingsButton.style.background = '#007bff';
            }, 2000);
        }).catch((error) => {
            console.error('Error saving settings:', error);
            // Show error message
            const originalText = saveSettingsButton.textContent;
            saveSettingsButton.textContent = 'Error!';
            saveSettingsButton.style.background = '#dc3545';
            
            setTimeout(() => {
                saveSettingsButton.textContent = originalText;
                saveSettingsButton.style.background = '#007bff';
            }, 2000);
        });
    }
    
    // Check if we're on a page where the extension can work
    browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
        const currentTab = tabs[0];
        
        if (currentTab && currentTab.url) {
            // Check if the current page is a web page (not chrome://, about:, etc.)
            if (currentTab.url.startsWith('http://') || currentTab.url.startsWith('https://')) {
                statusText.textContent = 'Extension is active on this page';
                statusText.style.color = '#155724';
            } else {
                statusText.textContent = 'Extension only works on web pages';
                statusText.style.color = '#856404';
            }
        } else {
            statusText.textContent = 'Unable to detect current page';
            statusText.style.color = '#721c24';
        }
    }).catch(error => {
        console.error('Error checking tab:', error);
        statusText.textContent = 'Error checking page status';
        statusText.style.color = '#721c24';
    });
});
