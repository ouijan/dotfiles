# jrnl Command Reference

## Writing Entries

### Basic Syntax
```
jrnl [journal] [timestamp:] [*] Title. Body text with @tags.
```

### Timestamp Formats
- `now:` (default if omitted)
- `yesterday:`, `today:`, `tomorrow:`
- `last friday:`, `next monday:`
- `2024-01-15:`, `2024-01-15 14:30:`
- `3pm:`, `yesterday at 3pm:`

### Examples
```bash
jrnl "Quick note."
jrnl "yesterday: Retroactive entry."
jrnl "*Important. This is starred."
jrnl work "Work-specific entry."
jrnl "Meeting with @john about @project-x. Discussed timeline."
```

## Reading/Filtering

### Count Limit
```bash
jrnl -n 5          # Last 5 entries
jrnl -1            # Last entry (shorthand)
```

### Date Filters
```bash
jrnl -on DATE          # Exact date
jrnl -from DATE        # On or after
jrnl -to DATE          # On or before
jrnl -from DATE -to DATE  # Range
jrnl -today-in-history    # Same day, previous years
jrnl -month 3          # All March entries
jrnl -year 2024        # All 2024 entries
```

### Content Filters
```bash
jrnl -contains "text"  # Full-text search
jrnl @tag              # Entries with tag
jrnl -starred          # Starred entries only
jrnl -tagged           # Entries with any tag
jrnl -not @tag         # Exclude tag
jrnl -not -starred     # Exclude starred
```

### Combining Filters
```bash
# Default: OR (any match)
jrnl @meeting @call -n 10

# AND mode (all must match)
jrnl @meeting @important -and
```

## Output Formats

### For Agent Processing
```bash
jrnl --format json     # Structured JSON array
jrnl --format yaml     # YAML format
jrnl --format xml      # XML format
```

### For User Display
```bash
jrnl --format pretty   # Colorized terminal output
jrnl --format markdown # Markdown (alias: md)
jrnl --format short    # Titles only
jrnl --format text     # Plain text (alias: txt)
jrnl --format fancy    # Decorated output
jrnl --format boxed    # Boxed entries
```

### Specialty Formats
```bash
jrnl --format dates    # Just dates
jrnl --format tags     # Tag frequency list
jrnl --format calendar # Calendar view
jrnl --format heatmap  # Activity heatmap
```

### Save to File
```bash
jrnl -n 10 --format json --file output.json
```

## Journal Management

### List Journals
```bash
jrnl --list
jrnl --list --format json
```

### Tags Overview
```bash
jrnl --tags
jrnl --tags --format json
```

## Editing

```bash
jrnl --edit            # Edit all in $EDITOR
jrnl -n 1 --edit       # Edit last entry
jrnl @tag --edit       # Edit filtered entries
```

## Deletion

```bash
jrnl -n 1 --delete     # Interactive delete
jrnl -contains "mistake" --delete
```

## Change Timestamp

```bash
jrnl -n 1 --change-time "yesterday at 2pm"
```

## Import

```bash
jrnl --import --file entries.txt
cat entries.txt | jrnl --import
```

## Config Override (One-time)

```bash
jrnl --config-override editor "nano" "Entry text"
jrnl --config-file /path/to/alt-config.yaml -n 5
```
