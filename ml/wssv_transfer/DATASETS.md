# WSSV Dataset Sources

This training pipeline uses only public datasets that contain healthy shrimp and White Spot Syndrome Virus (WSSV) shrimp images.

## Primary Source Already Supported

1. ShrimpDiseaseImageBD: An Image Dataset for Computer Vision-Based Detection of Shrimp Diseases in Bangladesh
   - Primary public page: https://data.mendeley.com/datasets/jhrtdj9txm/3
   - Public Kaggle mirror: https://www.kaggle.com/datasets/lokotwist/shrimp-disease-image-bd
   - Dataset citation on Kaggle: Islam, Mohammad Manzurul; Sarker, Anabil; Choudhury, Ashiquzzaman; Ahmed, Noortaz; Rasel, Ahmed Abdal Shafi Rasel (2025), Mendeley Data, V3, doi: 10.17632/jhrtdj9txm.3
   - Mendeley listed license: Creative Commons Attribution 4.0 International
   - Local supported folders:
     - `Raw Images/Healthy`
     - `Raw Images/WSSV`
     - `Raw Images/BG_WSSV`
     - Numbered variants such as `1. Healthy`, `3. WSSV`, `4. WSSV_BG`

2. Shrimp Disease Image Dataset for Detection Models
   - Public page: https://www.kaggle.com/datasets/pritamroy24mcb1016/shrimp-disease-image-dataset-for-detection-models
   - Page describes the same Healthy, BG, WSSV, and BG_WSSV structure.
   - The page text says the images were released under CC BY 4.0, while Kaggle metadata displays "License Unknown". Verify the page before final capstone submission.

## Recommended Additional Source

3. TigerShrimpBD: A Tiger Shrimp Image Dataset
   - Public page: https://data.mendeley.com/datasets/9dj4sk5d55
   - DOI: 10.17632/9dj4sk5d55.1
   - License: CC BY 4.0
   - Contains Healthy, WSSV, Yellow Head, and Black Gill classes.
   - Put the extracted dataset under `data/tigershrimpbd` or any folder under `data/`; this pipeline will normalize labels automatically.

## Label Normalization

The final classifier is binary:

- `Healthy`
- `White Spot Syndrome Virus (WSSV)`

Images with labels containing `WSSV`, `white spot`, or `white-spot` are mapped to WSSV. Images with labels containing `healthy` are mapped to Healthy. Other disease-only classes such as BG and Yellow Head are excluded from binary WSSV training so they do not confuse the healthy class.
