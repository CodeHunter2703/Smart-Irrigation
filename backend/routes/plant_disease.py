"""
Plant Disease Detection Route
==============================
Loads best_mobilenet(1).pth (MobileNet V2 trained on PlantVillage 38 classes)
for INFERENCE ONLY — no retraining, no weight download.

Endpoints:
  POST /api/plant-disease/predict      — image → label + confidence + GradCAM heatmap
  GET  /api/plant-disease/demo-images  — returns 2 bundled demo images (base64)
  GET  /api/plant-disease/classes      — returns list of 38 class names
"""

import os
import io
import base64
import json
import numpy as np
from flask import Blueprint, request, jsonify

plant_disease_bp = Blueprint("plant_disease", __name__)

# ── PlantVillage 38-class names (same order as training) ──────────────────────
CLASS_NAMES = [
    "Apple___Apple_scab", "Apple___Black_rot", "Apple___Cedar_apple_rust", "Apple___healthy",
    "Blueberry___healthy", "Cherry_(including_sour)___Powdery_mildew",
    "Cherry_(including_sour)___healthy", "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_", "Corn_(maize)___Northern_Leaf_Blight", "Corn_(maize)___healthy",
    "Grape___Black_rot", "Grape___Esca_(Black_Measles)", "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy", "Orange___Haunglongbing_(Citrus_greening)", "Peach___Bacterial_spot",
    "Peach___healthy", "Pepper,_bell___Bacterial_spot", "Pepper,_bell___healthy",
    "Potato___Early_blight", "Potato___Late_blight", "Potato___healthy",
    "Raspberry___healthy", "Soybean___healthy", "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch", "Strawberry___healthy", "Tomato___Bacterial_spot",
    "Tomato___Early_blight", "Tomato___Late_blight", "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot", "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot", "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus", "Tomato___healthy",
]

# ── Model loading (once at import time) ──────────────────────────────────────
_model = None
_device = None

def _load_model():
    """Load MobileNet V2 from best_mobilenet(1).pth — inference only."""
    global _model, _device

    try:
        import torch
        import torchvision.models as tvm
        import torch.nn as nn

        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Build the SAME architecture used during training
        model = tvm.mobilenet_v2(weights=None)               # no pretrained download
        num_classes = len(CLASS_NAMES)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)

        # Load the saved state dict
        model_path = os.path.join(os.path.dirname(__file__), "..", "models", "best_mobilenet(1).pth")
        model_path = os.path.abspath(model_path)

        if not os.path.exists(model_path):
            print(f"⚠️  Model file not found at: {model_path}")
            print("   Please copy best_mobilenet(1).pth → backend/models/")
            return False

        state_dict = torch.load(model_path, map_location=_device)
        model.load_state_dict(state_dict)
        model.to(_device)
        model.eval()          # inference mode — weights are frozen
        _model = model
        print(f"✅ MobileNet plant disease model loaded from {model_path}")
        return True

    except ImportError as e:
        print(f"⚠️  torch/torchvision not installed: {e}")
        print("   Run: pip install torch torchvision Pillow")
        return False
    except Exception as e:
        print(f"⚠️  Failed to load plant disease model: {e}")
        return False


# Attempt to load on startup
_model_loaded = _load_model()


# ── Helpers ──────────────────────────────────────────────────────────────────
def _preprocess_image(image_bytes):
    """Resize & normalize a raw image → (1, 3, 224, 224) tensor."""
    import torch
    from PIL import Image
    import torchvision.transforms as T

    transform = T.Compose([
        T.Resize((224, 224)),
        T.ToTensor(),
    ])
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = transform(img).unsqueeze(0).to(_device)
    return tensor, img


def _generate_gradcam(tensor):
    """
    Produce a GradCAM heatmap using the last conv block of MobileNetV2.
    Returns numpy array (H, W) with values 0-1.
    """
    import torch
    import torch.nn.functional as F

    gradients = []
    activations = []

    def save_gradient(grad):
        gradients.append(grad)

    # Hook onto the last feature block
    target_layer = _model.features[-1]
    handle_fwd = target_layer.register_forward_hook(
        lambda m, inp, out: (activations.append(out), out.register_hook(save_gradient))
    )

    # Forward pass WITH gradients (needed for GradCAM only)
    _model.zero_grad()
    output = _model(tensor)
    pred_class = output.argmax(dim=1).item()
    score = output[0, pred_class]
    score.backward()

    handle_fwd.remove()

    grad = gradients[0].cpu().detach().numpy()[0]   # (C, H, W)
    act  = activations[0].cpu().detach().numpy()[0] # (C, H, W)

    # Weight activations by global-average-pooled gradients
    weights = grad.mean(axis=(1, 2), keepdims=True)
    cam = (weights * act).sum(axis=0)
    cam = np.maximum(cam, 0)

    # Normalize 0-1
    if cam.max() > cam.min():
        cam = (cam - cam.min()) / (cam.max() - cam.min())
    return cam, pred_class


