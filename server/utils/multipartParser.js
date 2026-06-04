/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * CUSTOM MULTIPART/FORM-DATA PARSER (FRAMEWORK-FREE)
 * ====================================================================
 * 
 * Parses binary multipart requests without any external dependencies.
 * Extracts textual fields and binary file buffers.
 * Enforces file size limitations (5MB) and media type constraints.
 */

const path = require('path');

/**
 * Parses multipart/form-data from the given request.
 * @param {http.IncomingMessage} req 
 * @returns {{ fields: Object, files: Array }}
 */
function parse(req) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
        throw new Error('Request Content-Type is not multipart/form-data.');
    }

    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) {
        throw new Error('No multipart boundary defined in Content-Type header.');
    }

    // Clean potential quotes around the boundary
    const boundary = boundaryMatch[1].replace(/['"]/g, '').trim();
    const delimiter = Buffer.from('--' + boundary);
    const bodyBuffer = req.rawBodyBuffer;

    if (!bodyBuffer || bodyBuffer.length === 0) {
        return { fields: {}, files: [] };
    }

    // Split the body buffer by boundary
    const parts = [];
    let searchIndex = 0;
    while (true) {
        const index = bodyBuffer.indexOf(delimiter, searchIndex);
        if (index === -1) {
            break;
        }
        if (searchIndex < index) {
            parts.push(bodyBuffer.subarray(searchIndex, index));
        }
        searchIndex = index + delimiter.length;
    }
    if (searchIndex < bodyBuffer.length) {
        parts.push(bodyBuffer.subarray(searchIndex));
    }

    const fields = {};
    const files = [];

    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const maxFileSize = 5 * 1024 * 1024; // 5MB limit

    for (let part of parts) {
        // Strip leading whitespace/newlines from the part buffer
        let startOffset = 0;
        while (startOffset < part.length && (part[startOffset] === 13 || part[startOffset] === 10 || part[startOffset] === 32)) {
            startOffset++;
        }
        part = part.subarray(startOffset);

        if (part.length === 0) continue;
        
        // Check for end boundary (starts with '--')
        if (part.length >= 2 && part[0] === 45 && part[1] === 45) {
            continue;
        }

        // Split headers and body of this part
        const headerEndIndex = part.indexOf('\r\n\r\n');
        let headerString = '';
        let fileDataBuffer = null;

        if (headerEndIndex !== -1) {
            headerString = part.subarray(0, headerEndIndex).toString('utf8');
            fileDataBuffer = part.subarray(headerEndIndex + 4);
        } else {
            const lfLfIndex = part.indexOf('\n\n');
            if (lfLfIndex !== -1) {
                headerString = part.subarray(0, lfLfIndex).toString('utf8');
                fileDataBuffer = part.subarray(lfLfIndex + 2);
            } else {
                continue; // Skip invalid part structure
            }
        }

        // Strip trailing \r\n or \n from file data buffer (boundary prefixes)
        if (fileDataBuffer.length >= 2 && fileDataBuffer[fileDataBuffer.length - 2] === 13 && fileDataBuffer[fileDataBuffer.length - 1] === 10) {
            fileDataBuffer = fileDataBuffer.subarray(0, fileDataBuffer.length - 2);
        } else if (fileDataBuffer.length >= 1 && fileDataBuffer[fileDataBuffer.length - 1] === 10) {
            fileDataBuffer = fileDataBuffer.subarray(0, fileDataBuffer.length - 1);
        }

        // Parse part headers
        const headers = {};
        const lines = headerString.split(/\r?\n/);
        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
                const key = line.substring(0, colonIndex).trim().toLowerCase();
                const val = line.substring(colonIndex + 1).trim();
                headers[key] = val;
            }
        }

        const contentDisposition = headers['content-disposition'];
        if (!contentDisposition) continue;

        let fieldname = '';
        let filename = '';

        // Extract field name and filename via robust regex matching
        const nameMatch = contentDisposition.match(/name=(?:"([^"]*)"|([^;\s]+))/);
        if (nameMatch) {
            fieldname = nameMatch[1] !== undefined ? nameMatch[1] : nameMatch[2];
        }
        
        const filenameMatch = contentDisposition.match(/filename=(?:"([^"]*)"|([^;\s]+))/);
        if (filenameMatch) {
            filename = filenameMatch[1] !== undefined ? filenameMatch[1] : filenameMatch[2];
        }

        if (fieldname) {
            if (filename) {
                // File upload field
                const ext = path.extname(filename).toLowerCase();
                const mimetype = headers['content-type'] || '';

                // Strict image validation
                if (!allowedMimes.includes(mimetype.toLowerCase()) && !allowedExts.includes(ext)) {
                    throw new Error(`Invalid file type for upload: "${filename}". Only image file types (jpg, jpeg, png, gif, webp) are permitted.`);
                }

                // File size restriction
                if (fileDataBuffer.length > maxFileSize) {
                    throw new Error(`File "${filename}" exceeds the maximum upload capacity of 5MB.`);
                }

                files.push({
                    fieldname,
                    filename,
                    data: fileDataBuffer,
                    mimetype: mimetype || 'application/octet-stream'
                });
            } else {
                // Regular text field
                fields[fieldname] = fileDataBuffer.toString('utf8');
            }
        }
    }

    return { fields, files };
}

module.exports = { parse };
