import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from ml.wssv_transfer.content_validator import validate_image_content
from ml.wssv_transfer.shrimp_detector import count_shrimp_in_image

def test_elephant_rejection():
    test_image = Path('backend/uploads/disease_scans/1794782639_283bda40_African_Bush_Elephant.jpg.webp')
    if not test_image.exists():
        return

    result = validate_image_content(test_image)
    assert result['shrimp_detected'] is False
    assert result['presence_state'] == 'no_shrimp'
    assert 'animal' in result['message'].lower() or 'elephant' in result['message'].lower()

    count_res = count_shrimp_in_image(test_image)
    assert count_res['shrimp_detected'] is False
    assert count_res['shrimp_count'] == 0
    assert count_res['display_status'] == 'No Shrimp Detected'

def test_real_raw_shrimp_acceptance():
    test_image = Path(r'C:\Users\HP\Desktop\Shrimp\Shrimp\dataset-tools\shrimp-dataset\Healthy\2840.jpg')
    if not test_image.exists():
        return

    result = validate_image_content(test_image)
    assert result['shrimp_detected'] is True
    assert result['presence_state'] == 'shrimp_detected'
    assert result['is_cooked'] is False

    count_res = count_shrimp_in_image(test_image)
    assert count_res['shrimp_detected'] is True
    assert count_res['shrimp_count'] >= 1
    assert count_res['display_status'] == 'Ready for Scan'