def _cam_to_heatmap_base64(cam, original_pil_img):
    """Overlay the CAM heatmap on the original image and return base64 PNG."""
    import cv2
    from PIL import Image as PILImage

    cam_resized = (cam * 255).astype(np.uint8)
    cam_resized = np.array(
        PILImage.fromarray(cam_resized).resize(original_pil_img.size, PILImage.BILINEAR)
    )

    heatmap = cv2.applyColorMap(cam_resized, cv2.COLORMAP_JET)
    original_cv = cv2.cvtColor(np.array(original_pil_img), cv2.COLOR_RGB2BGR)
    overlay = cv2.addWeighted(original_cv, 0.5, heatmap, 0.5, 0)

    _, buf = cv2.imencode(".png", overlay)
    return base64.b64encode(buf.tobytes()).decode("utf-8")


def _image_to_base64(image_bytes):
    return base64.b64encode(image_bytes).decode("utf-8")


def _get_demo_image_path(name):
    return os.path.join(os.path.dirname(__file__), "..", "static", "demo_images", name)


# ── Model-unavailable demo fallback ─────────────────────────────────────────
DEMO_RESULTS = {
    "healthy":  {"label": "Tomato___healthy",      "disease_class": "healthy",   "confidence": 0.97},
    "diseased": {"label": "Tomato___Early_blight", "disease_class": "diseased",  "confidence": 0.91},
}


# ── Routes ────────────────────────────────────────────────────────────────────

@plant_disease_bp.route("/plant-disease/classes", methods=["GET"])
def get_classes():
    return jsonify({"classes": CLASS_NAMES, "total": len(CLASS_NAMES)})


@plant_disease_bp.route("/plant-disease/demo-images", methods=["GET"])
def get_demo_images():
    """Return two bundled demo images as base64."""
    result = {}
    for key, filename in [("healthy", "healthy_leaf.jpg"), ("diseased", "diseased_leaf.jpg")]:
        path = _get_demo_image_path(filename)
        if os.path.exists(path):
            with open(path, "rb") as f:
                result[key] = {
                    "base64": _image_to_base64(f.read()),
                    "filename": filename,
                }
        else:
            result[key] = None
    return jsonify(result)


@plant_disease_bp.route("/plant-disease/predict", methods=["POST"])
def predict():
    """
    Accepts: JSON { "image": "<base64 string>", "is_demo": "healthy"|"diseased"|null }
    Returns: { label, confidence, disease_class, is_healthy, heatmap_base64, original_base64 }
    """
    data = request.json or {}
    image_b64 = data.get("image", "")
    is_demo   = data.get("is_demo")   # "healthy" | "diseased" | null

    if not image_b64:
        return jsonify({"error": "No image provided"}), 400

    try:
        image_bytes = base64.b64decode(image_b64)
    except Exception:
        return jsonify({"error": "Invalid base64 image"}), 400

    # ── Fallback when model is not loaded ────────────────────────────────────
    if not _model_loaded or _model is None:
        demo_key = is_demo if is_demo in DEMO_RESULTS else "diseased"
        r = DEMO_RESULTS[demo_key]
        return jsonify({
            "label":          r["label"],
            "disease_class":  r["disease_class"],
            "confidence":     r["confidence"],
            "is_healthy":     r["disease_class"] == "healthy",
            "heatmap_base64": None,
            "original_base64": _image_to_base64(image_bytes),
            "model_status":   "demo_fallback",
            "error":          "Model file not found — showing demo result",
        })

    # ── Real inference ───────────────────────────────────────────────────────
    try:
        import torch, torch.nn.functional as F

        tensor, pil_img = _preprocess_image(image_bytes)

        with torch.no_grad():
            probs = F.softmax(_model(tensor), dim=1)[0]
        top_prob, top_idx = probs.max(0)
        label = CLASS_NAMES[top_idx.item()]
        confidence = round(top_prob.item(), 4)

        # GradCAM needs gradients — run separately
        cam, _ = _generate_gradcam(
            _preprocess_image(image_bytes)[0]  # fresh tensor for grad
        )
        heatmap_b64 = _cam_to_heatmap_base64(cam, pil_img)

        disease_class = "healthy" if "healthy" in label.lower() else "diseased"

        return jsonify({
            "label":           label,
            "disease_class":   disease_class,
            "confidence":      confidence,
            "is_healthy":      disease_class == "healthy",
            "heatmap_base64":  heatmap_b64,
            "original_base64": _image_to_base64(image_bytes),
            "model_status":    "live",
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
