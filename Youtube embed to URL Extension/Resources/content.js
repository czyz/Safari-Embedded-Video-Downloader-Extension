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
    
    // Load debug setting
    browser.storage.local.get(['debugMode']).then((result) => {
        debugEnabled = result.debugMode || false;
    }).catch(() => {
        debugEnabled = false;
    });
    
    function debugLog(...args) {
        if (debugEnabled) {
            console.log(...args);
        }
    }
    
    debugLog('=== YOUTUBE VIDEO DETECTOR EXTENSION LOADED ===');
    debugLog('Extension version: 1.2.0');
    debugLog('Current page:', window.location.href);
    debugLog('User agent:', navigator.userAgent);

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
                
                // Check for Google Developers frame URLs that might contain YouTube players
                if (src.includes('developers.google.com/frame/youtube/')) {
                    debugLog('Google Developers YouTube frame detected:', src);
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

        // Check for Reddit video (multiple possible element types)
        debugLog('Checking Reddit condition for:', element.tagName, element.getAttribute('data-testid'));
        if (element.tagName === 'SHREDDIT-PLAYER-2' || 
            element.tagName === 'SHREDDIT-PLAYER' ||
            element.tagName === 'VIDEO' ||
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
            videoIdDisplay.textContent = 'Reddit HLS Video';
        } else if (videoInfo.type === 'reddit-blob') {
            videoIdDisplay.textContent = `Reddit Video (${videoInfo.videoId})`;
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
        } else if (videoInfo.type === 'reddit-blob') {
            viewButton.textContent = 'View';
            viewButton.addEventListener('click', () => {
                // Try to construct the Reddit video URL from the video ID
                const redditUrl = `https://v.redd.it/${videoInfo.videoId}`;
                window.open(redditUrl, '_blank');
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
        container.appendChild(viewButton);
        container.appendChild(downloadButton);

        return container;
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

        // Handle Google Developers frame case
        if (videoInfo.type === 'google-developers-frame') {
            debugLog('Processing Google Developers frame:', videoInfo.frameUrl);
            
            // For Google Developers frames, we need to wait for the frame to load and then check its content
            // We'll try to detect the actual video ID from the frame content after it loads
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
                                    debugLog('Found actual YouTube video ID in frame:', match[1]);
                                    
                                    // Only create control panel if we found a real video ID
                                    const actualVideoInfo = {
                                        type: 'youtube',
                                        videoId: match[1]
                                    };
                                    
                                    // Check if we've already added controls for this video
                                    if (element.dataset.videoControlsAdded) return;
                                    element.dataset.videoControlsAdded = 'true';
                                    
                                    // Create and insert control panel
                                    const controlPanel = createControlPanel(actualVideoInfo);
                                    element.parentNode.insertBefore(controlPanel, element);
                                }
                            }
                        });
                    }
                } catch (error) {
                    debugLog('Could not access frame content due to CORS:', error);
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
