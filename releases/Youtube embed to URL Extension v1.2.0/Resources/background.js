browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received request: ", request);

    if (request.greeting === "hello") {
        return Promise.resolve({ farewell: "goodbye" });
    }

    if (request.action === "copyToClipboard") {
        const text = request.text;
        console.log('Attempting to copy to clipboard:', text);
        
        // Try to copy to clipboard using navigator.clipboard first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).then(() => {
                console.log('Clipboard copy successful');
                return { success: true };
            }).catch((error) => {
                console.error('Clipboard write failed:', error);
                // Fallback to document.execCommand method
                return fallbackClipboardCopy(text);
            });
        } else {
            console.error('Clipboard API not available, using fallback');
            return fallbackClipboardCopy(text);
        }
    }
    
    // Fallback clipboard copy method using document.execCommand
    function fallbackClipboardCopy(text) {
        return new Promise((resolve) => {
            try {
                // Create a temporary textarea element
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.left = '-999999px';
                textarea.style.top = '-999999px';
                textarea.style.opacity = '0';
                textarea.style.pointerEvents = 'none';
                document.body.appendChild(textarea);
                
                // Focus and select the text
                textarea.focus();
                textarea.select();
                textarea.setSelectionRange(0, 99999); // For mobile devices
                
                // Try to copy
                let successful = false;
                try {
                    successful = document.execCommand('copy');
                } catch (e) {
                    console.error('execCommand failed:', e);
                }
                
                // Clean up
                document.body.removeChild(textarea);
                
                if (successful) {
                    console.log('Fallback clipboard copy successful');
                    resolve({ success: true });
                } else {
                    console.error('Fallback clipboard copy failed');
                    // Try alternative method using clipboard API with user gesture
                    resolve({ success: false, error: 'execCommand copy failed' });
                }
            } catch (error) {
                console.error('Fallback clipboard copy error:', error);
                resolve({ success: false, error: error.message });
            }
        });
    }

    if (request.action === "generateDownloadCommand") {
        const videoId = request.videoId;
        const cookiesBrowser = request.cookiesBrowser || 'safari';
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        // Build command with cookies argument before -o
        let command = `yt-dlp "${videoUrl}"`;
        
        // Add cookies-from-browser argument if not set to 'none'
        if (cookiesBrowser !== 'none') {
            command += ` --cookies-from-browser ${cookiesBrowser}`;
        }
        
        command += ` -o "~/Downloads/%(title)s.%(ext)s"`;
        
        return Promise.resolve({ success: true, command: command });
    }

    if (request.action === "generateRedditDownloadCommand") {
        const videoUrl = request.videoUrl;
        const resolution = request.resolution || '720p';
        
        // Extract Reddit video ID from URL (part before /pb/)
        let videoId = 'unknown';
        try {
            const urlParts = videoUrl.split('/pb/');
            if (urlParts.length > 0) {
                const beforePb = urlParts[0];
                // Extract the last part of the URL before /pb/ which should be the video ID
                const pathParts = beforePb.split('/');
                videoId = pathParts[pathParts.length - 1];
            }
        } catch (error) {
            console.error('Error extracting Reddit video ID:', error);
        }
        
        // Generate curl command for Reddit video with unique filename
        const command = `curl -L "${videoUrl}" -o "~/Downloads/reddit_${videoId}_${resolution}.mp4"`;
        
        return Promise.resolve({ success: true, command: command });
    }
});
