# Hedwig

A minimal, offline-first e-book reader for course notes. No build step. No frameworks. No accounts. Runs from a folder — or from GitHub Pages.

---

## What It Is

You are doing courses. You want to keep quotes from instructors and write exercises as proper essays. You do not want Notion. You want ownership, plain text, and a reader that stays out of your way.

Hedwig is that reader. Your notes live as Markdown files. A small frontend — `hedwig-core` — reads them and renders them cleanly. One GitHub repository holds everything. One `manifest.json` registers your courses. Done.

---

## Structure

```
your-repo/
├── hedwig-core/          # The frontend (do not modify unless you know what you're doing)
│   ├── index.html
│   ├── style.css
│   ├── hedwig-app.js
│   ├── hedwig-md.js
│   ├── manifest.json     ← YOU EDIT THIS
│   └── favicon.svg
│
├── systems-thinking-ou/  # A course folder (you create these)
│   ├── index.md
│   ├── quotes/
│   │   ├── week-01.md
│   │   └── week-02.md
│   └── exercises/
│       ├── exercise-01.md
│       └── exercise-02.md
│
├── index.md              # Optional: root index pointing to all courses
└── .nojekyll             # Required for GitHub Pages
```

Course folders live **at the same level** as `hedwig-core`. You create one folder per course, structured however you like.

---

## Adding a Course

**Step 1.** Create a folder for the course at the root level:

```
my-new-course/
├── index.md
├── quotes/
│   └── week-01.md
└── exercises/
    └── exercise-01.md
```

**Step 2.** Register it in `hedwig-core/manifest.json`:

```json
{
  "courses": [
    {
      "id": "my-new-course",
      "title": "Course Title",
      "institution": "Where you are taking it",
      "description": "A short description.",
      "color": "#6A8FAF",
      "path": "../my-new-course",
      "sections": [
        {
          "title": "Index",
          "file": "index.md"
        },
        {
          "title": "Quotes",
          "children": [{ "title": "Week 1", "file": "quotes/week-01.md" }]
        },
        {
          "title": "Exercises",
          "children": [
            { "title": "Exercise 1", "file": "exercises/exercise-01.md" }
          ]
        }
      ]
    }
  ]
}
```

That is the entire registration process. The `path` field tells Hedwig where to find the course folder relative to `hedwig-core`.

---

## Running Locally

Hedwig uses `fetch()` to load Markdown files, which requires a local HTTP server. Opening `index.html` directly from the filesystem will not work.

**Option A — Python (simplest):**

```bash
cd hedwig-core
python3 -m http.server 8080
# Open http://localhost:8080
```

**Option B — Node (if you have it):**

```bash
npx serve hedwig-core
```

**Option C — VS Code:**

Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension. Right-click `hedwig-core/index.html` → _Open with Live Server_.

---

## Hosting on GitHub Pages

1. Push the repository to GitHub.
2. Go to **Settings → Pages**.
3. Set source to **Deploy from a branch**, branch `main`, folder `/hedwig-core`.
4. Save. GitHub will give you a URL like `https://yourusername.github.io/your-repo-name`.

No CI pipeline. No build step. No provider configuration. The `.nojekyll` file in the root ensures GitHub does not try to process the project.

Because `manifest.json` uses `../course-folder` paths, and your course folders sit one level up from `hedwig-core`, everything resolves correctly on both localhost and GitHub Pages.

---

## Writing Notes

Hedwig renders standard Markdown. Use whatever editor you like — VS Code, Obsidian, Vim, anything that writes `.md` files.

**Quotes file pattern:**

```markdown
# Week 1 — Quotes

**On some idea:**

> "Exact words from the instructor or material." — Source, Context

Personal reaction or note.
```

**Exercise file pattern:**

```markdown
# Exercise Title

## Prompt

_The question or task as given._

---

## Essay

Your response.
```

These are conventions, not rules. Hedwig renders whatever Markdown you give it.

---

## The `manifest.json` in Detail

| Field         | Required | Description                                                                 |
| ------------- | -------- | --------------------------------------------------------------------------- |
| `id`          | Yes      | Unique identifier. Must match the folder name.                              |
| `title`       | Yes      | Display title.                                                              |
| `institution` | No       | Shown as subtitle.                                                          |
| `description` | No       | Short description shown on home screen.                                     |
| `color`       | No       | Accent colour for the course card. Any CSS colour value.                    |
| `path`        | Yes      | Path to course folder relative to `hedwig-core`. Usually `../folder-name`.  |
| `sections`    | Yes      | TOC structure. Each section can have a `file` (leaf) or `children` (group). |

---

## Design Notes

- Dark and light mode. Preference saved in `localStorage`.
- Sidebar with collapsible section groups.
- Hash-based routing — deep links work, the back button works.
- Internal Markdown links between files are resolved automatically.
- No frameworks. No bundlers. No dependencies. The entire frontend is three files.

---

## Philosophy

Plain text survives everything. A Markdown file you wrote in 2026 will be readable in 2046. The reader is replaceable. The notes are not. Hedwig is designed to stay out of the way of that relationship.

[Vibe coded using Claude]
