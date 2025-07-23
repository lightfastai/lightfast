# Evaluation Results

This directory stores evaluation results and reports.

## Structure

```
results/
├── reports/          # Generated evaluation reports
├── logs/            # Detailed execution logs  
├── comparisons/     # Agent comparison analyses
└── archives/        # Historical result archives
```

## Result Types

- **Local Results**: Console output from `--no-send-logs` mode
- **Braintrust Cloud**: Results viewable at https://app.braintrust.dev
- **Custom Reports**: Generated analysis and comparison documents

## Viewing Results

### Local Development
Results are logged to console when running with `--no-send-logs` flag.

### Production (With API Key)
Set `BRAINTRUST_API_KEY` and view results in Braintrust dashboard.

### Custom Analysis
Use the evaluation runner to generate comparison reports:

```bash
npm run eval:all -- --agent a011 > results/logs/a011-evaluation.log
```