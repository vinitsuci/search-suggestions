# Suggestion Service

A Node.js + TypeScript service that generates search suggestions from product data and syncs them to Typesense.

## Features

- **Extracts unique attributes** via efficient faceting from the "consumer-products" collection
- **Validates combinations** using faceted queries (no full product loading!)
- **Resolves IDs** for categories, occasions, styles, subcategories, and collections
- **Generates dynamic suggestions** based on real product combinations
- **Outputs to JSON file** for review before syncing
- **Includes manual overrides** for marketing terms (New Arrivals, Best Sellers)
- **Optional Typesense sync** with automatic collection management

## Suggestion Types

The service generates the following types of suggestions:

| Type                | Example Term          | Target Format                      | Boost |
| ------------------- | --------------------- | ---------------------------------- | ----- |
| `category`          | "Rings"               | `cId:1`                            | 10    |
| `occasion_category` | "Engagement Rings"    | `oId:5,occasion:Engagement,cId:1`  | 5     |
| `style_category`    | "Solitaire Rings"     | `styleId:35,style:Solitaire,cId:1` | 5     |
| `style`             | "Solitaire"           | `styleId:35,style:Solitaire`       | 5     |
| `collection`        | "Heritage Collection" | `collectionSlug:heritage`          | 4     |
| `search_tag`        | "Diamond"             | `searchTags:Diamond`               | 8     |
| `displayname`       | "Eternal Love Ring"   | `slug:eternal-love-ring`           | 9     |

### Target Format Details

Each suggestion includes a `target` field that contains filter parameters for navigation:

- **Category**: Uses `cId` (category ID) when available, falls back to `category:Name`
- **Occasion + Category**: Includes both `oId` (occasion ID) + `occasion` name + `cId`
- **Style + Category**: Includes `styleId` + `style` name + `cId`
- **Style**: Includes `styleId` + `style` name
- **Collection**: Uses `collectionSlug` when available
- **Search Tag**: Direct searchTags filter
- **Displayname**: Uses product `slug` for direct navigation

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

### Step 1: Generate Suggestions

```bash
# Generate suggestions and output to suggestions-output.json
npm run generate
```

This will create `suggestions-output.json` in the project root. Review this file to verify the suggestions before syncing.

### Step 2: View Suggestions in Browser

```bash
# Start local server and open browser
npm run dev
```

This will start a server at `http://localhost:8081` and open `index.html` to display your suggestions.

### Step 3: Sync to Typesense

```bash
# Sync suggestions to Typesense
npm run sync
```

## How It Works

### 1. Extract Attributes

Uses faceting (with `per_page: 0`) to efficiently get unique values for:

- `category`
- `subCategory`
- `searchTags`
- `metalType`
- `style`
- `occasion`
- `collection`

### 2. Resolve IDs

For each attribute, resolves the corresponding IDs:

- **Categories** → `cId` (single value per product)
- **Occasions** → `oId` (array field, uses intersection to find common ID)
- **Styles** → `styleIds` (array field, uses intersection to find common ID)
- **SubCategories** → `scId` (array field, uses intersection)
- **Collections** → `collectionSlug`

### 3. Generate Suggestions

For each combination, validates that products exist before creating the suggestion:

```typescript
// Only creates suggestion if products exist
if (await hasProducts(`style:=${style} && category:=${category}`)) {
  suggestions.push({
    term: `${style} ${category}`,
    type: "style_category",
    boost: 5,
    target: `styleId:${styleId},style:${style},cId:${cId}`,
  });
}
```

### 4. Output to JSON

Writes all suggestions to `suggestions-output.json` for review.

### 5. Sync to Typesense (with `--sync` flag)

- Creates the "search_suggestions" collection if it doesn't exist
- Clears existing suggestions
- Imports all generated and manual suggestions in batches of 100

## Project Structure

```
suggestion-service/
├── package.json
├── tsconfig.json
├── .env
├── index.html                    # Web UI for viewing suggestions
├── suggestions-output.json       # Generated suggestions (gitignored)
├── src/
│   ├── config/
│   │   └── typesense.ts          # Typesense client configuration
│   ├── extractAttributes.ts      # Extract unique attribute values via faceting
│   ├── resolveMappings.ts        # Resolve IDs for attributes
│   ├── generateSuggestions.ts    # Generate suggestions with validation
│   ├── syncToTypesense.ts        # Sync suggestions to Typesense
│   ├── run.ts                    # Main orchestration script
│   └── manualOverrides.json      # Manual marketing suggestions
└── README.md
```

## Suggestion Schema

Each suggestion has the following fields:

| Field    | Type   | Description                                         |
| -------- | ------ | --------------------------------------------------- |
| `term`   | string | The search suggestion text displayed to users       |
| `type`   | string | Category of suggestion (see Suggestion Types above) |
| `boost`  | int32  | Relevance boost score (higher = more prominent)     |
| `target` | string | Filter/navigation parameters                        |

## Customization

### Adding Manual Suggestions (Optional)

You can add custom marketing or promotional suggestions by editing `src/manualOverrides.json`:

```json
[
  {
    "term": "New Arrivals",
    "type": "marketing",
    "boost": 20,
    "target": "sort:newest"
  }
]
```

Currently, no manual overrides are configured (the file is empty `[]`).

### Modifying Boost Values

Boost values determine suggestion prominence. Current defaults:

- `category`: 10
- `displayname`: 9
- `search_tag`: 8
- `style`, `style_category`, `occasion_category`: 5
- `collection`: 4

## Scripts

| Command            | Description                            |
| ------------------ | -------------------------------------- |
| `npm run generate` | Generate suggestions to JSON file      |
| `npm run dev`      | Start local server to view suggestions |
| `npm run sync`     | Generate and sync to Typesense         |
| `npm run build`    | Build TypeScript to JavaScript         |
| `npm start`        | Run built JavaScript                   |

## License

ISC
