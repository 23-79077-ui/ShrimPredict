# External Dataset Sources for Black Gill Disease Detection

This guide lists publicly available, reusable datasets to further expand the Black Gill Disease training data.

---

## Recommended Datasets

### 1. ShrimpDiseaseBD (Kaggle / Mendeley Data)
- **URL**: https://www.kaggle.com/datasets/pritamroy/shrimp-disease-image-dataset-for-detection-models
- **Mendeley Mirror**: https://data.mendeley.com/datasets/jhrtdj9txm/3
- **License**: CC BY 4.0 (free for research and commercial use with attribution)
- **Content**: 1,149 high-quality annotated RGB images
- **Classes**:
  - Healthy: 403 images
  - **Black Gill (BG): 198 images**
  - White Spot Syndrome Virus (WSSV): 328 images
  - Co-infected (BG_WSSV): 220 images
- **Format**: Raw images + YOLO bounding box annotations
- **How to Download**:
  1. Go to the Kaggle dataset page
  2. Click "Download" (requires free Kaggle account)
  3. Extract the ZIP file
  4. Copy images from the `BG/` and `BG_WSSV/` folders

### 2. TigerShrimpBD (Mendeley Data)
- **URL**: https://data.mendeley.com/datasets/9dj4sk5d55/1
- **License**: CC BY 4.0
- **Content**: 3,574 RGB images (1,001 original + augmented)
- **Classes**:
  - **Black Gill: 854 images**
  - WSSV: 978 images
  - Yellow Head: 896 images
  - Healthy: 846 images
- **How to Download**:
  1. Go to the Mendeley Data page
  2. Click "Download All"
  3. Extract and copy Black Gill images

### 3. Hugging Face - BD Fish & Shrimp Disease Dataset
- **URL**: https://huggingface.co/datasets/Saon110/bd-fish-disease-dataset
- **License**: Open access
- **Content**: Comprehensive fish and shrimp disease images including Black Gill and WSSV classes
- **How to Download**:
  1. Visit the Hugging Face dataset page
  2. Use the "Files and versions" tab to download
  3. Filter for shrimp Black Gill images

### 4. GitHub - Shrimp_Classifier (Swin Transformer)
- **URL**: https://github.com/Affand6331/Shrimp_Classifier
- **Content**: Deep learning classification project with Healthy, WSSV, Black Gill classes
- **May Include**: Training dataset or links to source datasets

### 5. GitHub - shrimp_lightweight (FeatherNetX)
- **URL**: https://github.com/sand198/shrimp_lightweight
- **Content**: Lightweight CNN for offline shrimp disease classification
- **May Include**: Dataset references and preprocessing scripts

---

## How to Integrate Downloaded Images

After downloading any of the datasets above:

### Step 1: Copy Black Gill images to the training folder
```bash
# Copy to the existing Black_Gill dataset folder
cp /path/to/downloaded/BG/*.jpg "C:/Users/HP/Desktop/Shrimp/Shrimp/dataset-tools/shrimp-dataset/Black_Gill/"
```

### Step 2: Remove duplicates
The fine-tuning script (`fine_tune_black_gill.py`) includes perceptual hash-based deduplication.
Duplicates are automatically detected and skipped during augmentation.

### Step 3: Resize images to 224x224
```python
from PIL import Image, ImageOps
img = Image.open("new_image.jpg")
img = ImageOps.exif_transpose(img).convert("RGB").resize((224, 224))
img.save("resized_image.jpg")
```

### Step 4: Re-run the fine-tuning script
```bash
cd C:\Users\HP\Documents\ShrimPredict
.\.venv311\Scripts\python.exe ml/wssv_transfer/fine_tune_black_gill.py
```

This will:
- Automatically detect the new images
- Generate augmented variants
- Retrain the model with balanced class weights
- Output updated evaluation metrics

### Step 5: Restart Flask API
```bash
# Kill existing Flask server, then restart
.\.venv311\Scripts\python.exe ml/wssv_transfer/flask_api.py
```

No changes to React, PHP, or Flask code are needed.
