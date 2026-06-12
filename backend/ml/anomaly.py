from sklearn.ensemble import IsolationForest
import numpy as np
import joblib, os, json, datetime

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "isolation_forest.pkl")
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "models", "config.json")

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

def train_baseline(all_sessions: list[list[dict]], contamination: float = 0.05):
    if not all_sessions:
        return None
    X = np.vstack([extract_session_features(s) for s in all_sessions])
    model = IsolationForest(contamination=contamination, random_state=42)
    model.fit(X)
    
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    
    # Save configuration
    config = {
        "status": "active",
        "contamination": contamination,
        "last_trained": datetime.datetime.utcnow().isoformat()
    }
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f)
        
    return model

def generate_synthetic_benign_sessions(num_sessions=100):
    """Generates realistic benign traffic profiles for reliable demo training."""
    sessions = []
    for _ in range(num_sessions):
        num_packets = np.random.randint(5, 50)
        session = []
        for _ in range(num_packets):
            session.append({
                "packet_length": np.random.normal(500, 100),
                "dst_port": np.random.choice([80, 443, 53]),
                "payload_entropy": np.random.normal(2.0, 0.5)
            })
        sessions.append(session)
    return sessions
