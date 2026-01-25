# jrnl JSON Output Schema

When using `--format json`, jrnl outputs an object with entries and tags.

## Entry List Output

```bash
jrnl -n 5 --format json
```

```json
{
  "tags": {
    "@meeting": 3,
    "@project": 2
  },
  "entries": [
    {
      "title": "Entry title here",
      "body": "Entry body text following the title.",
      "date": "2024-01-15",
      "time": "14:30",
      "tags": ["@meeting", "@project"],
      "starred": false
    }
  ]
}
```

## Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | First sentence of entry (up to `.?!:`) |
| `body` | string | Remaining text after title |
| `date` | string | ISO date `YYYY-MM-DD` |
| `time` | string | Time `HH:MM` |
| `tags` | array | List of tags (prefixed with `@`) |
| `starred` | boolean | Whether entry is starred |

## Tags Output

```bash
jrnl --tags --format json
```

```json
{
  "tags": {
    "@meeting": 15,
    "@project-x": 8,
    "@call": 5
  }
}
```

## Journal List Output

```bash
jrnl --list --format json
```

```json
{
  "journals": {
    "default": "/path/to/journal.txt",
    "work": "/path/to/work.txt"
  }
}
```

## Parsing Example (Python)

```python
import json
import subprocess

result = subprocess.run(
    ["jrnl", "-n", "10", "--format", "json"],
    capture_output=True,
    text=True
)
data = json.loads(result.stdout)

for entry in data["entries"]:
    print(f"{entry['date']}: {entry['title']}")
    if "@important" in entry["tags"]:
        print("  ^ This one is important!")
```

## Parsing Example (jq)

```bash
# Get all titles from last week
jrnl -from "last week" --format json | jq -r '.entries[].title'

# Count entries by tag
jrnl --format json | jq '.tags'

# Get starred entries only
jrnl --format json | jq '.entries | map(select(.starred))'
```
