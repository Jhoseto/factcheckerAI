
export function safeJsonParse(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        // 1. Remove markdown code blocks
        let clean = jsonString.replace(/```json\s*|\s*```/g, '').trim();

        // 2. Try to fix trailing commas
        clean = clean.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

        // 3. Try to close unclosed braces/brackets
        // This is a naive implementation but might save some cases
        const openBraces = (clean.match(/{/g) || []).length;
        const closeBraces = (clean.match(/}/g) || []).length;
        const openBrackets = (clean.match(/\[/g) || []).length;
        const closeBrackets = (clean.match(/]/g) || []).length;

        if (openBraces > closeBraces) {
            clean += '}'.repeat(openBraces - closeBraces);
        }
        if (openBrackets > closeBrackets) {
            clean += ']'.repeat(openBrackets - closeBrackets);
        }

        // 4. Try to fix missing closing quote on last property if truncated
        if (clean.split('"').length % 2 === 0) {
            clean += '"';
            // Re-run bracket closing if we added a quote
            const openBracesNew = (clean.match(/{/g) || []).length;
            const closeBracesNew = (clean.match(/}/g) || []).length;
            if (openBracesNew > closeBracesNew) {
                clean += '}'.repeat(openBracesNew - closeBracesNew);
            }
        }

        try {
            return JSON.parse(clean);
        } catch (e2) {
            // If still fails, maybe it's just a text response that looks like JSON?
            // Or maybe it has comments?
            // Try to strip comments
            clean = clean.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
            try {
                return JSON.parse(clean);
            } catch (e3) {
                // Last resort: take from first { to last }, close brackets, try again
                const firstBrace = clean.indexOf('{');
                const lastBrace = clean.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace > firstBrace) {
                    let slice = clean.slice(firstBrace, lastBrace + 1);
                    slice = slice.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
                    const ob = (slice.match(/{/g) || []).length;
                    const cb = (slice.match(/}/g) || []).length;
                    if (ob > cb) slice += '}'.repeat(ob - cb);
                    try {
                        return JSON.parse(slice);
                    } catch (_) {}
                }
                throw new Error('Unrepairable JSON');
            }
        }
    }
}
