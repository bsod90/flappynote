# VocalSet Test Fixtures

This directory contains a subset of the VocalSet dataset for pitch detection evaluation.

## Dataset Information

**VocalSet: A Singing Voice Dataset**
- Authors: Julia Wilkins, Zhiyao Duan, et al.
- License: CC BY 4.0 (Creative Commons Attribution 4.0 International)
- Source: https://zenodo.org/records/1193957
- Paper: https://archives.ismir.net/ismir2018/paper/000173.pdf

## Selected Files

We use a subset of ~10 scale recordings for evaluation:

### Audio Files (`audio/`)
| File | Singer | Type | Vowel |
|------|--------|------|-------|
| arpeggios_a_f1.wav | Female 1 | Arpeggio | A |
| scales_a_f1.wav | Female 1 | Scale | A |
| arpeggios_e_f2.wav | Female 2 | Arpeggio | E |
| scales_i_f2.wav | Female 2 | Scale | I |
| scales_o_f3.wav | Female 3 | Scale | O |
| arpeggios_a_m1.wav | Male 1 | Arpeggio | A |
| scales_a_m1.wav | Male 1 | Scale | A |
| arpeggios_e_m2.wav | Male 2 | Arpeggio | E |
| scales_u_m2.wav | Male 2 | Scale | U |
| scales_o_m3.wav | Male 3 | Scale | O |

### F0 Annotations (`f0/`)
Each audio file has a corresponding `.f0` file containing ground truth pitch annotations.

**F0 File Format:**
- One value per line
- Each line represents the F0 (fundamental frequency) in Hz
- 0 or negative values indicate unvoiced frames
- Frame rate: typically 100 Hz (10ms hop)

## Download Instructions

Run the download script:
```bash
./scripts/download-vocalset.sh
```

Or manually download from Zenodo:

1. Go to https://zenodo.org/records/1193957
2. Download `VocalSet1-2.zip` (audio files)
3. Download `F0.zip` (F0 annotations)
4. Extract relevant files to this directory

## Usage in Evaluation

```javascript
import { EvaluationRunner } from '../src/pitch-engine/evaluation/EvaluationRunner.js';

const runner = new EvaluationRunner();
const results = await runner.evaluateVocalSet();
```

## License Notice

The VocalSet dataset is licensed under CC BY 4.0. When using this data:

> VocalSet: A Singing Voice Dataset. Julia Wilkins, Zhiyao Duan, et al.
> Licensed under CC BY 4.0. https://zenodo.org/records/1193957

## File Structure

```
tests/fixtures/vocalset/
├── README.md           # This file
├── audio/              # WAV audio files
│   ├── arpeggios_a_f1.wav
│   ├── scales_a_f1.wav
│   └── ...
└── f0/                 # F0 annotation files
    ├── arpeggios_a_f1.f0
    ├── scales_a_f1.f0
    └── ...
```
