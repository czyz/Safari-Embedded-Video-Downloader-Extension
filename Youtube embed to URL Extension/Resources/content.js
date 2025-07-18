browser.runtime.sendMessage({ greeting: "hello" }).then((response) => {
    console.log("Received response: ", response);
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received request: ", request);
});

// YouTube Video Detector and Controller
(function() {
    'use strict';
    
    // Debug logging function that checks settings
    let debugEnabled = false;
    let nativePagesEnabled = false;
    
    // Load settings
    browser.storage.local.get(['debugMode', 'nativePages']).then((result) => {
        debugEnabled = result.debugMode || false;
        nativePagesEnabled = result.nativePages || false;
    }).catch(() => {
        debugEnabled = false;
        nativePagesEnabled = false;
    });
    
    function debugLog(...args) {
        if (debugEnabled) {
            console.log(...args);
        }
    }
    
    debugLog('=== EMBEDDED VIDEO DETECTOR EXTENSION LOADED ===');
    debugLog('Extension version: 1.3.1');
    debugLog('Current page:', window.location.href);
    debugLog('User agent:', navigator.userAgent);
    debugLog('Native pages enabled:', nativePagesEnabled);
    
    // Function to extract video info from native video pages
    function extractNativeVideoInfo() {
        const url = window.location.href;
        let videoInfo = null;
        
        // YouTube native page
        if (url.includes('youtube.com/watch')) {
            const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
            if (match) {
                videoInfo = {
                    type: 'youtube',
                    videoId: match[1]
                };
                debugLog('Native YouTube video detected:', videoInfo);
            }
        }
        // Vimeo native page
        else if (url.includes('vimeo.com/')) {
            // Try multiple URL patterns for Vimeo
            let match = url.match(/vimeo\.com\/(\d+)/);
            if (!match) {
                // Try channels format: vimeo.com/channels/CHANNELNAME/VIDEO_ID
                match = url.match(/vimeo\.com\/channels\/[^\/]+\/(\d+)/);
            }
            if (!match) {
                // Try groups format: vimeo.com/groups/GROUPNAME/VIDEO_ID
                match = url.match(/vimeo\.com\/groups\/[^\/]+\/(\d+)/);
            }
            if (!match) {
                // Try alternative patterns
                match = url.match(/vimeo\.com\/video\/(\d+)/);
            }
            if (!match) {
                // Try with query parameters
                match = url.match(/vimeo\.com\/(\d+)(?:\?|$)/);
            }
            
            if (match) {
                videoInfo = {
                    type: 'vimeo',
                    videoId: match[1]
                };
                debugLog('Native Vimeo video detected from URL:', videoInfo);
            } else {
                // Fallback: try to extract video ID from page content
                debugLog('Vimeo URL pattern not matched, trying to extract from page content');
                const videoIdFromPage = extractVimeoVideoIdFromPage();
                if (videoIdFromPage) {
                    videoInfo = {
                        type: 'vimeo',
                        videoId: videoIdFromPage
                    };
                    debugLog('Native Vimeo video detected from page content:', videoInfo);
                }
            }
        }
        
        return videoInfo;
    }
    
    // Function to extract Vimeo video ID from page content
    function extractVimeoVideoIdFromPage() {
        debugLog('Extracting Vimeo video ID from page content...');
        
        // Strategy 1: Look for elements with video ID in their ID attribute
        const elementsWithVideoId = document.querySelectorAll('[id*="clip_"], [id*="player"], [class*="player"]');
        for (const element of elementsWithVideoId) {
            const id = element.getAttribute('id');
            if (id && /^\d+$/.test(id)) {
                debugLog('Found Vimeo video ID in element ID:', id);
                return id;
            }
            
            // Check for clip_VIDEO_ID pattern
            const clipMatch = id?.match(/clip_(\d+)/);
            if (clipMatch) {
                debugLog('Found Vimeo video ID in clip ID:', clipMatch[1]);
                return clipMatch[1];
            }
        }
        
        // Strategy 2: Look for data attributes that might contain video ID
        const dataElements = document.querySelectorAll('[data-config-url], [data-player]');
        for (const element of dataElements) {
            const configUrl = element.getAttribute('data-config-url');
            if (configUrl) {
                const match = configUrl.match(/player\.vimeo\.com\/video\/(\d+)/);
                if (match) {
                    debugLog('Found Vimeo video ID in data-config-url:', match[1]);
                    return match[1];
                }
            }
        }
        
        // Strategy 3: Look for any element with a numeric ID that might be a video ID
        const allElements = document.querySelectorAll('*');
        for (const element of allElements) {
            const id = element.getAttribute('id');
            if (id && /^\d{7,}$/.test(id)) { // Vimeo IDs are typically 7+ digits
                debugLog('Found potential Vimeo video ID in element ID:', id);
                return id;
            }
        }
        
        debugLog('No Vimeo video ID found in page content');
        return null;
    }
    
    // Function to check if video info contains meaningful data for user interaction
    function hasMeaningfulVideoInfo(videoInfo) {
        if (!videoInfo) return false;
        
        switch (videoInfo.type) {
            case 'youtube':
                // Must have a video ID for YouTube
                return videoInfo.videoId && videoInfo.videoId.length > 0;
                
            case 'vimeo':
                // Must have a video ID for Vimeo
                return videoInfo.videoId && videoInfo.videoId.length > 0;
                
            case 'reddit':
                // Must have a video URL for Reddit
                return videoInfo.videoUrl && videoInfo.videoUrl.length > 0;
                
            case 'reddit-hls':
                // Must have an HLS URL for Reddit HLS
                return videoInfo.hlsUrl && videoInfo.hlsUrl.length > 0;
                
            case 'reddit-blob':
                // Must have a video ID for Reddit blob videos
                return videoInfo.videoId && videoInfo.videoId.length > 0;
                
            default:
                // Unknown type - require at least some meaningful data
                return (videoInfo.videoId && videoInfo.videoId.length > 0) ||
                       (videoInfo.videoUrl && videoInfo.videoUrl.length > 0) ||
                       (videoInfo.hlsUrl && videoInfo.hlsUrl.length > 0);
        }
    }
    
    // Function to wait for YouTube elements to be properly loaded
    function waitForYouTubeElements(videoInfo) {
        debugLog('Waiting for YouTube elements to load...');
        
        const maxAttempts = 20; // Try for up to 10 seconds (20 * 500ms)
        let attempts = 0;
        
        const checkForElements = () => {
            attempts++;
            debugLog(`YouTube element check attempt ${attempts}/${maxAttempts}`);
            
            // Look for the proper YouTube page structure
            const playerDiv = document.querySelector('#player');
            const primaryInner = document.querySelector('#primary-inner');
            
            if (playerDiv && primaryInner) {
                debugLog('YouTube elements found, creating control panel');
                
                // Check if we've already added controls
                if (document.querySelector('[data-native-video-controls-added]')) {
                    debugLog('Native video controls already added');
                    return;
                }
                
                // Create and insert control panel
                const controlPanel = createControlPanel(videoInfo);
                primaryInner.insertBefore(controlPanel, primaryInner.firstChild);
                
                // Mark that we've added native video controls
                document.body.setAttribute('data-native-video-controls-added', 'true');
                debugLog('Native YouTube video control panel added');
            } else if (attempts < maxAttempts) {
                // Try again in 500ms
                setTimeout(checkForElements, 500);
            } else {
                debugLog('YouTube elements not found after maximum attempts, trying fallback strategies');
                addYouTubeFallbackControls(videoInfo);
            }
        };
        
        // Start checking
        checkForElements();
    }
    
    // Function to wait for Vimeo elements to be properly loaded
    function waitForVimeoElements(videoInfo) {
        debugLog('Waiting for Vimeo elements to load...');
        
        const maxAttempts = 20; // Try for up to 10 seconds (20 * 500ms)
        let attempts = 0;
        
        const checkForElements = () => {
            attempts++;
            debugLog(`Vimeo element check attempt ${attempts}/${maxAttempts}`);
            
            const videoContainer = document.querySelector('.vp-player, .vp-video-wrapper, .vp-preview');
            
            if (videoContainer) {
                debugLog('Vimeo elements found, creating control panel');
                
                // Check if we've already added controls
                if (document.querySelector('[data-native-video-controls-added]')) {
                    debugLog('Native video controls already added');
                    return;
                }
                
                // Create and insert control panel
                const controlPanel = createControlPanel(videoInfo);
                videoContainer.parentElement.insertBefore(controlPanel, videoContainer.parentElement.firstChild);
                
                // Mark that we've added native video controls
                document.body.setAttribute('data-native-video-controls-added', 'true');
                debugLog('Native Vimeo video control panel added');
            } else if (attempts < maxAttempts) {
                // Try again in 500ms
                setTimeout(checkForElements, 500);
            } else {
                debugLog('Vimeo elements not found after maximum attempts, using fallback');
                // Fallback: try to add to body
                const controlPanel = createControlPanel(videoInfo);
                document.body.insertBefore(controlPanel, document.body.firstChild);
                document.body.setAttribute('data-native-video-controls-added', 'true');
            }
        };
        
        // Start checking
        checkForElements();
    }

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
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            backdrop-filter: blur(4px);
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
            color: white;
            padding: 32px;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.6);
            display: flex;
            flex-direction: column;
            align-items: center;
            max-width: 90vw;
            min-width: 400px;
            border: 1px solid rgba(255,255,255,0.1);
        `;

        const icon = document.createElement('div');
        icon.innerHTML = '📋';
        icon.style.cssText = `
            font-size: 48px;
            margin-bottom: 16px;
        `;
        box.appendChild(icon);

        const title = document.createElement('div');
        title.textContent = 'Download Command';
        title.style.cssText = `
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #e2e8f0;
        `;
        box.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.textContent = 'Copy this command to your terminal:';
        subtitle.style.cssText = `
            font-size: 14px;
            color: #a0aec0;
            margin-bottom: 20px;
            text-align: center;
        `;
        box.appendChild(subtitle);

        const textarea = document.createElement('textarea');
        textarea.value = command;
        textarea.readOnly = true;
        textarea.style.cssText = `
            width: 100%;
            min-width: 360px;
            max-width: 600px;
            height: 80px;
            font-size: 13px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            background: #1a202c;
            color: #e2e8f0;
            border: 2px solid #4a5568;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 24px;
            resize: none;
            line-height: 1.4;
        `;
        textarea.addEventListener('focus', () => textarea.select());
        box.appendChild(textarea);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 12px;
            align-items: center;
        `;

        const copyAndCloseBtn = document.createElement('button');
        copyAndCloseBtn.textContent = 'Copy & Close';
        copyAndCloseBtn.style.cssText = `
            background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);
        `;
        copyAndCloseBtn.addEventListener('mouseenter', () => {
            copyAndCloseBtn.style.background = 'linear-gradient(135deg, #3182ce 0%, #2c5aa0 100%)';
            copyAndCloseBtn.style.transform = 'translateY(-1px)';
        });
        copyAndCloseBtn.addEventListener('mouseleave', () => {
            copyAndCloseBtn.style.background = 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)';
            copyAndCloseBtn.style.transform = 'translateY(0)';
        });
        copyAndCloseBtn.addEventListener('click', () => {
            copyToClipboard(command).then((success) => {
                if (success) {
                    copyAndCloseBtn.textContent = 'Copied!';
                    copyAndCloseBtn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
                    setTimeout(() => modal.remove(), 1000);
                } else {
                    copyAndCloseBtn.textContent = 'Failed';
                    copyAndCloseBtn.style.background = 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)';
                    setTimeout(() => {
                        copyAndCloseBtn.textContent = 'Copy & Close';
                        copyAndCloseBtn.style.background = 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)';
                    }, 2000);
                }
            });
        });
        buttonContainer.appendChild(copyAndCloseBtn);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            background: transparent;
            color: #a0aec0;
            border: 1px solid #4a5568;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.1)';
            closeBtn.style.color = '#e2e8f0';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'transparent';
            closeBtn.style.color = '#a0aec0';
        });
        closeBtn.addEventListener('click', () => modal.remove());
        buttonContainer.appendChild(closeBtn);

        box.appendChild(buttonContainer);
        modal.appendChild(box);
        document.body.appendChild(modal);
        textarea.focus();
    }

    // Function to extract video information from various sources
    function extractVideoInfo(element) {
        debugLog('extractVideoInfo called with element:', element.tagName, element.className);
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
                debugLog('Checking iframe src:', src);
                
                // Enhanced regex to handle various YouTube embed URLs with query parameters
                const match = src.match(/(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\?|$)/);
                if (match) {
                    debugLog('YouTube video ID found in iframe src:', match[1]);
                    return {
                        type: 'youtube',
                        videoId: match[1]
                    };
                }
                
                // Fallback: try without requiring query parameter separator
                const fallbackMatch = src.match(/(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                if (fallbackMatch) {
                    debugLog('YouTube video ID found in iframe src (fallback):', fallbackMatch[1]);
                    return {
                        type: 'youtube',
                        videoId: fallbackMatch[1]
                    };
                }
                
                // Check for Vimeo iframe
                const vimeoMatch = src.match(/player\.vimeo\.com\/video\/(\d+)/);
                if (vimeoMatch) {
                    debugLog('Vimeo video ID found in iframe src:', vimeoMatch[1]);
                    return {
                        type: 'vimeo',
                        videoId: vimeoMatch[1]
                    };
                }
                
                // Check for Google Developers frame URLs that might contain YouTube players
                if (src.includes('developers.google.com/frame/youtube/')) {
                    debugLog('Google Developers YouTube frame detected (skipping due to CORS):', src);
                    // Skip Google Developers frames since they're cross-origin and we can't access their contents
                    return null;
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

        // Check for Reddit video (multiple possible element types)
        debugLog('Checking Reddit condition for:', element.tagName, element.getAttribute('data-testid'));
        if (element.tagName === 'SHREDDIT-PLAYER-2' || 
            element.tagName === 'SHREDDIT-PLAYER' ||
            (element.tagName === 'VIDEO' && (element.getAttribute('data-testid')?.includes('video') || 
                                            element.getAttribute('src')?.includes('reddit.com') ||
                                            element.getAttribute('src')?.includes('v.redd.it') ||
                                            element.getAttribute('poster')?.includes('reddit.com'))) ||
            element.getAttribute('data-testid')?.includes('video')) {
            debugLog('Reddit condition matched!');
            
            debugLog('Processing Reddit video element:', element.tagName, element.getAttribute('data-testid'));
            debugLog('Element src attribute:', element.getAttribute('src'));
            debugLog('Element poster attribute:', element.getAttribute('poster'));
            
            const packagedMediaJson = element.getAttribute('packaged-media-json');
            if (packagedMediaJson) {
                try {
                    const mediaData = JSON.parse(packagedMediaJson);
                    debugLog('Reddit media data:', mediaData);
                    
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
                // Check for HLS URL (including with query parameters)
                const hlsUrl = element.getAttribute('src');
                debugLog('Checking for HLS URL:', hlsUrl);
                if (hlsUrl && hlsUrl.includes('.m3u8')) {
                    debugLog('Found Reddit HLS URL:', hlsUrl);
                    return {
                        type: 'reddit-hls',
                        hlsUrl: hlsUrl
                    };
                } else {
                    debugLog('HLS URL check failed - URL does not contain .m3u8');
                }
                
                // Check for direct video URL
                const videoUrl = element.getAttribute('src');
                if (videoUrl && (videoUrl.includes('.mp4') || videoUrl.includes('reddit.com') || videoUrl.includes('v.redd.it'))) {
                    debugLog('Found Reddit video URL:', videoUrl);
                    return {
                        type: 'reddit',
                        videoUrl: videoUrl,
                        resolution: 'unknown'
                    };
                }
                
                // For video elements in shadow DOM, check for blob URLs and poster images
                if (element.tagName === 'VIDEO') {
                    const videoSrc = element.getAttribute('src');
                    const poster = element.getAttribute('poster');
                    
                    // If it's a blob URL (like the one you showed), try to get info from the poster
                    if (videoSrc && videoSrc.startsWith('blob:') && poster) {
                        debugLog('Found video with blob URL and poster:', poster);
                        // Extract video ID from poster URL if possible
                        const posterMatch = poster.match(/v0-([a-zA-Z0-9_-]+)/);
                        if (posterMatch) {
                            return {
                                type: 'reddit-blob',
                                videoId: posterMatch[1],
                                poster: poster,
                                blobUrl: videoSrc
                            };
                        }
                    }
                    
                    // Check for source elements inside the video
                    const sourceElement = element.querySelector('source');
                    if (sourceElement) {
                        const sourceSrc = sourceElement.getAttribute('src');
                        const sourceType = sourceElement.getAttribute('type');
                        debugLog('Found video source:', sourceSrc, sourceType);
                        
                        if (sourceSrc && sourceSrc.includes('.m3u8')) {
                            return {
                                type: 'reddit-hls',
                                hlsUrl: sourceSrc
                            };
                        }
                    }
                }
                
                // Check for data attributes that might contain video info
                const dataAttributes = element.attributes;
                for (let i = 0; i < dataAttributes.length; i++) {
                    const attr = dataAttributes[i];
                    if (attr.name.startsWith('data-') && attr.value.includes('http')) {
                        try {
                            const data = JSON.parse(attr.value);
                            if (data.url || data.src) {
                                return {
                                    type: 'reddit',
                                    videoUrl: data.url || data.src,
                                    resolution: 'unknown'
                                };
                            }
                        } catch (e) {
                            // Not JSON, continue
                        }
                    }
                }
            }
            
            // If we matched Reddit condition but didn't find any meaningful data, don't return anything
            debugLog('Reddit condition matched but no meaningful video data found');
        }

        debugLog('extractVideoInfo returning null - no video info found');
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
            position: relative;
            z-index: 999999;
        `;

        const videoIdDisplay = document.createElement('span');
        videoIdDisplay.style.cssText = `
            color: white;
            font-weight: 500;
            margin-right: auto;
        `;
        
        // Check if we're on a native page
        const isNativePage = window.location.hostname.includes('youtube.com') || window.location.hostname.includes('vimeo.com');
        
        if (videoInfo.type === 'youtube') {
            videoIdDisplay.textContent = isNativePage ? `Video ID: ${videoInfo.videoId}` : `YouTube ID: ${videoInfo.videoId}`;
        } else if (videoInfo.type === 'reddit') {
            videoIdDisplay.textContent = `Reddit ${videoInfo.resolution}`;
        } else if (videoInfo.type === 'reddit-hls') {
            videoIdDisplay.textContent = 'Reddit HLS Video';
        } else if (videoInfo.type === 'reddit-blob') {
            videoIdDisplay.textContent = `Reddit Video (${videoInfo.videoId})`;
        } else if (videoInfo.type === 'vimeo') {
            videoIdDisplay.textContent = isNativePage ? `Video ID: ${videoInfo.videoId}` : `Vimeo (${videoInfo.videoId})`;
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
            if (!isNativePage) {
                viewButton.textContent = 'YouTube';
                viewButton.addEventListener('click', () => {
                    window.open(`https://www.youtube.com/watch?v=${videoInfo.videoId}`, '_blank');
                });
            }
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
        } else if (videoInfo.type === 'reddit-blob') {
            viewButton.textContent = 'View';
            viewButton.addEventListener('click', () => {
                // Try to construct the Reddit video URL from the video ID
                const redditUrl = `https://v.redd.it/${videoInfo.videoId}`;
                window.open(redditUrl, '_blank');
            });
        } else if (videoInfo.type === 'vimeo') {
            if (!isNativePage) {
                viewButton.textContent = 'Vimeo';
                viewButton.addEventListener('click', () => {
                    window.open(`https://vimeo.com/${videoInfo.videoId}`, '_blank');
                });
            }
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
            } else if (videoInfo.type === 'vimeo') {
                // Handle Vimeo video download (similar to YouTube)
                browser.storage.local.get(['cookiesBrowser']).then((result) => {
                    const cookiesBrowser = result.cookiesBrowser || 'safari'; // Default to safari
                    
                    // Generate command using background script
                    browser.runtime.sendMessage({
                        action: 'generateDownloadCommand',
                        videoId: videoInfo.videoId,
                        cookiesBrowser: cookiesBrowser,
                        videoType: 'vimeo'
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
                    const command = `yt-dlp "https://vimeo.com/${videoInfo.videoId}" --cookies-from-browser safari -o "~/Downloads/%(title)s.%(ext)s"`;
                    
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
            } else if (videoInfo.type === 'reddit-blob') {
                // Handle Reddit blob video download
                const redditUrl = `https://v.redd.it/${videoInfo.videoId}`;
                const command = `yt-dlp "${redditUrl}"`;
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
        // Only add view button if it has content (not on native pages)
        if (viewButton.textContent) {
            container.appendChild(viewButton);
        }
        container.appendChild(downloadButton);

        return container;
    }

    // Function to add YouTube controls with multiple fallback strategies
    function addYouTubeFallbackControls(videoInfo) {
        debugLog('Attempting YouTube fallback control placement...');
        // Check if we've already added controls
        if (document.querySelector('[data-native-video-controls-added]')) {
            debugLog('Native video controls already added');
            return;
        }
        const controlPanel = createControlPanel(videoInfo);
        // Strategy 1: Try to find any video-related container
        const videoContainers = [
            '#movie_player',
            '#player',
            '.html5-video-container',
            'ytd-watch-flexy',
            '#content',
            '#page-manager',
            '#primary',
            '#primary-inner'
        ];
        for (const selector of videoContainers) {
            const element = document.querySelector(selector);
            if (element && element.parentElement) {
                debugLog(`Found fallback container: ${selector}`);
                try {
                    element.parentElement.insertBefore(controlPanel, element.parentElement.firstChild);
                    document.body.setAttribute('data-native-video-controls-added', 'true');
                    debugLog(`YouTube fallback control panel added using ${selector}`);
                    return;
                } catch (error) {
                    debugLog(`Failed to insert using ${selector}:`, error);
                    continue;
                }
            }
        }
        // Strategy 2: Try to find any element with 'video' or 'player' in its attributes
        const allElements = document.querySelectorAll('*');
        for (const element of allElements) {
            const hasVideoAttributes = 
                (element.id && (element.id.includes('video') || element.id.includes('player')))
                || (element.className && (element.className.includes('video') || element.className.includes('player')))
                || (element.getAttribute && (
                    (element.getAttribute('data-testid') && (element.getAttribute('data-testid').includes('video') || element.getAttribute('data-testid').includes('player')))
                ));
            if (hasVideoAttributes && element.parentElement) {
                debugLog(`Found video-related element: ${element.tagName} ${element.id || element.className}`);
                try {
                    element.parentElement.insertBefore(controlPanel, element.parentElement.firstChild);
                    document.body.setAttribute('data-native-video-controls-added', 'true');
                    debugLog('YouTube fallback control panel added using video-related element');
                    return;
                } catch (error) {
                    debugLog('Failed to insert using video-related element:', error);
                    continue;
                }
            }
        }
        // Strategy 3: Try to find the main content area
        const mainContentSelectors = [
            'main',
            '#main',
            '#content',
            '#page-manager',
            'ytd-app',
            'ytd-watch-flexy'
        ];
        for (const selector of mainContentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                debugLog(`Found main content area: ${selector}`);
                try {
                    element.insertBefore(controlPanel, element.firstChild);
                    document.body.setAttribute('data-native-video-controls-added', 'true');
                    debugLog(`YouTube fallback control panel added to main content: ${selector}`);
                    return;
                } catch (error) {
                    debugLog(`Failed to insert into ${selector}:`, error);
                    continue;
                }
            }
        }
        // Strategy 4: Last resort - add to body
        debugLog('All fallback strategies failed, adding to body as last resort');
        try {
            document.body.insertBefore(controlPanel, document.body.firstChild);
            document.body.setAttribute('data-native-video-controls-added', 'true');
            debugLog('YouTube fallback control panel added to body as last resort');
        } catch (error) {
            debugLog('Failed to add control panel to body:', error);
            // If even this fails, append to body
            try {
                document.body.appendChild(controlPanel);
                document.body.setAttribute('data-native-video-controls-added', 'true');
                debugLog('YouTube fallback control panel appended to body');
            } catch (finalError) {
                debugLog('All YouTube control placement strategies failed:', finalError);
            }
        }
    }

    // Function to process a video element
    function processVideoElement(element) {
        debugLog('processVideoElement called with:', element.tagName, element.className);
        let videoInfo;
        try {
            videoInfo = extractVideoInfo(element);
            debugLog('extractVideoInfo returned:', videoInfo);
        } catch (error) {
            console.error('Error in extractVideoInfo:', error);
            return;
        }
        if (!videoInfo) {
            // Debug: log elements that might be videos but weren't detected
            if (element.tagName === 'IFRAME') {
                const src = element.getAttribute('src');
                if (src && (src.includes('youtube.com') || src.includes('youtu.be'))) {
                    debugLog('YouTube iframe detected but no video ID extracted:', src);
                }
            } else if (element.tagName === 'SHREDDIT-PLAYER-2') {
                debugLog('Reddit player detected but no video info extracted:', element);
            }
            return;
        }

        // Check if we've already added controls for this video
        if (element.dataset.videoControlsAdded) return;
        element.dataset.videoControlsAdded = 'true';

        debugLog('Video detected:', videoInfo, 'from element:', element);

        // Only create control panel if we have meaningful video information
        if (!hasMeaningfulVideoInfo(videoInfo)) {
            debugLog('Skipping control panel - no meaningful video information:', videoInfo);
            return;
        }

        // Create and insert control panel
        const controlPanel = createControlPanel(videoInfo);
        
        // For iframe videos (YouTube, Vimeo), try to insert before the video container
        if (element.tagName === 'IFRAME') {
            // Look for common video container classes
            let container = element.parentElement;
            const containerClasses = ['video-container', 'video-container-16-9', 'embed-container', 'video-wrapper'];
            
            // Check if parent has video container classes
            while (container && container !== document.body) {
                const hasContainerClass = containerClasses.some(cls => 
                    container.className && container.className.includes(cls)
                );
                
                if (hasContainerClass) {
                    // Insert before the container
                    container.parentNode.insertBefore(controlPanel, container);
                    return;
                }
                
                container = container.parentElement;
            }
        }
        
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

    // Function to recursively scan for videos, including shadow DOM
    function scanForVideosRecursive(root) {
        const videos = [];
        let shadowRootCount = 0;
        
        // Function to traverse shadow DOM
        function traverse(element) {
            // Check if element has shadow root
            if (element.shadowRoot) {
                shadowRootCount++;
                debugLog(`Found shadow root #${shadowRootCount} in:`, element.tagName, element.className, element.getAttribute('data-testid'));
                traverse(element.shadowRoot);
            }
            
            // Look for video elements in current scope
            const videoElements = element.querySelectorAll('video');
            videoElements.forEach(video => {
                debugLog('Found video in shadow DOM:', video);
                debugLog('Video attributes:', {
                    src: video.getAttribute('src'),
                    poster: video.getAttribute('poster'),
                    preload: video.getAttribute('preload'),
                    tabindex: video.getAttribute('tabindex')
                });
                videos.push(video);
            });
            
            // Look for other video-related elements
            const otherVideoElements = element.querySelectorAll('lite-youtube, iframe, shreddit-embed, shreddit-player-2, shreddit-player');
            otherVideoElements.forEach(el => {
                debugLog('Found video-related element in shadow DOM:', el.tagName, el.className);
                videos.push(el);
            });
            
            // Recursively check for more shadow roots
            const allElements = element.querySelectorAll('*');
            allElements.forEach(el => {
                if (el.shadowRoot) {
                    traverse(el.shadowRoot);
                }
            });
        }
        
        traverse(root);
        debugLog(`Shadow DOM traversal complete. Found ${shadowRootCount} shadow roots and ${videos.length} video elements.`);
        return videos;
    }

    // Function to scan for videos
    function scanForVideos() {
        debugLog('=== STARTING VIDEO SCAN ===');
        debugLog('Current URL:', window.location.href);
        debugLog('Is Reddit:', window.location.hostname.includes('reddit.com'));
        
        // Check for native video pages if enabled
        if (nativePagesEnabled) {
            const nativeVideoInfo = extractNativeVideoInfo();
            if (nativeVideoInfo) {
                debugLog('Native video page detected, creating control panel');
                
                // Check if we've already added controls for this native video
                if (document.querySelector('[data-native-video-controls-added]')) {
                    debugLog('Native video controls already added');
                    return;
                }
                
                // For native pages, we need to wait for the proper elements to be available
                // and handle dynamic page structure changes
                if (window.location.hostname.includes('youtube.com')) {
                    // For YouTube, wait for the proper page structure
                    waitForYouTubeElements(nativeVideoInfo);
                    return; // Skip regular video scanning for native pages
                } else if (window.location.hostname.includes('vimeo.com')) {
                    // For Vimeo, try to insert near the video player
                    const videoContainer = document.querySelector('.vp-player, .vp-video-wrapper, .vp-preview');
                    if (videoContainer) {
                        const controlPanel = createControlPanel(nativeVideoInfo);
                        videoContainer.parentElement.insertBefore(controlPanel, videoContainer.parentElement.firstChild);
                        document.body.setAttribute('data-native-video-controls-added', 'true');
                        debugLog('Native Vimeo video control panel added');
                        return; // Skip regular video scanning for native pages
                    } else {
                        // Wait for Vimeo elements to load
                        waitForVimeoElements(nativeVideoInfo);
                        return; // Skip regular video scanning for native pages
                    }
                }
            }
        }
        
        // Look for lite-youtube elements
        const liteYoutubeElements = document.querySelectorAll('lite-youtube');
        debugLog('Found lite-youtube elements:', liteYoutubeElements.length);
        liteYoutubeElements.forEach(processVideoElement);

        // Look for iframe elements with YouTube URLs
        const iframeElements = document.querySelectorAll('iframe');
        debugLog('Found iframe elements:', iframeElements.length);
        iframeElements.forEach((iframe, index) => {
            const src = iframe.getAttribute('src');
            debugLog(`Iframe ${index} src:`, src);
            processVideoElement(iframe);
        });

        // Look for shreddit-embed elements
        const shredditEmbedElements = document.querySelectorAll('shreddit-embed');
        debugLog('Found shreddit-embed elements:', shredditEmbedElements.length);
        shredditEmbedElements.forEach(processVideoElement);

        // Look for Reddit video players - try multiple possible selectors
        const redditPlayerElements = document.querySelectorAll('shreddit-player-2, shreddit-player, [data-testid*="video"], video');
        debugLog('Found Reddit video elements:', redditPlayerElements.length);
        redditPlayerElements.forEach((element, index) => {
            debugLog(`Reddit video element ${index}:`, element.tagName, element.className, element.getAttribute('data-testid'));
            debugLog('Element attributes:', {
                'packaged-media-json': element.getAttribute('packaged-media-json'),
                'src': element.getAttribute('src'),
                'data-testid': element.getAttribute('data-testid'),
                'class': element.className,
                'poster': element.getAttribute('poster'),
                'preview': element.getAttribute('preview')
            });
            
            // Additional debugging for shreddit-player-2 elements
            if (element.tagName === 'SHREDDIT-PLAYER-2') {
                debugLog('SHREDDIT-PLAYER-2 found with src:', element.getAttribute('src'));
                debugLog('SHREDDIT-PLAYER-2 poster:', element.getAttribute('poster'));
                debugLog('SHREDDIT-PLAYER-2 preview:', element.getAttribute('preview'));
            }
            
            debugLog('About to call processVideoElement for element:', element.tagName);
            try {
                processVideoElement(element);
                debugLog('processVideoElement call completed successfully');
            } catch (error) {
                console.error('Error calling processVideoElement:', error);
            }
        });
        
        // Scan for videos in shadow DOM
        debugLog('Scanning for videos in shadow DOM...');
        const shadowVideos = scanForVideosRecursive(document.body);
        debugLog('Found videos in shadow DOM:', shadowVideos.length);
        shadowVideos.forEach(processVideoElement);
        
        debugLog('=== VIDEO SCAN COMPLETE ===');

        // Additional debugging for Reddit-specific elements
        if (window.location.hostname.includes('reddit.com')) {
            debugLog('On Reddit - looking for video-related elements...');
            
            // Look for any elements that might contain video data
            const allElements = document.querySelectorAll('*');
            const videoRelatedElements = Array.from(allElements).filter(el => {
                const attrs = el.attributes;
                for (let i = 0; i < attrs.length; i++) {
                    const attr = attrs[i];
                    if (attr.name.includes('video') || 
                        attr.name.includes('media') || 
                        attr.name.includes('player') ||
                        attr.value.includes('video') ||
                        attr.value.includes('media') ||
                        attr.value.includes('player')) {
                        return true;
                    }
                }
                return false;
            });
            
            debugLog('Found video-related elements:', videoRelatedElements.length);
            videoRelatedElements.slice(0, 10).forEach((el, index) => {
                debugLog(`Video-related element ${index}:`, el.tagName, el.className, el.getAttribute('data-testid'));
            });
            
            // Additional Reddit-specific scanning for async-loaded content
            // Look for shreddit-async-loader elements that might contain videos
            const asyncLoaders = document.querySelectorAll('shreddit-async-loader');
            debugLog('Found shreddit-async-loader elements:', asyncLoaders.length);
            asyncLoaders.forEach((loader, index) => {
                debugLog(`Async loader ${index}:`, loader.getAttribute('bundlename'));
                // Check if this loader contains video elements
                const videoElements = loader.querySelectorAll('shreddit-player-2, shreddit-player, video');
                if (videoElements.length > 0) {
                    debugLog(`Async loader ${index} contains ${videoElements.length} video elements`);
                    videoElements.forEach(processVideoElement);
                }
            });
            
            // Look for elements with post-media-container slot (Reddit's video container)
            const mediaContainers = document.querySelectorAll('[slot="post-media-container"]');
            debugLog('Found post-media-container elements:', mediaContainers.length);
            mediaContainers.forEach((container, index) => {
                debugLog(`Media container ${index}:`, container.className);
                const videoElements = container.querySelectorAll('shreddit-player-2, shreddit-player, video');
                if (videoElements.length > 0) {
                    debugLog(`Media container ${index} contains ${videoElements.length} video elements`);
                    videoElements.forEach(processVideoElement);
                }
            });
            
            // Look for shreddit-post elements with video type
            const videoPosts = document.querySelectorAll('shreddit-post[post-type="video"]');
            debugLog('Found video posts:', videoPosts.length);
            videoPosts.forEach((post, index) => {
                debugLog(`Video post ${index}:`, post.getAttribute('domain'), post.getAttribute('post-id'));
                // Check if this post contains video elements
                const videoElements = post.querySelectorAll('shreddit-player-2, shreddit-player, video');
                if (videoElements.length > 0) {
                    debugLog(`Video post ${index} contains ${videoElements.length} video elements`);
                    videoElements.forEach(processVideoElement);
                }
            });
            
            // Look for shreddit-async-loader with specific bundlename for video player
            const videoPlayerLoaders = document.querySelectorAll('shreddit-async-loader[bundlename="shreddit_player_2_loader"]');
            debugLog('Found video player loaders:', videoPlayerLoaders.length);
            videoPlayerLoaders.forEach((loader, index) => {
                debugLog(`Video player loader ${index}:`, loader);
                // Check if this loader contains video elements
                const videoElements = loader.querySelectorAll('shreddit-player-2, shreddit-player, video');
                if (videoElements.length > 0) {
                    debugLog(`Video player loader ${index} contains ${videoElements.length} video elements`);
                    videoElements.forEach(processVideoElement);
                }
            });
        }
    }

    // Initial scan
    debugLog('Starting initial video scan...');
    scanForVideos();
    debugLog('Initial video scan completed.');

    // Set up mutation observer to handle dynamically added content
    const observer = new MutationObserver((mutations) => {
        let shouldRescan = false;
        
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if the added node is a video element
                    if (node.tagName === 'LITE-YOUTUBE' || 
                        node.tagName === 'IFRAME' || 
                        node.tagName === 'SHREDDIT-EMBED' ||
                        node.tagName === 'SHREDDIT-PLAYER-2' ||
                        node.tagName === 'SHREDDIT-PLAYER' ||
                        node.tagName === 'VIDEO') {
                        debugLog('Mutation observer found video element:', node.tagName);
                        processVideoElement(node);
                    }
                    
                    // Check for video elements within the added node
                    const videoElements = node.querySelectorAll && node.querySelectorAll('lite-youtube, iframe, shreddit-embed, shreddit-player-2, shreddit-player, video');
                    if (videoElements && videoElements.length > 0) {
                        debugLog('Mutation observer found video elements within node:', videoElements.length);
                        videoElements.forEach(processVideoElement);
                    }
                    
                    // For Reddit, also check for any elements that might be containers for videos
                    if (window.location.hostname.includes('reddit.com')) {
                        if (node.tagName === 'DIV' || node.tagName === 'ARTICLE' || node.tagName === 'SECTION') {
                            // Check if this element contains video-related attributes or classes
                            const hasVideoAttributes = node.getAttribute('data-testid')?.includes('video') ||
                                                     node.className?.includes('video') ||
                                                     node.className?.includes('media') ||
                                                     node.className?.includes('player');
                            
                            if (hasVideoAttributes) {
                                debugLog('Mutation observer found potential video container:', node.tagName, node.className, node.getAttribute('data-testid'));
                                shouldRescan = true;
                            }
                        }
                        
                        // Check for Reddit-specific video elements
                        if (node.tagName === 'SHREDDIT-POST' && node.getAttribute('post-type') === 'video') {
                            debugLog('Mutation observer found Reddit video post:', node.getAttribute('post-id'), node.getAttribute('domain'));
                            shouldRescan = true;
                        }
                        
                        if (node.tagName === 'SHREDDIT-ASYNC-LOADER' && node.getAttribute('bundlename') === 'shreddit_player_2_loader') {
                            debugLog('Mutation observer found Reddit video player loader');
                            shouldRescan = true;
                        }
                    }
                }
            });
        });
        
        // If we found potential video containers, do a full rescan after a short delay
        if (shouldRescan) {
            setTimeout(() => {
                debugLog('Doing full rescan due to potential video container detection');
                scanForVideos();
            }, 500);
        }
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'data-testid', 'class']
    });

    // Re-scan periodically to catch any missed videos (with intelligent stopping)
    let periodicScanCount = 0;
    let lastVideoCount = 0;
    const maxPeriodicScans = window.location.hostname.includes('reddit.com') ? 30 : 15; // More scans for Reddit
    const scanInterval = window.location.hostname.includes('reddit.com') ? 1000 : 2000;
    
    const periodicInterval = setInterval(() => {
        try {
            const beforeCount = document.querySelectorAll('[data-video-controls-added]').length;
            scanForVideos();
            const afterCount = document.querySelectorAll('[data-video-controls-added]').length;
            
            periodicScanCount++;
            
            // Stop periodic scanning if:
            // 1. We've reached max scans, OR
            // 2. No new videos found in last 3 scans, OR  
            // 3. No videos found at all after 5 scans
            if (periodicScanCount >= maxPeriodicScans || 
                (afterCount === lastVideoCount && periodicScanCount > 3) ||
                (afterCount === 0 && periodicScanCount > 5)) {
                debugLog(`Stopping periodic scanning after ${periodicScanCount} scans. Found ${afterCount} videos total.`);
                clearInterval(periodicInterval);
            }
            
            lastVideoCount = afterCount;
            
            // Log progress every 5 scans
            if (periodicScanCount % 5 === 0) {
                debugLog(`Periodic scan ${periodicScanCount}/${maxPeriodicScans}: Found ${afterCount} videos total`);
            }
        } catch (error) {
            console.error('Error during periodic scan:', error);
        }
    }, scanInterval);
    
    // Additional aggressive scanning for Reddit video posts
    if (window.location.hostname.includes('reddit.com')) {
        debugLog('Setting up aggressive Reddit video scanning...');
        // Scan more frequently for the first 10 seconds after page load
        let aggressiveScanCount = 0;
        const aggressiveInterval = setInterval(() => {
            debugLog('Aggressive Reddit video scanning, attempt:', aggressiveScanCount + 1);
            try {
                scanForVideos();
            } catch (error) {
                console.error('Error during aggressive scan:', error);
            }
            aggressiveScanCount++;
            if (aggressiveScanCount >= 10) {
                clearInterval(aggressiveInterval);
                debugLog('Stopping aggressive Reddit video scanning');
            }
        }, 500);
    }

    debugLog('=== EXTENSION SETUP COMPLETE ===');

})();
