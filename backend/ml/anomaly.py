from sklearn.ensemble import IsolationForest
import numpy as np
import joblib, os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "isolation_forest.pkl")

def extract_session_features(packets: list[dict]) -> np.ndarray:
    sizes = [p.get("packet_length", 0) for p in packets]
    ports = {p.get("dst_port", 0) for p in packets}
    entropies = [p.get("payload_entropy", 0.0) for p in packets]

    return np.array([[
        np.mean(sizes) if sizes else 0.0, # avg packet size
        np.std(sizes) if sizes else 0.0,  # size variance
        len(packets),                     # session volume
        len(ports),                       # unique dst ports (scan indicator)
        np.mean(entropies) if entropies else 0.0, # avg payload entropy
    ]])

def score_session(packets: list[dict]) -> float:
    if not os.path.exists(MODEL_PATH):
        return 0.0 # No model yet
    
    try:
        model = joblib.load(MODEL_PATH)
        features = extract_session_features(packets)
        return float(model.score_samples(features)[0])
    except Exception:
        return 0.0

def train_baseline(all_sessions: list[list[dict]]):
    if not all_sessions:
        return None
    X = np.vstack([extract_session_features(s) for s in all_sessions])
    model = IsolationForest(contamination=0.05, random_state=42)
    model.fit(X)
    
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    return model
