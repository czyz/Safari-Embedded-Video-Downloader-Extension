browser.runtime.sendMessage({ greeting: "hello" }).then((response) => {
    console.log("Received response: ", response);
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received request: ", request);
});

// YouTube Video Detector and Controller
(function() {
    'use strict';

    // Function to copy text to clipboard
    function copyToClipboard(text) {
        return new Promise((resolve) => {
            // Try modern clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    resolve(true);
                }).catch((error) => {
                    console.error('Modern clipboard API failed:', error);
                    // Fall back to execCommand method
                    resolve(fallbackCopyToClipboard(text));
                });
            } else {
                // Use fallback method
                resolve(fallbackCopyToClipboard(text));
            }
        });
    }

    // Fallback clipboard copy method using document.execCommand
    function fallbackCopyToClipboard(text) {
        try {
            // Create a temporary textarea element
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-999999px';
            textarea.style.top = '-999999px';
            textarea.style.opacity = '0';
            textarea.style.pointerEvents = 'none';
            textarea.style.zIndex = '-1000';
            textarea.setAttribute('readonly', '');
            textarea.setAttribute('tabindex', '-1');
            document.body.appendChild(textarea);
            
            // Try multiple selection methods
            let successful = false;
            
            try {
                // Method 1: Standard selection
                textarea.focus();
                textarea.select();
                textarea.setSelectionRange(0, 99999);
                successful = document.execCommand('copy');
            } catch (e1) {
                console.log('Method 1 failed, trying method 2');
                try {
                    // Method 2: Select all
                    textarea.select();
                    successful = document.execCommand('copy');
                } catch (e2) {
                    console.log('Method 2 failed, trying method 3');
                    try {
                        // Method 3: Direct copy without focus
                        successful = document.execCommand('copy');
                    } catch (e3) {
                        console.log('Method 3 failed');
                    }
                }
            }
            
            // Clean up
            document.body.removeChild(textarea);
            
            return successful;
        } catch (error) {
            console.error('Fallback clipboard copy error:', error);
            return false;
        }
    }

    // Function to show a user-friendly modal with the command for manual copy
    function showCommandFallback(command) {
        // Remove any existing modal
        const existing = document.getElementById('video-command-fallback-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'video-command-fallback-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.7)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '99999';

        const box = document.createElement('div');
        box.style.background = '#2d3748';
        box.style.color = 'white';
        box.style.padding = '24px 20px 16px 20px';
        box.style.borderRadius = '8px';
        box.style.boxShadow = '0 2px 16px rgba(0,0,0,0.4)';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.alignItems = 'center';
        box.style.maxWidth = '90vw';
        box.style.minWidth = '320px';

        const label = document.createElement('div');
        label.textContent = 'Copy this command:';
        label.style.marginBottom = '10px';
        label.style.fontWeight = 'bold';
        label.style.fontSize = '15px';
        box.appendChild(label);

        const textarea = document.createElement('textarea');
        textarea.value = command;
        textarea.readOnly = true;
        textarea.style.width = '100%';
        textarea.style.minWidth = '260px';
        textarea.style.maxWidth = '500px';
        textarea.style.height = '60px';
        textarea.style.fontSize = '13px';
        textarea.style.background = '#1a202c';
        textarea.style.color = 'white';
        textarea.style.border = '1px solid #4a5568';
        textarea.style.borderRadius = '4px';
        textarea.style.padding = '8px';
        textarea.style.marginBottom = '16px';
        textarea.style.resize = 'none';
        textarea.addEventListener('focus', () => textarea.select());
        box.appendChild(textarea);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.background = 'rgba(0,0,0,0.7)';
        closeBtn.style.color = 'white';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '4px';
        closeBtn.style.padding = '6px 18px';
        closeBtn.style.fontSize = '14px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.marginTop = '4px';
        closeBtn.addEventListener('click', () => modal.remove());
        box.appendChild(closeBtn);

        modal.appendChild(box);
        document.body.appendChild(modal);
        textarea.focus();
    }

    // Function to extract video information from various sources
    function extractVideoInfo(element) {
        // Check for lite-youtube videoid attribute
        if (element.tagName === 'LITE-YOUTUBE' && element.getAttribute('videoid')) {
            return {
                type: 'youtube',
                videoId: element.getAttribute('videoid')
            };
        }

        // Check for iframe src with YouTube embed URL
        if (element.tagName === 'IFRAME') {
            const src = element.getAttribute('src');
            if (src) {
                console.log('Checking iframe src:', src);
                
                // Enhanced regex to handle various YouTube embed URLs with query parameters
                const match = src.match(/(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\?|$)/);
                if (match) {
                    console.log('YouTube video ID found in iframe src:', match[1]);
                    return {
                        type: 'youtube',
                        videoId: match[1]
                    };
                }
                
                // Fallback: try without requiring query parameter separator
                const fallbackMatch = src.match(/(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                if (fallbackMatch) {
                    console.log('YouTube video ID found in iframe src (fallback):', fallbackMatch[1]);
                    return {
                        type: 'youtube',
                        videoId: fallbackMatch[1]
                    };
                }
                
                // Check for Google Developers frame URLs that might contain YouTube players
                if (src.includes('developers.google.com/frame/youtube/')) {
                    console.log('Google Developers YouTube frame detected:', src);
                    // For Google Developers frames, we'll need to check the content after it loads
                    return {
                        type: 'google-developers-frame',
                        frameUrl: src
                    };
                }
            }
        }

        // Check for shreddit-embed with YouTube iframe
        if (element.tagName === 'SHREDDIT-EMBED') {
            const html = element.getAttribute('html');
            if (html) {
                const match = html.match(/(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                if (match) {
                    return {
                        type: 'youtube',
                        videoId: match[1]
                    };
                }
            }
        }

        // Check for Reddit video (shreddit-player-2)
        if (element.tagName === 'SHREDDIT-PLAYER-2') {
            const packagedMediaJson = element.getAttribute('packaged-media-json');
            if (packagedMediaJson) {
                try {
                    const mediaData = JSON.parse(packagedMediaJson);
                    if (mediaData.playbackMp4s && mediaData.playbackMp4s.permutations) {
                        // Find the highest resolution
                        const permutations = mediaData.playbackMp4s.permutations;
                        const highestRes = permutations.reduce((highest, current) => {
                            const currentHeight = current.source.dimensions.height;
                            const highestHeight = highest.source.dimensions.height;
                            return currentHeight > highestHeight ? current : highest;
                        });
                        
                        return {
                            type: 'reddit',
                            videoUrl: highestRes.source.url,
                            resolution: `${highestRes.source.dimensions.height}p`,
                            allResolutions: permutations.map(p => ({
                                url: p.source.url,
                                resolution: `${p.source.dimensions.height}p`,
                                width: p.source.dimensions.width,
                                height: p.source.dimensions.height
                            }))
                        };
                    }
                } catch (error) {
                    console.error('Error parsing Reddit video data:', error);
                }
            } else {
                // New: Handle HLS-only Reddit videos
                const hlsUrl = element.getAttribute('src');
                if (hlsUrl && hlsUrl.endsWith('.m3u8')) {
                    return {
                        type: 'reddit-hls',
                        hlsUrl: hlsUrl
                    };
                }
            }
        }

        return null;
    }

    // Function to create the control panel
    function createControlPanel(videoInfo) {
        const container = document.createElement('div');
        container.className = 'youtube-video-controls';
        container.style.cssText = `
            background: #2d3748;
            border: 1px solid #4a5568;
            border-radius: 6px;
            padding: 8px 12px;
            margin: 0 0 8px 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        `;

        const videoIdDisplay = document.createElement('span');
        videoIdDisplay.style.cssText = `
            color: white;
            font-weight: 500;
            margin-right: auto;
        `;
        
        if (videoInfo.type === 'youtube') {
            videoIdDisplay.textContent = `YouTube ID: ${videoInfo.videoId}`;
        } else if (videoInfo.type === 'reddit') {
            videoIdDisplay.textContent = `Reddit ${videoInfo.resolution}`;
        } else if (videoInfo.type === 'reddit-hls') {
            videoIdDisplay.textContent = 'Reddit HLS';
        }

        // View button (YouTube or Reddit)
        const viewButton = document.createElement('button');
        viewButton.style.cssText = `
            background: rgba(0, 123, 255, 0.5);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            text-decoration: none;
            font-weight: 500;
            transition: background-color 0.2s;
            cursor: pointer;
            border: none;
            font-size: 11px;
            white-space: nowrap;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 20px;
            font-family: inherit;
        `;
        
        if (videoInfo.type === 'youtube') {
            viewButton.textContent = 'YouTube';
            viewButton.addEventListener('click', () => {
                window.open(`https://www.youtube.com/watch?v=${videoInfo.videoId}`, '_blank');
            });
        } else if (videoInfo.type === 'reddit') {
            viewButton.textContent = 'View';
            viewButton.addEventListener('click', () => {
                window.open(videoInfo.videoUrl, '_blank');
            });
        } else if (videoInfo.type === 'reddit-hls') {
            viewButton.textContent = 'View';
            viewButton.addEventListener('click', () => {
                window.open(videoInfo.hlsUrl, '_blank');
            });
        }
        
        viewButton.addEventListener('mouseenter', () => {
            viewButton.style.background = 'rgba(0, 105, 217, 0.5)';
        });
        viewButton.addEventListener('mouseleave', () => {
            viewButton.style.background = 'rgba(0, 123, 255, 0.5)';
        });

        // Download button
        const downloadButton = document.createElement('button');
        downloadButton.style.cssText = `
            background: rgba(40, 167, 69, 0.5);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            border: none;
            font-weight: 500;
            cursor: pointer;
            font-size: 11px;
            transition: background-color 0.2s;
            white-space: nowrap;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 20px;
        `;
        downloadButton.textContent = 'Download';
        downloadButton.addEventListener('mouseenter', () => {
            downloadButton.style.background = 'rgba(33, 136, 56, 0.5)';
        });
        downloadButton.addEventListener('mouseleave', () => {
            downloadButton.style.background = 'rgba(40, 167, 69, 0.5)';
        });
        downloadButton.addEventListener('click', () => {
            if (videoInfo.type === 'youtube') {
                // Handle YouTube video download
                browser.storage.local.get(['cookiesBrowser']).then((result) => {
                    const cookiesBrowser = result.cookiesBrowser || 'safari'; // Default to safari
                    
                    // Generate command using background script
                    browser.runtime.sendMessage({
                        action: 'generateDownloadCommand',
                        videoId: videoInfo.videoId,
                        cookiesBrowser: cookiesBrowser
                    }).then((response) => {
                        if (response.success) {
                            const command = response.command;
                            
                            // Copy command to clipboard using content script method
                            copyToClipboard(command).then((success) => {
                                if (success) {
                                    const originalText = downloadButton.textContent;
                                    downloadButton.textContent = 'Command Copied!';
                                    downloadButton.style.background = 'rgba(40, 167, 69, 0.5)';
                                    
                                    setTimeout(() => {
                                        downloadButton.textContent = originalText;
                                        downloadButton.style.background = 'rgba(40, 167, 69, 0.5)';
                                    }, 2000);
                                } else {
                                    console.error('Clipboard copy failed');
                                    // Fallback: show command in a more user-friendly way
                                    showCommandFallback(command);
                                }
                            }).catch((error) => {
                                console.error('Error copying to clipboard:', error);
                                // Fallback: show command in a more user-friendly way
                                showCommandFallback(command);
                            });
                        } else {
                            console.error('Command generation failed:', response.error);
                            alert('Failed to generate download command');
                        }
                    }).catch((error) => {
                        console.error('Error generating command:', error);
                        alert('Failed to generate download command');
                    });
                }).catch((error) => {
                    console.error('Error loading settings:', error);
                    // Fallback to default command with safari cookies
                    const command = `yt-dlp "https://www.youtube.com/watch?v=${videoInfo.videoId}" --cookies-from-browser safari -o "~/Downloads/%(title)s.%(ext)s"`;
                    
                    // Copy command to clipboard using content script method
                    copyToClipboard(command).then((success) => {
                        if (success) {
                            const originalText = downloadButton.textContent;
                            downloadButton.textContent = 'Command Copied!';
                            downloadButton.style.background = 'rgba(40, 167, 69, 0.5)';
                            
                            setTimeout(() => {
                                downloadButton.textContent = originalText;
                                downloadButton.style.background = 'rgba(40, 167, 69, 0.5)';
                            }, 2000);
                        } else {
                            console.error('Clipboard copy failed');
                            // Fallback: show command in a more user-friendly way
                            showCommandFallback(command);
                        }
                    }).catch((error) => {
                        console.error('Error copying to clipboard:', error);
                        // Fallback: show command in a more user-friendly way
                        showCommandFallback(command);
                    });
                });
            } else if (videoInfo.type === 'reddit') {
                // Handle Reddit video download
                console.log('Generating Reddit download command for:', videoInfo);
                browser.runtime.sendMessage({
                    action: 'generateRedditDownloadCommand',
                    videoUrl: videoInfo.videoUrl,
                    resolution: videoInfo.resolution
                }).then((response) => {
                    console.log('Reddit command generation response:', response);
                    if (response.success) {
                        const command = response.command;
                        console.log('Generated Reddit command:', command);
                        
                        // Copy command to clipboard using content script method
                        copyToClipboard(command).then((success) => {
                            if (success) {
                                const originalText = downloadButton.textContent;
                                downloadButton.textContent = 'Command Copied!';
                                downloadButton.style.background = 'rgba(40, 167, 69, 0.5)';
                                
                                setTimeout(() => {
                                    downloadButton.textContent = originalText;
                                    downloadButton.style.background = 'rgba(40, 167, 69, 0.5)';
                                }, 2000);
                            } else {
                                console.error('Clipboard copy failed');
                                // Fallback: show command in a more user-friendly way
                                showCommandFallback(command);
                            }
                        }).catch((error) => {
                            console.error('Error copying to clipboard:', error);
                            // Fallback: show command in a more user-friendly way
                            showCommandFallback(command);
                        });
                    } else {
                        console.error('Command generation failed:', response.error);
                        alert('Failed to generate download command');
                    }
                }).catch((error) => {
                    console.error('Error generating command:', error);
                    alert('Failed to generate download command');
                });
            } else if (videoInfo.type === 'reddit-hls') {
                // Handle Reddit HLS video download
                const command = `yt-dlp "${videoInfo.hlsUrl}"`;
                copyToClipboard(command).then((success) => {
                    if (success) {
                        const originalText = downloadButton.textContent;
                        downloadButton.textContent = 'Command Copied!';
                        downloadButton.style.background = 'rgba(40, 167, 69, 0.5)';
                        setTimeout(() => {
                            downloadButton.textContent = originalText;
                            downloadButton.style.background = 'rgba(40, 167, 69, 0.5)';
                        }, 2000);
                    } else {
                        console.error('Clipboard copy failed');
                        showCommandFallback(command);
                    }
                }).catch((error) => {
                    console.error('Error copying to clipboard:', error);
                    showCommandFallback(command);
                });
            }
        });

        container.appendChild(videoIdDisplay);
        container.appendChild(viewButton);
        container.appendChild(downloadButton);

        return container;
    }

    

    // Function to process a video element
    function processVideoElement(element) {
        const videoInfo = extractVideoInfo(element);
        if (!videoInfo) {
            // Debug: log elements that might be videos but weren't detected
            if (element.tagName === 'IFRAME') {
                const src = element.getAttribute('src');
                if (src && (src.includes('youtube.com') || src.includes('youtu.be'))) {
                    console.log('YouTube iframe detected but no video ID extracted:', src);
                }
            } else if (element.tagName === 'SHREDDIT-PLAYER-2') {
                console.log('Reddit player detected but no video info extracted:', element);
            }
            return;
        }

        // Check if we've already added controls for this video
        if (element.dataset.videoControlsAdded) return;
        element.dataset.videoControlsAdded = 'true';

        console.log('Video detected:', videoInfo, 'from element:', element);

        // Handle Google Developers frame case
        if (videoInfo.type === 'google-developers-frame') {
            console.log('Processing Google Developers frame:', videoInfo.frameUrl);
            
            // For Google Developers frames, we need to wait for the frame to load and then check its content
            // The default video ID for the YouTube Player Demo is 'M7lc1UVf-VE'
            const defaultVideoId = 'M7lc1UVf-VE';
            
            // Create control panel with the default video ID
            const controlPanel = createControlPanel({
                type: 'youtube',
                videoId: defaultVideoId
            });
            
            // Insert the control panel
            element.parentNode.insertBefore(controlPanel, element);
            
            // Also try to detect the actual video ID from the frame content after it loads
            setTimeout(() => {
                try {
                    const frameDoc = element.contentDocument || element.contentWindow.document;
                    if (frameDoc) {
                        const frameIframes = frameDoc.querySelectorAll('iframe');
                        frameIframes.forEach(frameIframe => {
                            const frameSrc = frameIframe.getAttribute('src');
                            if (frameSrc) {
                                const match = frameSrc.match(/(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                                if (match) {
                                    console.log('Found actual YouTube video ID in frame:', match[1]);
                                    // Update the control panel with the actual video ID
                                    const videoIdDisplay = controlPanel.querySelector('.video-id');
                                    if (videoIdDisplay) {
                                        videoIdDisplay.textContent = `Video ID: ${match[1]}`;
                                    }
                                }
                            }
                        });
                    }
                } catch (error) {
                    console.log('Could not access frame content due to CORS:', error);
                }
            }, 2000);
            
            return;
        }

        // Create and insert control panel
        const controlPanel = createControlPanel(videoInfo);
        
        // Find the post-media-container div and insert at the very beginning
        let targetContainer = element;
        while (targetContainer && targetContainer.getAttribute('slot') !== 'post-media-container') {
            targetContainer = targetContainer.parentElement;
        }
        
        if (targetContainer) {
            // Insert as the first child of the post-media-container
            targetContainer.insertBefore(controlPanel, targetContainer.firstChild);
        } else {
            // Fallback: insert before the video element
            element.parentNode.insertBefore(controlPanel, element);
        }
    }

    // Function to scan for videos
    function scanForVideos() {
        console.log('Scanning for videos...');
        
        // Look for lite-youtube elements
        const liteYoutubeElements = document.querySelectorAll('lite-youtube');
        console.log('Found lite-youtube elements:', liteYoutubeElements.length);
        liteYoutubeElements.forEach(processVideoElement);

        // Look for iframe elements with YouTube URLs
        const iframeElements = document.querySelectorAll('iframe');
        console.log('Found iframe elements:', iframeElements.length);
        iframeElements.forEach((iframe, index) => {
            const src = iframe.getAttribute('src');
            console.log(`Iframe ${index} src:`, src);
            processVideoElement(iframe);
        });

        // Look for shreddit-embed elements
        const shredditEmbedElements = document.querySelectorAll('shreddit-embed');
        console.log('Found shreddit-embed elements:', shredditEmbedElements.length);
        shredditEmbedElements.forEach(processVideoElement);

        // Look for Reddit video players
        const redditPlayerElements = document.querySelectorAll('shreddit-player-2');
        console.log('Found shreddit-player-2 elements:', redditPlayerElements.length);
        redditPlayerElements.forEach(processVideoElement);
    }

    // Initial scan
    scanForVideos();

    // Set up mutation observer to handle dynamically added content
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if the added node is a video element
                    if (node.tagName === 'LITE-YOUTUBE' || 
                        node.tagName === 'IFRAME' || 
                        node.tagName === 'SHREDDIT-EMBED' ||
                        node.tagName === 'SHREDDIT-PLAYER-2') {
                        processVideoElement(node);
                    }
                    
                    // Check for video elements within the added node
                    const videoElements = node.querySelectorAll && node.querySelectorAll('lite-youtube, iframe, shreddit-embed, shreddit-player-2');
                    if (videoElements) {
                        videoElements.forEach(processVideoElement);
                    }
                }
            });
        });
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Re-scan periodically to catch any missed videos
    setInterval(scanForVideos, 2000);

})();
