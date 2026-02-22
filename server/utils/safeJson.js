
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
 * inside JSON string values (i.e. between unescaped double quotes).
 */
function escapeControlCharsInStrings(text) {
    let result = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const code = text.charCodeAt(i);
        if (escaped) {
            result += ch;
            escaped = false;
            continue;
        }
        if (ch === '\\' && inString) {
            result += ch;
            escaped = true;
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
                default:   result += '\\u' + code.toString(16).padStart(4, '0'); break;
            }
            continue;
        }
        result += ch;
    }
    return result;
}

export function safeJsonParse(jsonString) {
    // Pass 1: try as-is
    try { return JSON.parse(jsonString); } catch (_) {}

    // Pass 2: strip markdown fences + trailing commas
    let clean = jsonString.replace(/```json\s*|\s*```/g, '').trim();
    clean = clean.replace(/,(\s*[}\]])/g, '$1');
    try { return JSON.parse(clean); } catch (_) {}

    // Pass 3: escape unescaped control chars inside strings
    const escaped = escapeControlCharsInStrings(clean);
    try { return JSON.parse(escaped); } catch (_) {}

    // Pass 4: strip JS comments, try again
    const noComments = escaped.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    try { return JSON.parse(noComments); } catch (_) {}

    // Pass 5: find outermost { … } using string-aware depth tracking
    const firstBrace = noComments.indexOf('{');
    if (firstBrace !== -1) {
        let depth = 0;
        let ins = false;
        let esc = false;
        let end = -1;
        for (let i = firstBrace; i < noComments.length; i++) {
            const ch = noComments[i];
            if (esc) { esc = false; continue; }
            if (ch === '\\' && ins) { esc = true; continue; }
            if (ch === '"') { ins = !ins; continue; }
            if (!ins) {
                if (ch === '{') depth++;
                else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
            }
        }
        if (end !== -1) {
            const slice = noComments.slice(firstBrace, end + 1).replace(/,(\s*[}\]])/g, '$1');
            try { return JSON.parse(slice); } catch (_) {}
        }
    }

    // Pass 6: close unclosed braces/brackets using string-aware counts
    let repaired = noComments;
    const unclosedBraces = countBracesOutsideStrings(repaired, '{', '}');
    const unclosedBrackets = countBracesOutsideStrings(repaired, '[', ']');
    if (unclosedBraces > 0) repaired += '}'.repeat(unclosedBraces);
    if (unclosedBrackets > 0) repaired += ']'.repeat(unclosedBrackets);
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
    try { return JSON.parse(repaired); } catch (_) {}

    // Pass 7: fix unclosed string then retry
    if (repaired.split('"').length % 2 === 0) {
        repaired += '"';
        const ub2 = countBracesOutsideStrings(repaired, '{', '}');
        const ubk2 = countBracesOutsideStrings(repaired, '[', ']');
        if (ub2 > 0) repaired += '}'.repeat(ub2);
        if (ubk2 > 0) repaired += ']'.repeat(ubk2);
        repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
        try { return JSON.parse(repaired); } catch (_) {}
    }

    throw new Error('Unrepairable JSON');
}
