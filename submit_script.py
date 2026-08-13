import subprocess
import sys

title = "🧪 Add comprehensive tests for text extraction utilities"
body = """🎯 **What:** Addressed missing tests for text extraction utilities in `crawler/core/textExtractors.ts`.

📊 **Coverage:** The test suite now explicitly covers cleanupDescriptionText, extractDescriptionCandidatesFromJsonLd, extractDescriptionCandidatesFromOpenGraph, extractDescriptionCandidatesFromShopifyProductJson, and extractDescriptionCandidatesFromDomSelectors. It validates proper removal of scripts and styles, decoding of HTML entities, flattening JSON structures, parsing OpenGraph headers, and resolving DOM selectors.

✨ **Result:** Enhanced the test:crawler pipeline, verifying these core extraction methods reliably function across edge cases. This protects the downstream inference pipelines from text extraction regressions."""

print("Submission ready. Title and body formatted.")
