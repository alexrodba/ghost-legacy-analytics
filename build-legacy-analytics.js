#!/usr/bin/env node
'use strict';

/*
 * Build a slug -> analytics lookup from a Ghost post-analytics CSV export.
 *
 * Usage:
 *   node build-legacy-analytics.js <input.csv> <output.json>
 *
 * Get <input.csv> from your OLD Ghost instance:
 *   Ghost Admin -> Settings -> Import/Export -> "Export post analytics".
 *
 * Zero dependencies (uses `fs` only). The CSV parser handles quoted fields
 * with embedded commas (e.g. the `tags` column: "Business, Operations").
 */

var fs = require('fs');

// Parse a single CSV line into an array of fields, honouring double-quoted
// fields (which may contain commas) and escaped quotes ("").
function parseLine(line) {
    var fields = [];
    var field = '';
    var inQuotes = false;

    for (var i = 0; i < line.length; i++) {
        var ch = line[i];

        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            fields.push(field);
            field = '';
        } else {
            field += ch;
        }
    }

    fields.push(field);
    return fields;
}

// Extract the slug from a post url: the last non-empty path segment.
// https://www.example.com/build-vs-fix/ -> build-vs-fix
function slugFromUrl(url) {
    var withoutProtocol = url.replace(/^[a-z]+:\/\//i, '');
    var path = withoutProtocol.slice(withoutProtocol.indexOf('/'));
    var segments = path.split('/').filter(function (s) { return s.length > 0; });

    // Rows for "emailed only" posts have no public page: /email/<uuid>/
    if (segments.length === 0 || segments[0] === 'email') {
        return null;
    }

    return segments[segments.length - 1];
}

// Parse a CSV field to a number, defaulting to 0 for empty/non-numeric.
function toNum(v) {
    var s = (v || '').trim();
    return s === '' || isNaN(Number(s)) ? 0 : Number(s);
}

function main() {
    var input = process.argv[2];
    var output = process.argv[3];

    if (!input || !output) {
        console.error('Usage: node build-legacy-analytics.js <input.csv> <output.json>');
        process.exit(1);
    }

    var raw = fs.readFileSync(input, 'utf8');
    var lines = raw.split(/\r?\n/).filter(function (l) { return l.length > 0; });

    var header = parseLine(lines[0]);
    var urlIdx = header.indexOf('url');
    var opensIdx = header.indexOf('opens');
    var sendsIdx = header.indexOf('sends');
    var clicksIdx = header.indexOf('clicks');
    var signupsIdx = header.indexOf('signups');
    var paidIdx = header.indexOf('paid_conversions');

    var result = {};
    var written = 0;
    var skipped = 0;

    for (var i = 1; i < lines.length; i++) {
        var row = parseLine(lines[i]);
        var slug = slugFromUrl(row[urlIdx] || '');
        var opensRaw = (row[opensIdx] || '').trim();
        var sendsRaw = (row[sendsIdx] || '').trim();

        // Skip rows with no public slug or no numeric opens value.
        if (!slug || opensRaw === '' || isNaN(Number(opensRaw))) {
            skipped++;
            continue;
        }

        result[slug] = {
            sends: toNum(sendsRaw),
            opens: Number(opensRaw),
            clicks: toNum(row[clicksIdx]),
            signups: toNum(row[signupsIdx]),
            paid: toNum(row[paidIdx])
        };
        written++;
    }

    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
    console.log('Wrote ' + written + ' posts, skipped ' + skipped + ' rows without a slug');
}

main();
