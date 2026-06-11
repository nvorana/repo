# Custom sales frameworks

Drop a markdown file in this folder to make reviews follow your own sales
methodology instead of the built-in general framework.

- The **file name** (minus `.md`) becomes the framework id.
- The first `# Heading` becomes its display name.
- The whole document is given to the reviewer as methodology guidance.
- Optionally add a `## Scorecard` section with bullets of the form
  `- **Criterion name**: what good looks like` — these become the scored
  criteria. Without one, the default criteria are used.

Example (`our-method.md`):

```markdown
# Our Sales Method

Reps must follow the 4-step flow: Frame → Dig → Prescribe → Commit.
Never present pricing before at least two pains are quantified.
...

## Scorecard
- **Frame**: Set the agenda and got explicit buy-in within 2 minutes.
- **Dig**: Quantified at least two pains in dollars or hours.
- **Prescribe**: Tied every capability mentioned to a named pain.
- **Commit**: Booked a concrete next meeting on the call.
```

Pass `frameworkId=our-method` when uploading (the API's `POST /api/reviews`
form field) to review against it.
