// Quoted-field-aware CSV parser.
// Cannot use naive split(',') because FPL fixture stats contain embedded JSON with commas
// and quoted strings (e.g., stats: {"assists": 1, "note": "great play"}).
// RFC 4180 convention: a quoted field is wrapped in ", and internal quotes are escaped as "".

export function parseCsv(text) {
    if (!text) return [];

    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    const pushField = () => { row.push(field); field = ''; };
    const pushRow = () => { rows.push(row); row = []; };

    // Scan character by character to handle quoted fields and escaped quotes.
    while (i < text.length) {
        const char = text[i];
        if (inQuotes) {
            // Inside a quoted field: look for closing quote or escaped quote ("").
            if (char === '"') {
                if (text[i + 1] === '"') {
                    // Quote-doubling escape: "" inside a quoted field means one literal ".
                    field += '"';
                    i += 2;
                    continue;
                }
                // Unescaped quote: end of quoted field.
                inQuotes = false;
                i++;
                continue;
            }
            // Regular character inside quoted field.
            field += char;
            i++;
            continue;
        }
        // Outside quotes: look for comma (field sep), newline (row sep), or opening quote.
        if (char === '"') {
            inQuotes = true;
            i++;
            continue;
        }
        if (char === ',') {
            pushField();
            i++;
            continue;
        }
        if (char === '\r') {
            // Skip bare \r (Windows line ending, handled as part of \r\n).
            i++;
            continue;
        }
        if (char === '\n') {
            pushField();
            pushRow();
            i++;
            continue;
        }
        // Regular character.
        field += char;
        i++;
    }
    // Handle trailing field and row (if no trailing newline).
    if (field.length > 0 || row.length > 0) {
        pushField();
        pushRow();
    }

    // Convert rows to objects using first row as header.
    const header = rows.shift();
    if (!header) return [];

    return rows
        .filter(r => r.length === header.length)
        .map(r => {
            const obj = {};
            header.forEach((h, idx) => { obj[h] = r[idx]; });
            return obj;
        });
}
