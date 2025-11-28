# Suggestion Service

A Node.js + TypeScript service that generates search suggestions from product data and syncs them to Typesense.

## Features

- **Extracts unique attributes** via efficient faceting from the "consumer-products" collection
- **Validates combinations** using faceted queries (no full product loading!)
- **Generates dynamic suggestions** based on real product combinations:
  - Category only (e.g., "Rings")
  - Occasion + Category (e.g., "Engagement Rings")
  - Metal + Category (e.g., "22kt Yellow Gold Rings")
  - Style + Category (e.g., "Solitaire Rings")
  - Collection (e.g., "Heritage Collection")
- **Outputs to JSON file** for review before syncing
- **Includes manual overrides** for marketing terms (New Arrivals, Best Sellers)
- **Optional Typesense sync** with automatic collection management

## Performance Optimizations

✅ **No full product loading** - uses faceting only  
✅ **No heavy searches** - lightweight existence checks  
✅ **Extremely scalable** - works with millions of products  
✅ **Bandwidth efficient** - minimal data transfer

## Prerequisites

- Node.js (v16 or higher)
- Access to a Typesense instance with a "consumer-products" collection

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the project root with your Typesense credentials:

```env
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=your_api_key_here
```

## Usage

### Step 1: Generate and Review Suggestions

```bash
# Generate suggestions and output to suggestions-output.json
npm run dev
```

This will create `suggestions-output.json` in the project root. Review this file to verify the suggestions before syncing.

### Step 2: View Suggestions in Browser

To view the generated suggestions in a simple web interface:

```bash
# Start local server and open browser
npm run dev
```

This will start a server at `http://localhost:8081` and open `index.html` to display your suggestions.

### Step 3: Sync to Typesense (when ready)

```bash
# Sync requires the Admin API Key
TYPESENSE_API_KEY=vgBYPxusGypnzqB9tPe8gY6MYwOybJCp npm run dev -- --sync
```

### Production

```bash
# Build TypeScript to JavaScript
npm run build

# Generate suggestions only (uses read-only key from .env)
npm start

# Generate and sync (pass admin key)
TYPESENSE_API_KEY=vgBYPxusGypnzqB9tPe8gY6MYwOybJCp npm start -- --sync
```

## Project Structure

```
suggestion-service/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── config/
│   │   └── typesense.ts          # Typesense client configuration
│   ├── fetchProducts.ts           # Fetch products from Typesense
│   ├── extractAttributes.ts       # Extract unique attribute values
│   ├── generateSuggestions.ts     # Generate suggestions dynamically
│   ├── syncToTypesense.ts         # Sync suggestions to Typesense
│   ├── run.ts                     # Main orchestration script
│   └── manualOverrides.json       # Manual marketing suggestions
└── README.md
```

## How It Works

1. **Extract Attributes**: Uses faceting (with `per_page: 0`) to efficiently get unique values for category, metalType, style, occasion, and collection fields
2. **Validate Combinations**: For each potential suggestion, uses a faceted query to check if products exist (no full product loading!)
3. **Generate Suggestions**: Creates suggestions only for combinations that have matching products
4. **Output to JSON**: Writes all suggestions to `suggestions-output.json` for review
5. **Sync to Typesense** (optional, with `--sync` flag): 
   - Creates the "search_suggestions" collection if it doesn't exist
   - Clears existing suggestions
   - Imports all generated and manual suggestions

## Suggestion Schema

Each suggestion has the following fields:

- `term` (string): The search suggestion text
- `type` (string): The type of suggestion (category, occasion_category, metal_category, style_category, collection, marketing)
- `boost` (int32): Relevance boost score
- `target` (string): Filter parameters for the suggestion

## Customization

To add more manual suggestions, edit `src/manualOverrides.json`:

```json
[
  {
    "term": "Your Custom Term",
    "type": "marketing",
    "boost": 20,
    "target": "your:filter"
  }
]
```

## License

ISC
