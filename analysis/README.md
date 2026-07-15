# Analysis workspace

Offline exploratory analysis and the data-audit pipeline for the TakaPay dataset.

- `notebooks/eda.ipynb` — full exploratory analysis (Kaggle-compatible; attach the dataset from `../data/`)
- Outputs: audited dataset + precomputed insights consumed by the web app, figures used in the root README

Nothing in this folder runs in production — the web app ships with the precomputed results.

```bash
pip install -r requirements.txt
jupyter notebook notebooks/eda.ipynb
```
