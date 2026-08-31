import json
import urllib.request

data = json.dumps({
    "pr_title": "🧪 Add comprehensive tests for text extraction utilities",
    "pr_body": "🎯 **What:** Addressed missing tests for text extraction utilities in `crawler/core/textExtractors.ts`.\n\n📊 **Coverage:** The test suite now explicitly covers cleanupDescriptionText, extractDescriptionCandidatesFromJsonLd, extractDescriptionCandidatesFromOpenGraph, extractDescriptionCandidatesFromShopifyProductJson, and extractDescriptionCandidatesFromDomSelectors. It validates proper removal of scripts and styles, decoding of HTML entities, flattening JSON structures, parsing OpenGraph headers, and resolving DOM selectors.\n\n✨ **Result:** Enhanced the test:crawler pipeline, verifying these core extraction methods reliably function across edge cases. This protects the downstream inference pipelines from text extraction regressions."
}).encode('utf-8')

req = urllib.request.Request(
    'http://localhost:8000/submit',
    data=data,
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
