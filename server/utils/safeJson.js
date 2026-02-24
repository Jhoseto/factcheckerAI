
/**
 * String-aware brace/bracket counter.
 * Counts open/close pairs only outside of JSON strings.
 */
function countBracesOutsideStrings(text, open, close) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\' && inString) { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (!inString) {
            if (ch === open) depth++;
            else if (ch === close) depth--;
        }
    }
    return depth; // positive = more opens than closes
}

/**
 * Escape literal control characters (newline, tab, CR) that appear
 * inside JSON string values. Uses look-ahead to handle unescaped
 * internal quotes (e.g. "He said "hello" to me").
 */
function escapeControlCharsInStrings(text) {
    let result = '';
    let inString = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const code = text.charCodeAt(i);

        if (inString && ch === '\\') {
            result += ch;
            i++;
            if (i < text.length) result += text[i];
            continue;
        }

        if (ch === '"') {
            inString = !inString;
            result += ch;
            continue;
        }

        if (inString && code < 0x20) {
            switch (code) {
                case 0x0A: result += '\\n'; break;
                case 0x0D: result += '\\r'; break;
                case 0x09: result += '\\t'; break;
                default: result += '\\u' + code.toString(16).padStart(4, '0'); break;
            }
            continue;
        }

        result += ch;
    }
    return result;
}

export function safeJsonParse(jsonString) {
    // Pass 1: try as-is
    try { return JSON.parse(jsonString); } catch (_) { }

    // Pass 2: strip markdown fences + trailing commas
    let clean = jsonString.replace(/```json\s*|\s*```/g, '').trim();
    clean = clean.replace(/,(\s*[}\]])/g, '$1');
    try { return JSON.parse(clean); } catch (_) { }

    // Pass 3: escape unescaped control chars inside strings
    const escaped = escapeControlCharsInStrings(clean);
    try { return JSON.parse(escaped); } catch (_) { }

    // Pass 4: strip JS comments, try again
    const noComments = escaped.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    try { return JSON.parse(noComments); } catch (_) { }

    // Pass 5: Intelligent truncation repair
    // Iterates through to find the last valid complete token, or forcibly closes open strings/objects
    let repaired = '';
    let inString = false;
    let escapeNext = false;
    const stack = []; // will hold '{' or '['

    for (let i = 0; i < noComments.length; i++) {
        const ch = noComments[i];

        if (escapeNext) {
            repaired += ch;
            escapeNext = false;
            continue;
        }

        if (ch === '\\' && inString) {
            repaired += ch;
            escapeNext = true;
            continue;
        }

        if (ch === '"') {
            inString = !inString;
            repaired += ch;
            continue;
        }

        if (!inString) {
            // If it's a markdown leftover or garbage at the end, break
            if (ch === '`') {
                break;
            }
            if (ch === '{' || ch === '[') {
                stack.push(ch);
            } else if (ch === '}' || ch === ']') {
                if (stack.length > 0) stack.pop();
            }
        }
        repaired += ch;
    }

    // Now, force close everything
    if (inString) {
        repaired += '"'; // close the broken string
    }

    // Remove any trailing comma before closing braces
    repaired = repaired.replace(/,\s*$/, '');

    // Pop the stack to close arrays and objects
    while (stack.length > 0) {
        const expected = stack.pop();
        repaired += expected === '{' ? '}' : ']';
    }

    // Final cleanups for trailing commas
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

    try { return JSON.parse(repaired); } catch (_) { }

    throw new Error('Unrepairable JSON');
}
